import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  hasPermission,
  type Permission,
  type PermissionOverrides,
} from "../auth/permissions.js";
import { isUserRole, type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";
import { normalizeMediaUrl } from "./media.js";

async function access(uid:string,tokenRole:unknown):Promise<{role:UserRole;overrides:PermissionOverrides}>{
  if(!isUserRole(tokenRole)||tokenRole==="worker") throw new HttpsError("permission-denied","No tienes acceso a Contenido.");
  const snap=await getFirestore().collection("collaborators").doc(uid).get();
  const data=snap.data()||{};
  return {role:tokenRole,overrides:{
    grants:Array.isArray(data.permissionGrants)?data.permissionGrants as Permission[]:[],
    revokes:Array.isArray(data.permissionRevokes)?data.permissionRevokes as Permission[]:[]
  }};
}

function text(value:unknown,max:number,label:string):string{
  const result=String(value||"").trim();
  if(!result||result.length>max) throw new HttpsError("invalid-argument",`${label} no válido.`);
  return result;
}

export const saveMediaEmbed=onCall(async(request)=>{
  if(!request.auth) throw new HttpsError("unauthenticated","Inicia sesión para continuar.");
  const {role,overrides}=await access(request.auth.uid,request.auth.token.role);
  if(!hasPermission(role,"manage_content",overrides)) throw new HttpsError("permission-denied","No puedes administrar contenido.");

  const articleSlug=text(request.data?.articleSlug,160,"Slug");
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug)) throw new HttpsError("invalid-argument","Slug no válido.");
  const title=text(request.data?.title,160,"Título");
  const normalized=normalizeMediaUrl(request.data?.url);
  const priority=Math.max(0,Math.min(999,Number(request.data?.priority||0)||0));

  const db=getFirestore();
  const ref=db.collection("mediaEmbeds").doc();
  await ref.set({
    articleSlug,
    title,
    description:String(request.data?.description||"").trim().slice(0,300),
    provider:normalized.provider,
    mediaId:normalized.id,
    canonicalUrl:normalized.canonicalUrl,
    embedUrl:normalized.embedUrl,
    thumbnailUrl:String(request.data?.thumbnailUrl||"").trim().slice(0,500)||null,
    publishedAt:request.data?.publishedAt?new Date(String(request.data.publishedAt)):null,
    active:request.data?.active!==false,
    public:true,
    priority,
    createdBy:request.auth.uid,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  });

  await writeAudit({action:"content.media_created",actorUid:request.auth.uid,actorRole:role,targetType:"mediaEmbed",targetId:ref.id,metadata:{articleSlug,provider:normalized.provider}});
  return {ok:true,id:ref.id,...normalized};
});
