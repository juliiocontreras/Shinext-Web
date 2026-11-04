const ALLOWED_ORIGINS=new Set([
  "https://shinext.site",
  "https://www.shinext.site",
  "https://shinex-e0c1f.web.app",
  "https://shinex-e0c1f.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
]);

const BASE_PRICE={home:850,airbnb:950,office:1200,commerce:1350,industrial:2200};
const CLEANING_MULTIPLIER={maintenance:1,deep:1.35,move:1.5};
const SIZE_MULTIPLIER={small:1,medium:1.25,large:1.55,xl:1.9};
const FREQUENCY_MULTIPLIER={once:1,weekly:.9,biweekly:.94,monthly:.97};

function cors(request){
  const origin=request.headers.get("Origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shinext.site",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8",
  };
}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:cors(request)});}
function clean(value,max=160){return String(value??"").trim().slice(0,max);}
function normalize(value){return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function phone(value){return String(value??"").replace(/\D/g,"").slice(-10);}
function weekdayFromDate(value){const d=new Date(value+"T12:00:00");return Number.isNaN(d.getTime())?-1:d.getDay();}
function roundPrice(value){return Math.max(0,Math.round(Number(value||0)/20)*20);}
function quote(input){
  const base=BASE_PRICE[input.serviceType]??BASE_PRICE.home;
  const cleaning=CLEANING_MULTIPLIER[input.cleaningLevel]??1;
  const size=SIZE_MULTIPLIER[input.spaceSize]??1;
  const recurrence=FREQUENCY_MULTIPLIER[input.frequency]??1;
  const supplies=input.suppliesSource==="shinext"?1.12:1;
  const clientPrice=roundPrice(base*cleaning*size*recurrence*supplies);
  const commissionRate=input.suppliesSource==="shinext"?.2:.15;
  const shinextCommission=clientPrice*commissionRate;
  return {
    clientPrice,
    commissionRate,
    shinextCommission,
    workerEarning:clientPrice-shinextCommission,
    pricingVersion:"2026-10-v1",
  };
}

async function quoteRequest(request){
  const body=await request.json();
  const payload={
    serviceType:clean(body.serviceType,40),
    cleaningLevel:clean(body.cleaningLevel,40),
    spaceSize:clean(body.spaceSize,40),
    frequency:clean(body.frequency,40),
    suppliesSource:clean(body.suppliesSource,40),
  };
  if(!["home","airbnb","office","commerce","industrial"].includes(payload.serviceType))return json(request,{error:"Tipo de servicio inválido."},400);
  if(!["provider","shinext"].includes(payload.suppliesSource))return json(request,{error:"Modalidad de insumos inválida."},400);
  return json(request,quote(payload));
}
async function createLead(request,env){
  const body=await request.json();
  const payload={
    serviceType:clean(body.serviceType,40),
    cleaningLevel:clean(body.cleaningLevel,40),
    zone:clean(body.zone,120),
    requestedDate:clean(body.requestedDate,20),
    timeWindow:clean(body.timeWindow,40),
    spaceSize:clean(body.spaceSize,40),
    frequency:clean(body.frequency,40),
    suppliesSource:clean(body.suppliesSource,40),
    clientName:clean(body.clientName,120),
    clientPhone:phone(body.clientPhone),
    clientEmail:clean(body.clientEmail,160).toLowerCase(),
    details:clean(body.details,700),
    quoteAccepted:body.quoteAccepted===true,
    quotedClientPrice:Number(body.quotedClientPrice||0),
    pricingVersion:clean(body.pricingVersion,40),
  };

  if(!["home","airbnb","office","commerce","industrial"].includes(payload.serviceType))return json(request,{error:"Tipo de servicio inválido."},400);
  if(!payload.zone||!payload.requestedDate||!payload.timeWindow||!payload.clientName||payload.clientPhone.length<10)return json(request,{error:"Completa los datos requeridos."},400);
  if(!["provider","shinext"].includes(payload.suppliesSource))return json(request,{error:"Modalidad de insumos inválida."},400);

  const pricing=quote(payload);
  if(!payload.quoteAccepted)return json(request,{error:"Debes aceptar la cotización antes de solicitar."},400);
  if(payload.pricingVersion!==pricing.pricingVersion||payload.quotedClientPrice!==pricing.clientPrice){
    return json(request,{error:"La cotización cambió. Actualiza el precio antes de continuar.",pricing},409);
  }
  const id=crypto.randomUUID();
  const trackingToken=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const now=new Date().toISOString();

  await env.DB.prepare(`INSERT INTO leads(
    id,service_type,cleaning_level,zone,requested_date,time_window,space_size,frequency,supplies_source,
    details,client_name,client_phone,client_email,status,source,created_at,updated_at,
    client_price,commission_rate,worker_earning,tracking_token,pricing_version,
    quote_confirmed,quote_confirmed_at,payment_status,payment_amount
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','web',?,?,?,?,?,?,?,?,?,?,?)`).bind(
    id,payload.serviceType,payload.cleaningLevel,payload.zone,payload.requestedDate,payload.timeWindow,
    payload.spaceSize,payload.frequency,payload.suppliesSource,payload.details,payload.clientName,
    payload.clientPhone,payload.clientEmail,now,now,pricing.clientPrice,pricing.commissionRate,
    pricing.workerEarning,trackingToken,pricing.pricingVersion,
    1,now,"not_started",pricing.clientPrice
  ).run();

  const weekday=weekdayFromDate(payload.requestedDate);
  const candidates=await env.DB.prepare(`SELECT p.uid,p.zone,p.service_mode,p.service_types,p.rating,p.weekly_load,
    CASE WHEN a.available=1 THEN 1 ELSE 0 END AS is_available
    FROM providers p
    LEFT JOIN provider_availability a ON a.provider_uid=p.uid AND a.weekday=? AND a.time_window=?
    WHERE p.active=1`).bind(weekday,payload.timeWindow).all();

  const scored=(candidates.results||[]).map(provider=>{
    let score=0,types=[];
    try{types=JSON.parse(provider.service_types||"[]");}catch{}
    if(normalize(provider.zone)===normalize(payload.zone))score+=35;
    if(types.includes(payload.serviceType)||types.includes("all"))score+=25;
    if(Number(provider.is_available)===1)score+=25;
    if((payload.suppliesSource==="shinext"&&provider.service_mode==="shinext_partner")||
       (payload.suppliesSource==="provider"&&provider.service_mode==="independent"))score+=10;
    score+=Math.min(10,Number(provider.rating||0)*2);
    score-=Math.min(15,Number(provider.weekly_load||0)*3);
    return {...provider,score};
  }).filter(provider=>provider.score>=35).sort((a,b)=>b.score-a.score).slice(0,3);

  for(let i=0;i<scored.length;i++){
    await env.DB.prepare(`INSERT OR IGNORE INTO offers(
      id,lead_id,provider_uid,rank,score,status,created_at,client_price,commission_rate,worker_earning
    ) VALUES(?,?,?,?,?,'pending',?,?,?,?)`).bind(
      crypto.randomUUID(),id,scored[i].uid,i+1,scored[i].score,now,
      pricing.clientPrice,pricing.commissionRate,pricing.workerEarning
    ).run();
  }

  return json(request,{
    ok:true,
    id,
    folio:id.slice(0,8).toUpperCase(),
    trackingToken,
    matched:scored.length,
    ...pricing,
  },201);
}

async function trackLead(request,env,token){
  if(!/^[a-f0-9]{64}$/i.test(token))return json(request,{error:"Seguimiento inválido."},404);
  const lead=await env.DB.prepare(`SELECT l.service_type,l.zone,l.requested_date,l.time_window,l.status,
    l.client_price,l.pricing_version,l.created_at,l.updated_at,l.assigned_worker_uid,
    p.display_name AS provider_name,p.rating AS provider_rating,p.completed_services AS provider_completed_services,
    CASE WHEN sr.id IS NULL THEN 0 ELSE 1 END AS rating_submitted
    FROM leads l
    LEFT JOIN providers p ON p.uid=l.assigned_worker_uid
    LEFT JOIN service_ratings sr ON sr.lead_id=l.id
    WHERE l.tracking_token=?`).bind(token).first();
  if(!lead)return json(request,{error:"No encontramos esa solicitud."},404);
  const statusLabel={
    pending:"Buscando prestador",
    assigned:"Prestador asignado",
    confirmed:"Servicio confirmado",
    in_progress:"Servicio en curso",
    completed:"Servicio finalizado",
    cancelled:"Solicitud cancelada",
  }[lead.status]||"Solicitud recibida";
  return json(request,{...lead,statusLabel});
}

async function submitRating(request,env,token){
  if(!/^[a-f0-9]{64}$/i.test(token))return json(request,{error:"Seguimiento inválido."},404);
  const body=await request.json();
  const rating=Number(body.rating||0);
  const comment=clean(body.comment,500);
  if(!Number.isInteger(rating)||rating<1||rating>5)return json(request,{error:"Calificación inválida."},400);
  const lead=await env.DB.prepare("SELECT id,status,assigned_worker_uid FROM leads WHERE tracking_token=?").bind(token).first();
  if(!lead)return json(request,{error:"No encontramos esa solicitud."},404);
  if(lead.status!=="completed")return json(request,{error:"Podrás calificar cuando el servicio finalice."},409);
  if(!lead.assigned_worker_uid)return json(request,{error:"No hay prestador asignado para calificar."},409);
  const existing=await env.DB.prepare("SELECT id FROM service_ratings WHERE lead_id=?").bind(lead.id).first();
  if(existing)return json(request,{error:"Este servicio ya fue calificado."},409);
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO service_ratings(id,lead_id,provider_uid,rating,comment,created_at) VALUES(?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),lead.id,lead.assigned_worker_uid,rating,comment,now).run();
  const aggregate=await env.DB.prepare("SELECT AVG(rating) AS avg_rating,COUNT(*) AS rating_count FROM service_ratings WHERE provider_uid=?")
    .bind(lead.assigned_worker_uid).first();
  await env.DB.prepare("UPDATE providers SET rating=?,completed_services=?,updated_at=? WHERE uid=?")
    .bind(Number(aggregate.avg_rating||0),Number(aggregate.rating_count||0),now,lead.assigned_worker_uid).run();
  return json(request,{ok:true,rating:Number(aggregate.avg_rating||rating),completedServices:Number(aggregate.rating_count||1)});
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
    const url=new URL(request.url);
    try{
      if(request.method==="GET"&&url.pathname==="/health")return json(request,{ok:true,service:"shinext-dispatch"});
      if(request.method==="POST"&&url.pathname==="/quote")return quoteRequest(request);
      if(request.method==="POST"&&url.pathname==="/leads")return createLead(request,env);
      const ratingMatch=url.pathname.match(/^\/track\/([a-f0-9]{64})\/rating$/i);
      if(request.method==="POST"&&ratingMatch)return submitRating(request,env,ratingMatch[1]);
      const match=url.pathname.match(/^\/track\/([a-f0-9]{64})$/i);
      if(request.method==="GET"&&match)return trackLead(request,env,match[1]);
      return json(request,{error:"Not found"},404);
    }catch(error){
      console.error(error);
      return json(request,{error:"No se pudo completar la operación."},500);
    }
  }
};
