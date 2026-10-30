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
  };

  if(!["home","airbnb","office","commerce","industrial"].includes(payload.serviceType))return json(request,{error:"Tipo de servicio inválido."},400);
  if(!payload.zone||!payload.requestedDate||!payload.timeWindow||!payload.clientName||payload.clientPhone.length<10)return json(request,{error:"Completa los datos requeridos."},400);
  if(!["provider","shinext"].includes(payload.suppliesSource))return json(request,{error:"Modalidad de insumos inválida."},400);

  const pricing=quote(payload);
  const id=crypto.randomUUID();
  const trackingToken=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const now=new Date().toISOString();

  await env.DB.prepare(`INSERT INTO leads(
    id,service_type,cleaning_level,zone,requested_date,time_window,space_size,frequency,supplies_source,
    details,client_name,client_phone,client_email,status,source,created_at,updated_at,
    client_price,commission_rate,worker_earning,tracking_token,pricing_version
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','web',?,?,?,?,?,?,?,?)`).bind(
    id,payload.serviceType,payload.cleaningLevel,payload.zone,payload.requestedDate,payload.timeWindow,
    payload.spaceSize,payload.frequency,payload.suppliesSource,payload.details,payload.clientName,
    payload.clientPhone,payload.clientEmail,now,now,pricing.clientPrice,pricing.commissionRate,
    pricing.workerEarning,trackingToken,pricing.pricingVersion
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
  const lead=await env.DB.prepare(`SELECT service_type,zone,requested_date,time_window,status,
    client_price,pricing_version,created_at,updated_at
    FROM leads WHERE tracking_token=?`).bind(token).first();
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

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
    const url=new URL(request.url);
    try{
      if(request.method==="GET"&&url.pathname==="/health")return json(request,{ok:true,service:"shinext-dispatch"});
      if(request.method==="POST"&&url.pathname==="/leads")return createLead(request,env);
      const match=url.pathname.match(/^\/track\/([a-f0-9]{64})$/i);
      if(request.method==="GET"&&match)return trackLead(request,env,match[1]);
      return json(request,{error:"Not found"},404);
    }catch(error){
      console.error(error);
      return json(request,{error:"No se pudo completar la operación."},500);
    }
  }
};
