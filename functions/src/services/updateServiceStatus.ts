import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

const WORKER_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["en_route"],
  en_route: ["started"],
  started: ["completed"],
};

export function assertWorkerServiceTransition(current: unknown, next: unknown): string {
  if (
    typeof current !== "string" ||
    typeof next !== "string" ||
    !WORKER_TRANSITIONS[current]?.includes(next)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "El servicio no puede avanzar a ese estado.",
    );
  }
  return next;
}

async function collaboratorCanManageServices(
  uid: string,
  tokenRole: unknown,
): Promise<{ role: UserRole; allowed: boolean }> {
  if (!isUserRole(tokenRole) || tokenRole === "worker") {
    throw new HttpsError("permission-denied", "No tienes acceso a Operaciones.");
  }
  const snap=await getFirestore().collection("collaborators").doc(uid).get();
  const data=snap.data()||{};
  const overrides:PermissionOverrides={
    grants:Array.isArray(data.permissionGrants)?data.permissionGrants as Permission[]:[],
    revokes:Array.isArray(data.permissionRevokes)?data.permissionRevokes as Permission[]:[]
  };
  return {role:tokenRole,allowed:hasPermission(tokenRole,"manage_services",overrides)};
}

export const updateServiceStatus=onCall(async(request)=>{
  if(!request.auth) throw new HttpsError("unauthenticated","Inicia sesión para continuar.");
  const serviceId=String(request.data?.serviceId||"").trim();
  const nextStatus=String(request.data?.status||"").trim();
  if(!serviceId||!nextStatus) throw new HttpsError("invalid-argument","Faltan datos del servicio.");

  const db=getFirestore();
  const ref=db.collection("services").doc(serviceId);
  const snap=await ref.get();
  if(!snap.exists) throw new HttpsError("not-found","El servicio no existe.");
  const service=snap.data()||{};

  let actorRole=String(request.auth.token.role||"");
  if(actorRole==="worker"){
    if(service.assignedWorkerUid!==request.auth.uid) throw new HttpsError("permission-denied","Este servicio no está asignado a tu cuenta.");
    assertWorkerServiceTransition(service.status,nextStatus);
  }else{
    const access=await collaboratorCanManageServices(request.auth.uid,request.auth.token.role);
    actorRole=access.role;
    if(!access.allowed) throw new HttpsError("permission-denied","No puedes actualizar servicios.");
    if(!["scheduled","en_route","started","completed","cancelled"].includes(nextStatus)) throw new HttpsError("invalid-argument","Estado no válido.");
  }

  const update:any={
    status:nextStatus,
    updatedAt:FieldValue.serverTimestamp(),
    statusUpdatedBy:request.auth.uid,
  };
  if(nextStatus==="en_route") update.enRouteAt=FieldValue.serverTimestamp();
  if(nextStatus==="started") update.startedAt=FieldValue.serverTimestamp();
  if(nextStatus==="completed") update.completedAt=FieldValue.serverTimestamp();

  await ref.update(update);
  await writeAudit({
    action:"service.status_updated",
    actorUid:request.auth.uid,
    actorRole,
    targetType:"service",
    targetId:serviceId,
    metadata:{from:service.status,to:nextStatus},
  });
  return{ok:true,serviceId,status:nextStatus};
});
