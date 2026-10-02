import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { writeAudit } from "../audit/writeAudit.js";
import {
  assertAssignableRequest,
  assertPendingOffer,
  normalizeOfferDecision,
} from "./serviceState.js";

export const respondToOffer = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  if (request.auth.token.role !== "worker") {
    throw new HttpsError(
      "permission-denied",
      "Solo un Trabajador Shinext puede responder esta oferta.",
    );
  }

  const offerId = String(request.data?.offerId || "").trim();
  const decision = normalizeOfferDecision(request.data?.decision);

  if (!offerId) {
    throw new HttpsError("invalid-argument", "Falta offerId.");
  }

  const db = getFirestore();
  const offerRef = db.collection("serviceOffers").doc(offerId);

  const result = await db.runTransaction(async (transaction) => {
    const offerSnapshot = await transaction.get(offerRef);
    if (!offerSnapshot.exists) {
      throw new HttpsError("not-found", "La oferta no existe.");
    }

    const offer = offerSnapshot.data() || {};
    assertPendingOffer(offer, request.auth!.uid);

    if (decision === "reject") {
      transaction.update(offerRef, {
        status: "rejected",
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        accepted: false,
        serviceId: null,
        serviceRequestId: String(offer.serviceRequestId || ""),
      };
    }

    const serviceRequestId = String(offer.serviceRequestId || "");
    if (!serviceRequestId) {
      throw new HttpsError(
        "failed-precondition",
        "La oferta no está ligada a una solicitud válida.",
      );
    }

    const serviceRequestRef = db
      .collection("serviceRequests")
      .doc(serviceRequestId);
    const serviceRequestSnapshot = await transaction.get(serviceRequestRef);

    if (!serviceRequestSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "La solicitud original ya no existe.",
      );
    }

    const serviceRequest = serviceRequestSnapshot.data() || {};

    try {
      assertAssignableRequest(serviceRequest);
    } catch (error) {
      if (error instanceof HttpsError && error.code === "already-exists") {
        transaction.update(offerRef, {
          status: "covered",
          respondedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      throw error;
    }

    const serviceId = serviceRequestId;
    const serviceRef = db.collection("services").doc(serviceId);
    const workerView = offer.workerView || {};

    transaction.set(
      serviceRef,
      {
        serviceRequestId,
        assignedWorkerUid: request.auth!.uid,
        status: "scheduled",
        serviceType: workerView.serviceType || serviceRequest.serviceType || "Limpieza",
        zone: workerView.zone || serviceRequest.zone || "",
        scheduledAt: workerView.scheduledAt || serviceRequest.scheduledAt || null,
        durationMinutes:
          workerView.durationMinutes || serviceRequest.durationMinutes || 0,
        materialsProvider:
          workerView.materialsProvider ||
          serviceRequest.materialsProvider ||
          "Por confirmar",
        workerEarning: Number(workerView.workerEarning || 0),
        fullAddress: String(serviceRequest.fullAddress || ""),
        clientContactName: String(serviceRequest.clientContactName || ""),
        clientContactPhone: String(serviceRequest.clientContactPhone || ""),
        instructions: String(serviceRequest.instructions || ""),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

    transaction.update(serviceRequestRef, {
      status: "assigned",
      assignedWorkerUid: request.auth!.uid,
      serviceId,
      assignedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(offerRef, {
      status: "accepted",
      serviceId,
      respondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      accepted: true,
      serviceId,
      serviceRequestId,
    };
  });

  if (result.accepted) {
    const pendingOffers = await db
      .collection("serviceOffers")
      .where("serviceRequestId", "==", result.serviceRequestId)
      .where("status", "==", "pending")
      .get();

    if (!pendingOffers.empty) {
      const batch = db.batch();
      for (const document of pendingOffers.docs) {
        if (document.id === offerId) continue;
        batch.update(document.ref, {
          status: "covered",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  await writeAudit({
    action: result.accepted
      ? "service_offer.accepted"
      : "service_offer.rejected",
    actorUid: request.auth.uid,
    actorRole: "worker",
    targetType: "serviceOffer",
    targetId: offerId,
    metadata: {
      serviceId: result.serviceId,
      serviceRequestId: result.serviceRequestId,
    },
  });

  return {
    ok: true,
    accepted: result.accepted,
    serviceId: result.serviceId,
  };
});
