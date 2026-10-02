import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";
import { normalizePaymentStatus } from "./earnings.js";

async function getActorAccess(
  uid: string,
  tokenRole: unknown,
): Promise<{ role: UserRole; overrides: PermissionOverrides }> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a pagos.");
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

export const markWorkerPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const serviceId = String(request.data?.serviceId || "").trim();
  const paymentStatus = normalizePaymentStatus(request.data?.paymentStatus);

  if (!serviceId) {
    throw new HttpsError("invalid-argument", "Falta serviceId.");
  }

  const { role, overrides } = await getActorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "manage_payments", overrides)) {
    throw new HttpsError(
      "permission-denied",
      "No puedes actualizar pagos.",
    );
  }

  const db = getFirestore();
  const earningRef = db.collection("workerEarnings").doc(serviceId);
  const snapshot = await earningRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "not-found",
      "La ganancia de este servicio todavía no existe.",
    );
  }

  await earningRef.update({
    paymentStatus,
    paidAt:
      paymentStatus === "paid"
        ? FieldValue.serverTimestamp()
        : null,
    paymentUpdatedBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: "worker_earning.payment_status_updated",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "workerEarning",
    targetId: serviceId,
    metadata: { paymentStatus },
  });

  return { ok: true, serviceId, paymentStatus };
});
