import { randomBytes } from "node:crypto";

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

type ApplicationRecord = {
  status?: string;
  workerUid?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  zone?: string;
  experience?: string;
  availability?: string;
  hasOwnSupplies?: boolean;
  serviceMode?: "independent" | "shinext_partner";
  documentsPending?: boolean;
  documents?: {
    identity?: unknown;
    address?: unknown;
    studies?: unknown;
  };
};

async function getActorAccess(
  uid: string,
  tokenRole: unknown,
): Promise<{ role: UserRole; overrides: PermissionOverrides }> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a Reclutamiento.");
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

export function validateApplicationForApproval(application: ApplicationRecord): void {
  if (application.status === "rejected") {
    throw new HttpsError(
      "failed-precondition",
      "Una solicitud rechazada debe reabrirse antes de aprobarse.",
    );
  }

  if (application.documentsPending) {
    throw new HttpsError(
      "failed-precondition",
      "El expediente todavía tiene documentos pendientes.",
    );
  }

  if (!application.documents?.identity || !application.documents?.address) {
    throw new HttpsError(
      "failed-precondition",
      "La identificación y el comprobante de domicilio son obligatorios.",
    );
  }

  if (!application.email || !application.fullName) {
    throw new HttpsError(
      "failed-precondition",
      "La solicitud no contiene nombre y correo válidos.",
    );
  }
}

export const approveWorker = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  const applicationId = String(request.data?.applicationId || "").trim();
  if (!applicationId) {
    throw new HttpsError("invalid-argument", "Falta applicationId.");
  }

  const { role, overrides } = await getActorAccess(
    request.auth.uid,
    request.auth.token.role,
  );

  if (!hasPermission(role, "approve_applications", overrides)) {
    throw new HttpsError("permission-denied", "No puedes aprobar expedientes.");
  }

  const db = getFirestore();
  const auth = getAuth();
  const applicationRef = db.collection("workerApplications").doc(applicationId);
  const initialSnapshot = await applicationRef.get();

  if (!initialSnapshot.exists) {
    throw new HttpsError("not-found", "No existe la solicitud.");
  }

  const initial = initialSnapshot.data() as ApplicationRecord;

  if (initial.status === "approved" && initial.workerUid) {
    return {
      ok: true,
      workerUid: initial.workerUid,
      alreadyApproved: true,
    };
  }

  validateApplicationForApproval(initial);

  const workerUid = `worker_${applicationId}`;
  const email = initial.email!.trim().toLowerCase();

  try {
    const emailUser = await auth.getUserByEmail(email);
    if (emailUser.uid !== workerUid) {
      throw new HttpsError(
        "already-exists",
        "Ese correo ya pertenece a otra cuenta Shinext.",
      );
    }
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    if (error?.code !== "auth/user-not-found") throw error;
  }

  try {
    await auth.getUser(workerUid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;

    await auth.createUser({
      uid: workerUid,
      email,
      displayName: initial.fullName,
      password: randomBytes(32).toString("base64url"),
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(workerUid, { role: "worker" });

  await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(applicationRef);
    if (!currentSnapshot.exists) {
      throw new HttpsError("not-found", "La solicitud dejó de existir.");
    }

    const current = currentSnapshot.data() as ApplicationRecord;

    if (current.status === "approved" && current.workerUid) {
      return;
    }

    validateApplicationForApproval(current);

    const workerRef = db.collection("workers").doc(workerUid);
    const userRef = db.collection("users").doc(workerUid);

    transaction.set(
      workerRef,
      {
        applicationId,
        fullName: current.fullName,
        email,
        phone: current.phone || "",
        zone: current.zone || "",
        experience: current.experience || "",
        availabilityPreference: current.availability || "",
        serviceMode: current.serviceMode === "shinext_partner" ? "shinext_partner" : "independent",
        commissionRate: current.serviceMode === "shinext_partner" ? 0.2 : 0.15,
        hasOwnSupplies: current.serviceMode === "shinext_partner" ? false : Boolean(current.hasOwnSupplies),
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(
      userRef,
      {
        role: "worker",
        active: true,
        workerUid,
        email,
        displayName: current.fullName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.update(applicationRef, {
      status: "approved",
      workerUid,
      approvedBy: request.auth!.uid,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit({
    action: "worker_application.approved",
    actorUid: request.auth.uid,
    actorRole: role,
    targetType: "workerApplication",
    targetId: applicationId,
    metadata: { workerUid },
  });

  return {
    ok: true,
    workerUid,
    alreadyApproved: false,
    passwordSetupRequired: true,
  };
});
