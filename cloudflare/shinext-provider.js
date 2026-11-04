const PROJECT_ID="shinex-e0c1f";
const ALLOWED_ORIGINS=new Set([
  "https://shinext.site","https://www.shinext.site","https://shinex-e0c1f.web.app",
  "http://localhost:5000","http://127.0.0.1:5000"
]);

function cors(request){
  const origin=request.headers.get("Origin")||"";
  return {
    "Content-Type":"application/json; charset=utf-8",
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shinext.site",
    "Access-Control-Allow-Headers":"Authorization, Content-Type",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Vary":"Origin",
  };
}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:cors(request)});}
function clean(value,max=160){return String(value??"").trim().slice(0,max);}
function b64bytes(input){const b=input.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-input.length%4)%4);return Uint8Array.from(atob(b),c=>c.charCodeAt(0));}

let jwksCache=null,jwksExpires=0;
async function verifyWorker(request){
  const auth=request.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))throw new Error("unauthenticated");
  const parts=auth.slice(7).split(".");
  if(parts.length!==3)throw new Error("unauthenticated");
  const header=JSON.parse(new TextDecoder().decode(b64bytes(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(b64bytes(parts[1])));
  if(header.alg!=="RS256"||!header.kid)throw new Error("unauthenticated");
  if(!jwksCache||Date.now()>jwksExpires){
    const response=await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if(!response.ok)throw new Error("unauthenticated");
    jwksCache=await response.json();
    jwksExpires=Date.now()+3600000;
  }
  const jwk=(jwksCache.keys||[]).find(key=>key.kid===header.kid);
  if(!jwk)throw new Error("unauthenticated");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64bytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  const now=Math.floor(Date.now()/1000);
  if(!valid||payload.aud!==PROJECT_ID||payload.iss!=="https://securetoken.google.com/"+PROJECT_ID||payload.exp<=now)throw new Error("unauthenticated");
  if(payload.role!=="worker")throw new Error("forbidden");
  return payload;
}

async function saveProfile(request,env,user){
  const body=await request.json();
  const uid=user.user_id||user.sub;
  const mode=body.serviceMode==="shinext_partner"?"shinext_partner":"independent";
  const types=Array.isArray(body.serviceTypes)?body.serviceTypes.filter(value=>["home","airbnb","office","commerce","industrial","all"].includes(value)).slice(0,6):["all"];
  await env.DB.prepare(`INSERT INTO providers(uid,display_name,zone,service_mode,service_types,active,rating,weekly_load,updated_at)
    VALUES(?,?,?,?,?,1,5,0,?)
    ON CONFLICT(uid) DO UPDATE SET
      display_name=excluded.display_name,
      zone=excluded.zone,
      service_mode=excluded.service_mode,
      service_types=excluded.service_types,
      active=1,
      updated_at=excluded.updated_at`)
    .bind(uid,clean(body.displayName,120),clean(body.zone,120),mode,JSON.stringify(types),new Date().toISOString()).run();
  return json(request,{ok:true});
}

async function saveAvailability(request,env,user){
  const uid=user.user_id||user.sub;
  const body=await request.json();
  const slots=Array.isArray(body.slots)?body.slots.slice(0,40):[];
  await env.DB.prepare("DELETE FROM provider_availability WHERE provider_uid=?").bind(uid).run();
  for(const slot of slots){
    const weekday=Number(slot.weekday);
    const timeWindow=clean(slot.timeWindow,40);
    if(weekday<0||weekday>6||!["morning","afternoon","evening"].includes(timeWindow))continue;
    await env.DB.prepare("INSERT OR REPLACE INTO provider_availability(provider_uid,weekday,time_window,available) VALUES(?,?,?,1)")
      .bind(uid,weekday,timeWindow).run();
  }
  return json(request,{ok:true,count:slots.length});
}

async function getProfileSummary(request,env,user){
  const uid=user.user_id||user.sub;
  const profile=await env.DB.prepare("SELECT rating,completed_services,service_mode,zone FROM providers WHERE uid=?").bind(uid).first();
  return json(request,{
    rating:Number(profile?.rating||0),
    completed_services:Number(profile?.completed_services||0),
    service_mode:profile?.service_mode||"independent",
    zone:profile?.zone||"",
  });
}

async function getProfileSummary(request,env,user){
  const uid=user.user_id||user.sub;
  const profile=await env.DB.prepare("SELECT rating,completed_services,service_mode,zone FROM providers WHERE uid=?").bind(uid).first();
  return json(request,{
    rating:Number(profile?.rating||0),
    completed_services:Number(profile?.completed_services||0),
    service_mode:profile?.service_mode||"independent",
    zone:profile?.zone||"",
  });
}

async function listOffers(request,env,user){
  const uid=user.user_id||user.sub;
  const rows=await env.DB.prepare(`SELECT
    o.id,o.status,o.rank,o.score,o.client_price,o.commission_rate,o.worker_earning,
    l.id AS lead_id,l.service_type,l.cleaning_level,l.zone,l.requested_date,l.time_window,
    l.space_size,l.frequency,l.supplies_source
    FROM offers o JOIN leads l ON l.id=o.lead_id
    WHERE o.provider_uid=? AND o.status IN ('pending','accepted')
    ORDER BY CASE o.status WHEN 'accepted' THEN 0 ELSE 1 END,o.created_at DESC
    LIMIT 50`).bind(uid).all();
  return json(request,{offers:rows.results||[]});
}

async function respondOffer(request,env,user,offerId){
  const uid=user.user_id||user.sub;
  const body=await request.json();
  const decision=body.decision==="accept"?"accept":body.decision==="reject"?"reject":"";
  if(!decision)return json(request,{error:"Respuesta inválida."},400);

  const offer=await env.DB.prepare("SELECT lead_id,status,worker_earning FROM offers WHERE id=? AND provider_uid=?")
    .bind(offerId,uid).first();
  if(!offer||offer.status!=="pending")return json(request,{error:"La oferta ya no está disponible."},409);
  if(decision==="accept"&&Number(offer.worker_earning||0)<=0)return json(request,{error:"La oferta aún no tiene pago confirmado."},409);

  const now=new Date().toISOString();
  if(decision==="reject"){
    await env.DB.prepare("UPDATE offers SET status='rejected',responded_at=? WHERE id=? AND provider_uid=? AND status='pending'")
      .bind(now,offerId,uid).run();
    return json(request,{ok:true,status:"rejected"});
  }

  const claim=await env.DB.prepare("UPDATE leads SET status='assigned',assigned_worker_uid=?,updated_at=? WHERE id=? AND status='pending'")
    .bind(uid,now,offer.lead_id).run();
  if(!claim.meta||Number(claim.meta.changes||0)!==1){
    await env.DB.prepare("UPDATE offers SET status='covered',responded_at=? WHERE id=?").bind(now,offerId).run();
    return json(request,{error:"El servicio ya fue tomado por otro prestador."},409);
  }
  await env.DB.prepare("UPDATE offers SET status='accepted',responded_at=? WHERE id=?").bind(now,offerId).run();
  await env.DB.prepare("UPDATE offers SET status='covered',responded_at=? WHERE lead_id=? AND id<>? AND status='pending'")
    .bind(now,offer.lead_id,offerId).run();
  await env.DB.prepare("UPDATE providers SET weekly_load=weekly_load+1,updated_at=? WHERE uid=?").bind(now,uid).run();
  return json(request,{ok:true,status:"accepted",leadId:offer.lead_id});
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
    const url=new URL(request.url);
    try{
      if(request.method==="GET"&&url.pathname==="/health")return json(request,{ok:true,service:"shinext-provider"});
      const user=await verifyWorker(request);
      if(request.method==="GET"&&url.pathname==="/me")return getProfileSummary(request,env,user);
      if(request.method==="GET"&&url.pathname==="/me")return getProfileSummary(request,env,user);
      if(request.method==="POST"&&url.pathname==="/profile")return saveProfile(request,env,user);
      if(request.method==="POST"&&url.pathname==="/availability")return saveAvailability(request,env,user);
      if(request.method==="GET"&&url.pathname==="/offers")return listOffers(request,env,user);
      const match=url.pathname.match(/^\/offers\/([^/]+)\/respond$/);
      if(request.method==="POST"&&match)return respondOffer(request,env,user,match[1]);
      return json(request,{error:"Not found"},404);
    }catch(error){
      const message=String(error?.message||error);
      if(message==="unauthenticated")return json(request,{error:"Inicia sesión."},401);
      if(message==="forbidden")return json(request,{error:"No autorizado."},403);
      return json(request,{error:"No se pudo completar la operación."},500);
    }
  }
};
