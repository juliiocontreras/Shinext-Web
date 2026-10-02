import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";
import { assertClosableService } from "./earnings.js";

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

export const closeService = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const serviceId = String(request.data?.serviceId || "").trim();
  if (!serviceId) {
    throw new HttpsError("invalid-argument", "Falta serviceId.");
  }

  const { role, overrides } = await getActorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "manage_services", overrides)) {
    throw new HttpsError(
      "permission-denied",
      "No puedes cerrar servicios.",
    );
  }

  const db = getFirestore();
  const serviceRef = db.collection("services").doc(serviceId);
  const earningRef = db.collection("workerEarnings").doc(serviceId);

  const result = await db.runTransaction(async (transaction) => {
    const [serviceSnapshot, earningSnapshot] = await Promise.all([
      transaction.get(serviceRef),
      transaction.get(earningRef),
    ]);

    if (!serviceSnapshot.exists) {
      throw new HttpsError("not-found", "El servicio no existe.");
    }

    if (earningSnapshot.exists) {
      const existing = earningSnapshot.data() || {};
      return {
        alreadyClosed: true,
        workerUid: String(existing.workerUid || ""),
        amount: Number(existing.amount || 0),
      };
    }

    const service = serviceSnapshot.data() || {};
    const { workerUid, workerEarning } = assertClosableService(service);

    transaction.set(earningRef, {
      serviceId,
      workerUid,
      amount: workerEarning,
      currency: "MXN",
      paymentStatus: "pending",
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(serviceRef, {
      closedAt: FieldValue.serverTimestamp(),
      closedBy: request.auth!.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      alreadyClosed: false,
      workerUid,
      amount: workerEarning,
    };
  });

  await writeAudit({
    action: "service.closed",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "service",
    targetId: serviceId,
    metadata: {
      workerUid: result.workerUid,
      amount: result.amount,
      alreadyClosed: result.alreadyClosed,
    },
  });

  return {
    ok: true,
    ...result,
  };
});
