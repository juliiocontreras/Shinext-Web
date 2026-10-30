import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { auth, db } from "/assets/js/firebase-client.js";

const DISPATCH_URL = "https://shinext-dispatch.juliiocontreras.workers.dev";
const form=document.querySelector("#service-request-form");
const submit=document.querySelector("#request-submit");
const statusBox=document.querySelector("#request-status");
const success=document.querySelector("#request-success");
const folio=document.querySelector("#request-folio");
const requestPrice=document.querySelector("#request-price");
const trackingLink=document.querySelector("#request-tracking-link");
const requestedDate=form?.elements?.requestedDate;
const serviceSelect=form?.elements?.serviceType;

if(requestedDate){
  const today=new Date();
  const localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  requestedDate.min=localDate;
}
const requestedService=new URLSearchParams(window.location.search).get("service");
if(serviceSelect&&["home","airbnb","office","commerce","industrial"].includes(requestedService)){
  serviceSelect.value=requestedService;
}

function status(message,kind=""){statusBox.textContent=message;statusBox.dataset.kind=kind;}
function normalizePhone(value){return String(value||"").replace(/\D/g,"").slice(-10);}

async function mirrorLeadToFirestore(payload){
  try{
    const credential=auth.currentUser?{user:auth.currentUser}:await signInAnonymously(auth);
    await addDoc(collection(db,"serviceRequests"),{
      ownerUid:credential.user.uid,
      ...payload,
      status:"new",
      dispatchStatus:"pending",
      source:"web",
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp(),
    });
  }catch(error){
    console.warn("Shinext Firestore lead mirror unavailable.",error);
  }
}

form?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!form.checkValidity()){form.reportValidity();return;}
  submit.disabled=true;
  status("Buscando disponibilidad…");
  try{
    const data=new FormData(form);
    const phone=normalizePhone(data.get("clientPhone"));
    if(phone.length<10) throw new Error("Ingresa un teléfono válido de 10 dígitos.");

    const payload={
      serviceType:String(data.get("serviceType")||""),
      cleaningLevel:String(data.get("cleaningLevel")||""),
      zone:String(data.get("zone")||"").trim(),
      requestedDate:String(data.get("requestedDate")||""),
      timeWindow:String(data.get("timeWindow")||""),
      spaceSize:String(data.get("spaceSize")||""),
      frequency:String(data.get("frequency")||"once"),
      suppliesSource:String(data.get("suppliesSource")||"provider"),
      details:String(data.get("details")||"").trim(),
      clientName:String(data.get("clientName")||"").trim(),
      clientPhone:phone,
      clientEmail:String(data.get("clientEmail")||"").trim().toLowerCase(),
    };

    const response=await fetch(`${DISPATCH_URL}/leads`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error||"No pudimos registrar la solicitud.");

    void mirrorLeadToFirestore(payload);

    form.hidden=true;
    success.hidden=false;
    folio.textContent=result.folio||String(result.id||"").slice(0,8).toUpperCase();
    if(requestPrice&&Number(result.clientPrice||0)>0){
      requestPrice.textContent=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(result.clientPrice);
    }
    if(trackingLink&&result.trackingToken){
      trackingLink.href=`/seguimiento/?token=${encodeURIComponent(result.trackingToken)}`;
    }
    const successText=success.querySelector("p");
    if(successText&&Number(result.matched||0)>0){
      successText.insertAdjacentText("beforeend", ` Encontramos ${result.matched} prestador(es) compatibles para iniciar la asignación.`);
    }
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({
      event:"service_request_created",
      service_type:payload.serviceType,
      matched:Number(result.matched||0),
    });
  }catch(error){
    console.error(error);
    status(error?.message||"No pudimos registrar la solicitud. Intenta nuevamente.","error");
    submit.disabled=false;
  }
});