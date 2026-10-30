const PROJECT_ID = "shinex-e0c1f";
const ALLOWED_ORIGINS = new Set([
  "https://shinext.site","https://www.shinext.site",
  "https://shinex-e0c1f.web.app","https://shinex-e0c1f.firebaseapp.com",
  "http://localhost:5000","http://127.0.0.1:5000"
]);

function cors(request){
  const origin=request.headers.get("Origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shinext.site",
    "Access-Control-Allow-Headers":"Authorization, Content-Type",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8"
  };
}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:cors(request)});}
function clean(value,max=160){return String(value??"").trim().slice(0,max);}
function normalize(value){return clean(value,160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function phone(value){return String(value??"").replace(/\D/g,"").slice(-10);}
function b64bytes(input){const b=input.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-input.length%4)%4);return Uint8Array.from(atob(b),c=>c.charCodeAt(0));}

let jwksCache=null,jwksExpires=0;
async function getJwks(){
  if(jwksCache&&Date.now()<jwksExpires)return jwksCache;
  const res=await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if(!res.ok)throw new Error("unauthenticated");
  jwksCache=await res.json();jwksExpires=Date.now()+3600000;return jwksCache;
}
async function verifyFirebaseToken(request,allowedRoles=[]){
  const auth=request.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))throw new Error("unauthenticated");
  const parts=auth.slice(7).split(".");
  if(parts.length!==3)throw new Error("unauthenticated");
  const header=JSON.parse(new TextDecoder().decode(b64bytes(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(b64bytes(parts[1])));
  if(header.alg!=="RS256"||!header.kid)throw new Error("unauthenticated");
  const jwks=await getJwks();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid);
  if(!jwk)throw new Error("unauthenticated");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64bytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  const now=Math.floor(Date.now()/1000);
  if(!valid||payload.aud!==PROJECT_ID||payload.iss!=="https://securetoken.google.com/"+PROJECT_ID||payload.exp<=now)throw new Error("unauthenticated");
  if(allowedRoles.length&&!allowedRoles.includes(String(payload.role||"")))throw new Error("forbidden");
  return payload;
}
function weekdayFromDate(value){const d=new Date(value+"T12:00:00");return Number.isNaN(d.getTime())?-1:d.getDay();}

async function createLead(request){
  const body=await request.json();
  const serviceType=clean(body.serviceType,40),cleaningLevel=clean(body.cleaningLevel,40),zone=clean(body.zone,120);
  const requestedDate=clean(body.requestedDate,20),timeWindow=clean(body.timeWindow,40),spaceSize=clean(body.spaceSize,40);
  const frequency=clean(body.frequency,40),suppliesSource=clean(body.suppliesSource,40),clientName=clean(body.clientName,120);
  const clientPhone=phone(body.clientPhone),clientEmail=clean(body.clientEmail,160).toLowerCase(),details=clean(body.details,700);
  if(!["home","airbnb","office","commerce","industrial"].includes(serviceType))return json(request,{error:"Tipo de servicio inválido."},400);
  if(!zone||!requestedDate||!timeWindow||!clientName||clientPhone.length<10)return json(request,{error:"Completa los datos requeridos."},400);
  if(!["provider","shinext"].includes(suppliesSource))return json(request,{error:"Modalidad de insumos inválida."},400);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await DB.prepare(`INSERT INTO leads(id,service_type,cleaning_level,zone,requested_date,time_window,space_size,frequency,supplies_source,details,client_name,client_phone,client_email,status,source,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','web',?,?)`).bind(id,serviceType,cleaningLevel,zone,requestedDate,timeWindow,spaceSize,frequency,suppliesSource,details,clientName,clientPhone,clientEmail,now,now).run();
  const weekday=weekdayFromDate(requestedDate);
  const candidates=await DB.prepare(`SELECT p.uid,p.display_name,p.zone,p.service_mode,p.service_types,p.rating,p.weekly_load,CASE WHEN a.available=1 THEN 1 ELSE 0 END AS is_available
    FROM providers p LEFT JOIN provider_availability a ON a.provider_uid=p.uid AND a.weekday=? AND a.time_window=? WHERE p.active=1`).bind(weekday,timeWindow).all();
  const scored=(candidates.results||[]).map(p=>{
    let score=0,types=[];try{types=JSON.parse(p.service_types||"[]");}catch{}
    if(normalize(p.zone)===normalize(zone))score+=35;
    if(types.includes(serviceType)||types.includes("all"))score+=25;
    if(Number(p.is_available)===1)score+=25;
    if((suppliesSource==="shinext"&&p.service_mode==="shinext_partner")||(suppliesSource==="provider"&&p.service_mode==="independent"))score+=10;
    score+=Math.min(10,Number(p.rating||0)*2);score-=Math.min(15,Number(p.weekly_load||0)*3);
    return {...p,score};
  }).filter(p=>p.score>=35).sort((a,b)=>b.score-a.score).slice(0,3);
  for(let i=0;i<scored.length;i++){
    const p=scored[i];
    await DB.prepare("INSERT OR IGNORE INTO offers(id,lead_id,provider_uid,rank,score,status,created_at) VALUES(?,?,?,?,?,'pending',?)")
      .bind(crypto.randomUUID(),id,p.uid,i+1,p.score,now).run();
  }
  return json(request,{ok:true,id,folio:id.slice(0,8).toUpperCase(),matched:scored.length},201);
}

async function saveProviderProfile(request){
  const user=await verifyFirebaseToken(request,["worker"]),body=await request.json();
  const mode=body.serviceMode==="shinext_partner"?"shinext_partner":"independent";
  const types=Array.isArray(body.serviceTypes)?body.serviceTypes.filter(x=>["home","airbnb","office","commerce","industrial","all"].includes(x)).slice(0,6):["all"];
  await DB.prepare(`INSERT INTO providers(uid,display_name,zone,service_mode,service_types,active,rating,weekly_load,updated_at)
    VALUES(?,?,?,?,?,1,5,0,?) ON CONFLICT(uid) DO UPDATE SET display_name=excluded.display_name,zone=excluded.zone,service_mode=excluded.service_mode,service_types=excluded.service_types,active=1,updated_at=excluded.updated_at`)
    .bind(user.user_id||user.sub,clean(body.displayName,120),clean(body.zone,120),mode,JSON.stringify(types),new Date().toISOString()).run();
  return json(request,{ok:true});
}
async function saveAvailability(request){
  const user=await verifyFirebaseToken(request,["worker"]),uid=user.user_id||user.sub,body=await request.json();
  const slots=Array.isArray(body.slots)?body.slots.slice(0,40):[];
  await DB.prepare("DELETE FROM provider_availability WHERE provider_uid=?").bind(uid).run();
  for(const slot of slots){
    const weekday=Number(slot.weekday),timeWindow=clean(slot.timeWindow,40);
    if(weekday<0||weekday>6||!["morning","afternoon","evening"].includes(timeWindow))continue;
    await DB.prepare("INSERT OR REPLACE INTO provider_availability(provider_uid,weekday,time_window,available) VALUES(?,?,?,?)")
      .bind(uid,weekday,timeWindow,slot.available===false?0:1).run();
  }
  return json(request,{ok:true,count:slots.length});
}
async function getProviderOffers(request){
  const user=await verifyFirebaseToken(request,["worker"]),uid=user.user_id||user.sub;
  const rows=await DB.prepare(`SELECT o.id,o.status,o.rank,o.score,l.id AS lead_id,l.service_type,l.cleaning_level,l.zone,l.requested_date,l.time_window,l.space_size,l.frequency,l.supplies_source
    FROM offers o JOIN leads l ON l.id=o.lead_id WHERE o.provider_uid=? AND o.status IN ('pending','accepted')
    ORDER BY CASE o.status WHEN 'accepted' THEN 0 ELSE 1 END,o.created_at DESC LIMIT 50`).bind(uid).all();
  return json(request,{offers:rows.results||[]});
}
async function respondOffer(request,offerId){
  const user=await verifyFirebaseToken(request,["worker"]),uid=user.user_id||user.sub,body=await request.json();
  const decision=body.decision==="accept"?"accept":body.decision==="reject"?"reject":"";
  if(!decision)return json(request,{error:"Respuesta inválida."},400);
  const offer=await DB.prepare("SELECT id,lead_id,status FROM offers WHERE id=? AND provider_uid=?").bind(offerId,uid).first();
  if(!offer||offer.status!=="pending")return json(request,{error:"La oferta ya no está disponible."},409);
  const now=new Date().toISOString();
  if(decision==="reject"){await DB.prepare("UPDATE offers SET status='rejected',responded_at=? WHERE id=? AND provider_uid=? AND status='pending'").bind(now,offerId,uid).run();return json(request,{ok:true,status:"rejected"});}
  const claim=await DB.prepare("UPDATE leads SET status='assigned',assigned_worker_uid=?,updated_at=? WHERE id=? AND status='pending'").bind(uid,now,offer.lead_id).run();
  if(!claim.meta||Number(claim.meta.changes||0)!==1){await DB.prepare("UPDATE offers SET status='covered',responded_at=? WHERE id=?").bind(now,offerId).run();return json(request,{error:"El servicio ya fue tomado por otro prestador."},409);}
  await DB.prepare("UPDATE offers SET status='accepted',responded_at=? WHERE id=?").bind(now,offerId).run();
  await DB.prepare("UPDATE offers SET status='covered',responded_at=? WHERE lead_id=? AND id<>? AND status='pending'").bind(now,offer.lead_id,offerId).run();
  await DB.prepare("UPDATE providers SET weekly_load=weekly_load+1,updated_at=? WHERE uid=?").bind(now,uid).run();
  return json(request,{ok:true,status:"accepted",leadId:offer.lead_id});
}
async function adminLeads(request){
  await verifyFirebaseToken(request,["director","operations"]);
  const rows=await DB.prepare(`SELECT id,service_type,cleaning_level,zone,requested_date,time_window,space_size,frequency,supplies_source,client_name,client_phone,client_email,status,assigned_worker_uid,created_at FROM leads ORDER BY created_at DESC LIMIT 100`).all();
  return json(request,{leads:rows.results||[]});
}

addEventListener("fetch",event=>event.respondWith((async()=>{
  const request=event.request;if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
  const url=new URL(request.url);
  try{
    if(request.method==="GET"&&url.pathname==="/health")return json(request,{ok:true,service:"shinext-dispatch"});
    if(request.method==="POST"&&url.pathname==="/leads")return createLead(request);
    if(request.method==="POST"&&url.pathname==="/provider/profile")return saveProviderProfile(request);
    if(request.method==="POST"&&url.pathname==="/provider/availability")return saveAvailability(request);
    if(request.method==="GET"&&url.pathname==="/provider/offers")return getProviderOffers(request);
    const match=url.pathname.match(/^\/offers\/([^/]+)\/respond$/);
    if(request.method==="POST"&&match)return respondOffer(request,match[1]);
    if(request.method==="GET"&&url.pathname==="/admin/leads")return adminLeads(request);
    return json(request,{error:"Not found"},404);
  }catch(error){
    const message=String(error?.message||error);
    if(message==="unauthenticated")return json(request,{error:"Inicia sesión."},401);
    if(message==="forbidden")return json(request,{error:"No autorizado."},403);
    return json(request,{error:"No se pudo completar la operación."},500);
  }
})()));
