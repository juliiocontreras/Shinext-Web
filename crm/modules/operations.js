import { auth } from "/assets/js/firebase-client.js";

const ADMIN_API = "https://shinext-admin.juliiocontreras.workers.dev";

function esc(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function label(value){
  return {
    home:"Casa y hogar",
    airbnb:"Airbnb",
    office:"Oficina",
    commerce:"Comercio",
    industrial:"Industrial",
    pending:"Nueva",
    assigned:"Asignada",
    confirmed:"Confirmada",
    in_progress:"En curso",
    completed:"Finalizada",
    cancelled:"Cancelada",
  }[value] || value || "Por confirmar";
}

function money(value){
  return new Intl.NumberFormat("es-MX",{
    style:"currency",
    currency:"MXN",
    maximumFractionDigits:0,
  }).format(Number(value||0));
}

function lifecycleAction(item){
  if(item.status==="assigned") return {status:"confirmed",label:"Confirmar servicio"};
  if(item.status==="confirmed") return {status:"in_progress",label:"Iniciar servicio"};
  if(item.status==="in_progress") return {status:"completed",label:"Marcar finalizado"};
  return null;
}

function renderLead(item){
  const date=[item.requested_date,item.time_window].filter(Boolean).join(" · ");
  const action=lifecycleAction(item);
  return `<article class="crm-list-row crm-service-row" data-lead-id="${esc(item.id)}">
    <div>
      <small>${esc(label(item.status))} · ${esc(date)}</small>
      <strong>${esc(label(item.service_type))} · ${money(item.client_price)}</strong>
      <span>${esc(item.zone||"Zona por confirmar")} · ${esc(item.client_name||"Cliente")} · ${esc(item.client_phone||"")}</span>
      <span>${item.supplies_source==="shinext"?"Insumos Shinext Partner":"Prestador lleva insumos"} · ${esc(item.frequency||"once")}</span>
      <span>Prestador: ${item.assigned_worker_uid?esc(item.assigned_worker_uid):"Pendiente de asignación"} · Ganancia: ${money(item.worker_earning)}</span>
      <span>Reputación: ${Number(item.provider_rating||0)>0?`${Number(item.provider_rating).toFixed(1)}★ · ${Number(item.completed_services||0)} servicio(s)`:"Sin historial"}${Number(item.provider_rating||0)>0&&Number(item.provider_rating)<4?" · Revisar calidad":""}</span>
      <span>Comisión Shinext: ${Number(item.commission_rate||0)*100}% · Pago: ${item.payment_status==="paid"?"Pagado":item.payment_status==="pending"?"Pendiente":"Aún no iniciado"}</span>
    </div>
    <div class="crm-service-actions">
      <span class="crm-row-status">${esc(label(item.status))}</span>
      ${action?`<button class="crm-primary-button crm-inline-action" type="button" data-lead-status="${action.status}">${action.label}</button>`:""}
    </div>
  </article>`;
}

async function adminFetch(path,options={}){
  if(!auth.currentUser) throw new Error("Inicia sesión.");
  const token=await auth.currentUser.getIdToken();
  const response=await fetch(`${ADMIN_API}${path}`,{
    ...options,
    headers:{
      "Content-Type":"application/json",
      Authorization:`Bearer ${token}`,
      ...(options.headers||{}),
    },
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error||"No se pudo completar la acción.");
  return body;
}

async function loadCloudLeads(){
  const payload=await adminFetch("/leads");
  return Array.isArray(payload.leads)?payload.leads:[];
}

async function renderCloudLeads(){
  const list=document.querySelector("#module-list");
  if(!list) return;
  const leads=await loadCloudLeads();
  list.innerHTML=leads.length
    ? leads.map(renderLead).join("")
    : '<div class="crm-empty">No hay solicitudes para mostrar.</div>';

  list.querySelectorAll("[data-lead-status]").forEach(button=>{
    button.addEventListener("click",async()=>{
      const row=button.closest("[data-lead-id]");
      const leadId=row?.dataset.leadId;
      if(!leadId) return;
      button.disabled=true;
      const original=button.textContent;
      button.textContent="Actualizando…";
      try{
        await adminFetch(`/leads/${encodeURIComponent(leadId)}/status`,{
          method:"POST",
          body:JSON.stringify({status:button.dataset.leadStatus}),
        });
        await renderCloudLeads();
      }catch(error){
        button.disabled=false;
        button.textContent=original;
        window.alert(error.message);
      }
    });
  });
}

export function operationsView() {
  return {
    title: "Operaciones",
    kicker: "Servicios y asignaciones",
    collection: "serviceRequests",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head">
          <div><p>Operación</p><h2>Solicitudes de servicio</h2></div>
          <span class="crm-chip">Autoasignación activa</span>
        </div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando solicitudes…</div></div>
      </section>
    `,
    renderItem(item) {
      return `<article class="crm-list-row"><div><small>${esc(item.status||"Nueva")}</small><strong>${esc(item.serviceType||"Servicio de limpieza")}</strong><span>${esc(item.zone||"Zona por confirmar")} · ${esc(item.clientContactName||item.clientName||"Cliente")}</span></div><span class="crm-row-status">${item.assignedWorkerUid?"Asignado":"Pendiente"}</span></article>`;
    },
    async mount(){
      try{
        await renderCloudLeads();
      }catch{
        // Keep the Firestore-rendered fallback already loaded by the CRM shell.
      }
    }
  };
}
