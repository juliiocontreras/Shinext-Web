import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

export function normalizeServiceNoteText(value: unknown): string {
  const text = String(value || "").trim();
  if (text.length < 2 || text.length > 1500) {
    throw new HttpsError(
      "invalid-argument",
      "La nota debe tener entre 2 y 1500 caracteres.",
    );
  }
  return text;
}

async function collaboratorCanManageServices(
  uid: string,
  tokenRole: unknown,
): Promise<boolean> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") return false;

  const snapshot = await getFirestore().collection("collaborators").doc(uid).get();
  const data = snapshot.data() || {};
  const overrides: PermissionOverrides = {
    grants: Array.isArray(data.permissionGrants)
      ? (data.permissionGrants as Permission[])
      : [],
    revokes: Array.isArray(data.permissionRevokes)
      ? (data.permissionRevokes as Permission[])
      : [],
  };

  return hasPermission(tokenRole as UserRole, "manage_services", overrides);
}

export const addServiceNote = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const serviceId = String(request.data?.serviceId || "").trim();
  const text = normalizeServiceNoteText(request.data?.text);

  if (!serviceId) {
    throw new HttpsError("invalid-argument", "Falta serviceId.");
  }

  const db = getFirestore();
  const serviceRef = db.collection("services").doc(serviceId);
  const serviceSnapshot = await serviceRef.get();

  if (!serviceSnapshot.exists) {
    throw new HttpsError("not-found", "El servicio no existe.");
  }

  const service = serviceSnapshot.data() || {};
  const isWorker = request.auth.token.role === "worker";
  const canManage = isWorker
    ? false
    : await collaboratorCanManageServices(
        request.auth.uid,
        request.auth.token.role,
      );

  if (
    (isWorker && service.assignedWorkerUid !== request.auth.uid) ||
    (!isWorker && !canManage)
  ) {
    throw new HttpsError(
      "permission-denied",
      "No puedes agregar notas a este servicio.",
    );
  }

  const requestedVisibility = String(request.data?.visibility || "worker");
  const visibility = isWorker
    ? "worker"
    : requestedVisibility === "internal_shinext"
      ? "internal_shinext"
      : "worker";

  const noteRef = db.collection("serviceNotes").doc();
  await noteRef.set({
    serviceId,
    authorUid: request.auth.uid,
    authorType: isWorker ? "worker" : "collaborator",
    serviceStage: String(service.status || "scheduled"),
    text,
    visibility,
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: "service_note.created",
    actorUid: request.auth.uid,
    actorRole: isWorker ? "worker" : String(request.auth.token.role || "unknown"),
    targetType: "service",
    targetId: serviceId,
    metadata: { noteId: noteRef.id, visibility },
  });

  return { ok: true, noteId: noteRef.id };
});
