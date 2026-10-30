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
function b64bytes(input){const b=input.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-input.length%4)%4);return Uint8Array.from(atob(b),c=>c.charCodeAt(0));}

let jwksCache=null,jwksExpires=0;
async function verifyStaff(request){
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
  if(!["director","operations"].includes(String(payload.role||"")))throw new Error("forbidden");
  return payload;
}

async function listLeads(request,env){
  const rows=await env.DB.prepare(`SELECT id,service_type,cleaning_level,zone,requested_date,time_window,
    space_size,frequency,supplies_source,client_name,client_phone,client_email,status,
    assigned_worker_uid,client_price,commission_rate,worker_earning,created_at,updated_at
    FROM leads ORDER BY created_at DESC LIMIT 100`).all();
  return json(request,{leads:rows.results||[]});
}

async function updateStatus(request,env,leadId){
  const body=await request.json();
  const next=String(body.status||"");
  const allowed=new Set(["pending","assigned","confirmed","in_progress","completed","cancelled"]);
  if(!allowed.has(next))return json(request,{error:"Estado inválido."},400);
  const current=await env.DB.prepare("SELECT status,assigned_worker_uid FROM leads WHERE id=?").bind(leadId).first();
  if(!current)return json(request,{error:"Solicitud no encontrada."},404);

  const transitions={
    pending:new Set(["cancelled"]),
    assigned:new Set(["confirmed","cancelled"]),
    confirmed:new Set(["in_progress","cancelled"]),
    in_progress:new Set(["completed"]),
    completed:new Set(),
    cancelled:new Set(),
  };
  if(current.status!==next&&!transitions[current.status]?.has(next)){
    return json(request,{error:"La transición de estado no es válida."},409);
  }
  await env.DB.prepare("UPDATE leads SET status=?,updated_at=? WHERE id=?")
    .bind(next,new Date().toISOString(),leadId).run();
  return json(request,{ok:true,status:next});
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
    const url=new URL(request.url);
    try{
      if(request.method==="GET"&&url.pathname==="/health")return json(request,{ok:true,service:"shinext-admin"});
      await verifyStaff(request);
      if(request.method==="GET"&&url.pathname==="/leads")return listLeads(request,env);
      const match=url.pathname.match(/^\/leads\/([^/]+)\/status$/);
      if(request.method==="POST"&&match)return updateStatus(request,env,match[1]);
      return json(request,{error:"Not found"},404);
    }catch(error){
      const message=String(error?.message||error);
      if(message==="unauthenticated")return json(request,{error:"Inicia sesión."},401);
      if(message==="forbidden")return json(request,{error:"No autorizado."},403);
      return json(request,{error:"No se pudo completar la operación."},500);
    }
  }
};
