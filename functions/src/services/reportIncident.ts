import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

export function normalizeIncidentDescription(value: unknown): string {
  const text = String(value || "").trim();
  if (text.length < 4 || text.length > 2000) {
    throw new HttpsError(
      "invalid-argument",
      "Describe la situación con entre 4 y 2000 caracteres.",
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

export const reportIncident = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const serviceId = String(request.data?.serviceId || "").trim();
  const description = normalizeIncidentDescription(request.data?.description);

  if (!serviceId) {
    throw new HttpsError("invalid-argument", "Falta serviceId.");
  }

  const db = getFirestore();
  const serviceRef = db.collection("services").doc(serviceId);
  const incidentRef = db.collection("incidents").doc();
  const alertRef = db.collection("alerts").doc();

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
      "No puedes reportar incidencias de este servicio.",
    );
  }

  const batch = db.batch();
  batch.set(incidentRef, {
    serviceId,
    reporterUid: request.auth.uid,
    reporterType: isWorker ? "worker" : "collaborator",
    description,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(alertRef, {
    type: "service_incident",
    status: "open",
    priority: "high",
    serviceId,
    incidentId: incidentRef.id,
    title: "Incidencia en servicio",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(serviceRef, {
    statusBeforeIncident:
      service.status === "incident"
        ? service.statusBeforeIncident || "scheduled"
        : service.status || "scheduled",
    status: "incident",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  await writeAudit({
    action: "service_incident.reported",
    actorUid: request.auth.uid,
    actorRole: isWorker ? "worker" : String(request.auth.token.role || "unknown"),
    targetType: "service",
    targetId: serviceId,
    metadata: { incidentId: incidentRef.id, alertId: alertRef.id },
  });

  return {
    ok: true,
    incidentId: incidentRef.id,
    alertId: alertRef.id,
  };
});
