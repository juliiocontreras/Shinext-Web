import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";
import { assertAssignableRequest } from "./serviceState.js";

async function getActorAccess(
  uid: string,
  tokenRole: unknown,
): Promise<{ role: UserRole; overrides: PermissionOverrides }> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a Operaciones.");
  }

  const collaborator = await getFirestore().collection("collaborators").doc(uid).get();
  const data = collaborator.data() || {};

  return {
    role: tokenRole,
    overrides: {
      grants: Array.isArray(data.permissionGrants)
        ? (data.permissionGrants as Permission[])
        : [],
      revokes: Array.isArray(data.permissionRevokes)
        ? (data.permissionRevokes as Permission[])
        : [],
    },
  };
}

function normalizeCurrency(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new HttpsError(
      "invalid-argument",
      "La ganancia ofrecida al trabajador no es válida.",
    );
  }
  return Math.round(amount * 100) / 100;
}

export const createOffer = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const serviceRequestId = String(request.data?.serviceRequestId || "").trim();
  const workerUid = String(request.data?.workerUid || "").trim();
  const workerEarning = normalizeCurrency(request.data?.workerEarning);

  if (!serviceRequestId || !workerUid) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan la solicitud o el trabajador.",
    );
  }

  const { role, overrides } = await getActorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "manage_services", overrides)) {
    throw new HttpsError(
      "permission-denied",
      "No puedes enviar ofertas de servicio.",
    );
  }

  const db = getFirestore();
  const serviceRequestRef = db.collection("serviceRequests").doc(serviceRequestId);
  const workerRef = db.collection("workers").doc(workerUid);
  const offerRef = db.collection("serviceOffers").doc(
    `${serviceRequestId}_${workerUid}`,
  );

  await db.runTransaction(async (transaction) => {
    const [serviceRequestSnapshot, workerSnapshot, offerSnapshot] =
      await Promise.all([
        transaction.get(serviceRequestRef),
        transaction.get(workerRef),
        transaction.get(offerRef),
      ]);

    if (!serviceRequestSnapshot.exists) {
      throw new HttpsError("not-found", "No existe la solicitud de servicio.");
    }
    if (!workerSnapshot.exists || workerSnapshot.data()?.active !== true) {
      throw new HttpsError(
        "failed-precondition",
        "El trabajador no está activo.",
      );
    }

    const serviceRequest = serviceRequestSnapshot.data() || {};
    assertAssignableRequest(serviceRequest);

    if (offerSnapshot.exists && offerSnapshot.data()?.status === "pending") {
      return;
    }

    const workerView = {
      serviceType: String(serviceRequest.serviceType || "Limpieza"),
      zone: String(serviceRequest.zone || "Zona por confirmar"),
      scheduledAt: serviceRequest.scheduledAt || null,
      durationMinutes: Number(serviceRequest.durationMinutes || 0),
      materialsProvider: String(
        serviceRequest.materialsProvider || "Por confirmar",
      ),
      workerEarning,
    };

    transaction.set(
      offerRef,
      {
        serviceRequestId,
        workerUid,
        status: "pending",
        workerView,
        createdBy: request.auth!.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.update(serviceRequestRef, {
      status: "offered",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit({
    action: "service_offer.created",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "serviceRequest",
    targetId: serviceRequestId,
    metadata: { workerUid, workerEarning },
  });

  return {
    ok: true,
    offerId: `${serviceRequestId}_${workerUid}`,
  };
});
