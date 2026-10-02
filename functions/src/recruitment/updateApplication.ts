import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

const REVIEW_STATUSES = new Set([
  "in_review",
  "information_pending",
  "rejected",
  "received",
]);

async function actorAccess(uid: string, tokenRole: unknown) {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a Reclutamiento.");
  }

  const collaborator = await getFirestore().collection("collaborators").doc(uid).get();
  const data = collaborator.data() || {};

  const overrides: PermissionOverrides = {
    grants: Array.isArray(data.permissionGrants)
      ? (data.permissionGrants as Permission[])
      : [],
    revokes: Array.isArray(data.permissionRevokes)
      ? (data.permissionRevokes as Permission[])
      : [],
  };

  return { role: tokenRole as UserRole, overrides };
}

export const updateApplication = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const applicationId = String(request.data?.applicationId || "").trim();
  const status = String(request.data?.status || "").trim();
  const note = String(request.data?.note || "").trim().slice(0, 2000);

  if (!applicationId || !REVIEW_STATUSES.has(status)) {
    throw new HttpsError("invalid-argument", "Solicitud o estado inválido.");
  }

  const { role, overrides } = await actorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "review_applications", overrides)) {
    throw new HttpsError("permission-denied", "No puedes revisar expedientes.");
  }

  const ref = getFirestore().collection("workerApplications").doc(applicationId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "No existe la solicitud.");
  }

  if (snapshot.get("status") === "approved") {
    throw new HttpsError(
      "failed-precondition",
      "Una solicitud aprobada no puede cambiarse desde revisión.",
    );
  }

  await ref.update({
    status,
    reviewNote: note || null,
    reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: "worker_application.status_changed",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "workerApplication",
    targetId: applicationId,
    metadata: { status, hasNote: Boolean(note) },
  });

  return { ok: true, status };
});
