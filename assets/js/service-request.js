import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { auth, db } from "/assets/js/firebase-client.js";

const form=document.querySelector("#service-request-form");
const submit=document.querySelector("#request-submit");
const statusBox=document.querySelector("#request-status");
const success=document.querySelector("#request-success");
const folio=document.querySelector("#request-folio");

function status(message,kind=""){statusBox.textContent=message;statusBox.dataset.kind=kind;}
function normalizePhone(value){return String(value||"").replace(/\D/g,"").slice(-10);}
function shortFolio(id){return id.slice(0,8).toUpperCase();}

form?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!form.checkValidity()){form.reportValidity();return;}
  submit.disabled=true;
  status("Creando tu solicitud…");
  try{
    const credential=auth.currentUser?{user:auth.currentUser}:await signInAnonymously(auth);
    const data=new FormData(form);
    const phone=normalizePhone(data.get("clientPhone"));
    if(phone.length<10) throw new Error("Ingresa un teléfono válido de 10 dígitos.");
    const requestRef=await addDoc(collection(db, "serviceRequests"),{
      ownerUid:credential.user.uid,
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
      status:"new",
      dispatchStatus:"pending",
      source:"web",
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp(),
    });
    form.hidden=true;
    success.hidden=false;
    folio.textContent=shortFolio(requestRef.id);
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({event:"service_request_created",service_type:String(data.get("serviceType")||"")});
  }catch(error){
    console.error(error);
    status(error?.message||"No pudimos registrar la solicitud. Intenta nuevamente.","error");
    submit.disabled=false;
  }
});