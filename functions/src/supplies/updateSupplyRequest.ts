import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

export const SUPPLY_STATES = [
  "reported",
  "reviewed",
  "preparing_purchasing",
  "ready_for_delivery",
  "delivered",
] as const;

export type SupplyState = (typeof SUPPLY_STATES)[number];

const NEXT_STATES: Record<SupplyState, readonly SupplyState[]> = {
  reported: ["reviewed"],
  reviewed: ["preparing_purchasing"],
  preparing_purchasing: ["ready_for_delivery"],
  ready_for_delivery: ["delivered"],
  delivered: [],
};

export function assertSupplyTransition(
  current: unknown,
  next: unknown,
): SupplyState {
  if (
    typeof current !== "string" ||
    !SUPPLY_STATES.includes(current as SupplyState) ||
    typeof next !== "string" ||
    !SUPPLY_STATES.includes(next as SupplyState)
  ) {
    throw new HttpsError("invalid-argument", "Estado de insumo no válido.");
  }

  if (!NEXT_STATES[current as SupplyState].includes(next as SupplyState)) {
    throw new HttpsError(
      "failed-precondition",
      "La solicitud no puede avanzar a ese estado.",
    );
  }

  return next as SupplyState;
}

function normalizePhotoPath(value: unknown, uid: string, requestId: string): string {
  const path = String(value || "").trim();
  const prefix = `supply-requests/${uid}/${requestId}/`;
  if (!path.startsWith(prefix) || path.length > 500) {
    throw new HttpsError(
      "invalid-argument",
      "La fotografía no pertenece a esta solicitud.",
    );
  }
  return path;
}

async function getCollaboratorAccess(
  uid: string,
  tokenRole: unknown,
): Promise<{ role: UserRole; overrides: PermissionOverrides }> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a Compras.");
  }

  const snapshot = await getFirestore().collection("collaborators").doc(uid).get();
  const data = snapshot.data() || {};

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

export const updateSupplyRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const requestId = String(request.data?.requestId || "").trim();
  const action = String(request.data?.action || "").trim();

  if (!requestId) {
    throw new HttpsError("invalid-argument", "Falta requestId.");
  }

  const db = getFirestore();
  const ref = db.collection("supplyRequests").doc(requestId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "La solicitud de insumo no existe.");
  }

  const supply = snapshot.data() || {};

  if (request.auth.token.role === "worker") {
    if (supply.workerUid !== request.auth.uid || supply.status !== "reported") {
      throw new HttpsError(
        "permission-denied",
        "No puedes modificar esta solicitud.",
      );
    }

    if (action !== "attach_photo") {
      throw new HttpsError(
        "permission-denied",
        "Solo puedes adjuntar una fotografía a tu solicitud reportada.",
      );
    }

    const photoPath = normalizePhotoPath(
      request.data?.photoPath,
      request.auth.uid,
      requestId,
    );

    await ref.update({
      photoPath,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, requestId, photoPath };
  }

  const { role, overrides } = await getCollaboratorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "manage_supplies", overrides)) {
    throw new HttpsError(
      "permission-denied",
      "No puedes administrar solicitudes de insumos.",
    );
  }

  if (action !== "transition") {
    throw new HttpsError("invalid-argument", "Acción no válida.");
  }

  const nextStatus = assertSupplyTransition(
    supply.status,
    request.data?.status,
  );

  await ref.update({
    status: nextStatus,
    statusUpdatedBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
    ...(nextStatus === "delivered"
      ? { deliveredAt: FieldValue.serverTimestamp() }
      : {}),
  });

  await writeAudit({
    action: "supply_request.status_updated",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "supplyRequest",
    targetId: requestId,
    metadata: { from: supply.status, to: nextStatus },
  });

  return { ok: true, requestId, status: nextStatus };
});
