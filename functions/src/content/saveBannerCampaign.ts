import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { hasPermission,type Permission,type PermissionOverrides } from "../auth/permissions.js";
import { isUserRole,type UserRole } from "../auth/roles.js";
import { writeAudit } from "../audit/writeAudit.js";

const PLACEMENTS=["hero","services","cta","blog","distributor"] as const;
const DEVICES=["all","mobile","desktop"] as const;
const AUDIENCES=["client","worker","both"] as const;

async function access(uid:string,tokenRole:unknown):Promise<{role:UserRole;overrides:PermissionOverrides}>{
 if(!isUserRole(tokenRole)||tokenRole==="worker")throw new HttpsError("permission-denied","No tienes acceso a Contenido.");
 const snap=await getFirestore().collection("collaborators").doc(uid).get();const data=snap.data()||{};
 return{role:tokenRole,overrides:{grants:Array.isArray(data.permissionGrants)?data.permissionGrants as Permission[]:[],revokes:Array.isArray(data.permissionRevokes)?data.permissionRevokes as Permission[]:[]}};
}
function required(value:unknown,max:number,label:string){const s=String(value||"").trim();if(!s||s.length>max)throw new HttpsError("invalid-argument",`${label} no válido.`);return s;}
function safeHref(value:unknown){const href=required(value,500,"Enlace");if(href.startsWith("/")||href.startsWith("#"))return href;try{const u=new URL(href);if(u.protocol==="https:")return u.toString();}catch{}throw new HttpsError("invalid-argument","El enlace del banner no es seguro.");}

export const saveBannerCampaign=onCall(async(request)=>{
 if(!request.auth)throw new HttpsError("unauthenticated","Inicia sesión para continuar.");
 const {role,overrides}=await access(request.auth.uid,request.auth.token.role);
 if(!hasPermission(role,"manage_content",overrides))throw new HttpsError("permission-denied","No puedes administrar campañas.");
 const placement=String(request.data?.placement||"");const device=String(request.data?.device||"all");const audience=String(request.data?.audience||"both");
 if(!PLACEMENTS.includes(placement as any)||!DEVICES.includes(device as any)||!AUDIENCES.includes(audience as any))throw new HttpsError("invalid-argument","Configuración de banner no válida.");
 const db=getFirestore();const ref=db.collection("bannerCampaigns").doc();
 await ref.set({
  placement,
  type:String(request.data?.type||"promotion").trim().slice(0,40),
  title:required(request.data?.title,160,"Título"),
  text:required(request.data?.text,300,"Texto"),
  cta:required(request.data?.cta,80,"CTA"),
  href:safeHref(request.data?.href),
  image:String(request.data?.image||"").trim().slice(0,500)||null,
  active:request.data?.active!==false,
  public:true,
  audience,device,
  priority:Math.max(0,Math.min(999,Number(request.data?.priority||0)||0)),
  createdBy:request.auth.uid,
  createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
 });
 await writeAudit({action:"content.banner_created",actorUid:request.auth.uid,actorRole:role,targetType:"bannerCampaign",targetId:ref.id,metadata:{placement}});
 return{ok:true,id:ref.id};
});
