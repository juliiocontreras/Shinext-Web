const DISPATCH_URL="https://shinext-dispatch.juliiocontreras.workers.dev";
const params=new URLSearchParams(window.location.search);
const token=params.get("token")||"";
const loading=document.querySelector("#tracking-loading");
const result=document.querySelector("#tracking-result");
const error=document.querySelector("#tracking-error");
const providerCard=document.querySelector("#tracking-provider");
const providerName=document.querySelector("#tracking-provider-name");
const providerRating=document.querySelector("#tracking-provider-rating");
const ratingForm=document.querySelector("#rating-form");
const ratingStatus=document.querySelector("#rating-status");
const recurrenceControls=document.querySelector("#recurrence-controls");
const recurrenceLabel=document.querySelector("#recurrence-label");
const recurrenceHelper=document.querySelector("#recurrence-helper");
const recurrenceToggle=document.querySelector("#recurrence-toggle");
const repeatForm=document.querySelector("#repeat-service-form");
const repeatStatus=document.querySelector("#repeat-status");
let currentTracking=null;

const serviceLabels={home:"Casa y hogar",airbnb:"Airbnb",office:"Oficina",commerce:"Comercio",industrial:"Industrial"};
const timeLabels={morning:"Mañana · 8:00–12:00",afternoon:"Tarde · 12:00–17:00",evening:"Tarde-noche · 17:00–20:00"};
const order=["pending","assigned","confirmed","in_progress","completed"];

function money(value){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));}
function showError(){if(loading)loading.hidden=true;if(result)result.hidden=true;if(error)error.hidden=false;}

async function load(){
  if(!/^[a-f0-9]{64}$/i.test(token)){showError();return;}
  try{
    const response=await fetch(`${DISPATCH_URL}/track/${encodeURIComponent(token)}`,{cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||"Not found");

    document.querySelector("#tracking-status").textContent=data.statusLabel||"Solicitud recibida";
    document.querySelector("#tracking-service").textContent=serviceLabels[data.service_type]||data.service_type||"Servicio de limpieza";
    document.querySelector("#tracking-zone").textContent=data.zone||"Por confirmar";
    document.querySelector("#tracking-date").textContent=data.requested_date||"Por confirmar";
    document.querySelector("#tracking-time").textContent=timeLabels[data.time_window]||data.time_window||"Por confirmar";
    document.querySelector("#tracking-price").textContent=Number(data.client_price||0)>0?money(data.client_price):"Por confirmar";
    if(data.provider_name){
      providerCard.hidden=false;
      providerName.textContent=data.provider_name;
      providerRating.textContent=Number(data.provider_rating||0)>0
        ? `${Number(data.provider_rating).toFixed(1)}★ · ${Number(data.provider_completed_services||0)} servicio(s) calificado(s)`
        : "Prestador verificado · sin calificaciones todavía";
    }
    if(ratingForm){
      ratingForm.hidden=!(data.status==="completed"&&!data.rating_submitted);
      if(data.rating_submitted){
        ratingStatus.textContent="Gracias. Tu calificación ya fue registrada.";
      }
    }
    currentTracking=data;
    const recurring=data.frequency&&data.frequency!=="once";
    if(recurrenceControls){
      recurrenceControls.hidden=!recurring;
      if(recurring){
        const active=data.recurrence_status!=="paused";
        recurrenceLabel.textContent=active?"Plan activo":"Plan pausado";
        recurrenceHelper.textContent=active
          ?"La recurrencia sigue activa. Puedes pausarla cuando quieras."
          :"No se generarán nuevas solicitudes recurrentes mientras esté pausado.";
        recurrenceToggle.textContent=active?"Pausar recurrencia":"Reactivar recurrencia";
        recurrenceToggle.dataset.nextStatus=active?"paused":"active";
      }
    }
    if(repeatForm){
      repeatForm.hidden=data.status!=="completed";
      const dateInput=repeatForm.elements.requestedDate;
      if(dateInput&&!dateInput.min){
        const now=new Date();
        dateInput.min=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
      }
    }

    const currentIndex=Math.max(0,order.indexOf(data.status));
    document.querySelectorAll("[data-step]").forEach((step,index)=>{
      step.classList.toggle("active",index<=currentIndex);
      step.classList.toggle("current",index===currentIndex);
    });

    loading.hidden=true;
    result.hidden=false;
  }catch{
    showError();
  }
}
recurrenceToggle?.addEventListener("click",async()=>{
  const nextStatus=recurrenceToggle.dataset.nextStatus;
  if(!nextStatus) return;
  recurrenceToggle.disabled=true;
  recurrenceToggle.textContent="Actualizando…";
  try{
    const response=await fetch(`${DISPATCH_URL}/track/${encodeURIComponent(token)}/recurrence`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status:nextStatus}),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||"No pudimos actualizar la recurrencia.");
    await load();
  }catch(error){
    recurrenceHelper.textContent=error.message;
    recurrenceToggle.textContent=nextStatus==="paused"?"Pausar recurrencia":"Reactivar recurrencia";
  }finally{
    recurrenceToggle.disabled=false;
  }
});

repeatForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const data=new FormData(repeatForm);
  const requestedDate=String(data.get("requestedDate")||"");
  const timeWindow=String(data.get("timeWindow")||"");
  const preferSameProvider=data.get("preferSameProvider")==="on";
  const button=repeatForm.querySelector('button[type="submit"]');
  button.disabled=true;
  repeatStatus.textContent="Buscando disponibilidad…";
  try{
    const response=await fetch(`${DISPATCH_URL}/track/${encodeURIComponent(token)}/repeat`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestedDate,timeWindow,preferSameProvider}),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||"No pudimos repetir el servicio.");
    repeatStatus.innerHTML=`Nueva solicitud creada: <strong>${body.folio||""}</strong>. Precio: <strong>${money(body.clientPrice)}</strong>.`;
    if(body.trackingToken){
      const link=document.createElement("a");
      link.href=`/seguimiento/?token=${encodeURIComponent(body.trackingToken)}`;
      link.textContent=" Ver nueva solicitud";
      repeatStatus.appendChild(link);
    }
    repeatForm.querySelectorAll("input,select,button").forEach(node=>node.disabled=true);
  }catch(error){
    repeatStatus.textContent=error.message;
    button.disabled=false;
  }
});

ratingForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const formData=new FormData(ratingForm);
  const rating=Number(formData.get("rating")||0);
  const comment=String(formData.get("comment")||"").trim();
  const button=ratingForm.querySelector('button[type="submit"]');
  if(rating<1||rating>5){
    ratingStatus.textContent="Selecciona una calificación de 1 a 5.";
    return;
  }
  button.disabled=true;
  ratingStatus.textContent="Guardando tu calificación…";
  try{
    const response=await fetch(`${DISPATCH_URL}/track/${encodeURIComponent(token)}/rating`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({rating,comment}),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||"No pudimos guardar tu calificación.");
    ratingStatus.textContent="Gracias. Tu calificación quedó registrada.";
    ratingForm.querySelectorAll("input,textarea,button").forEach(node=>node.disabled=true);
    await load();
  }catch(error){
    ratingStatus.textContent=error.message;
    button.disabled=false;
  }
});

load();