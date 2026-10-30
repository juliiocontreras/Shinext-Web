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
  }[value] || value || "Por confirmar";
}

function renderLead(item){
  const date=[item.requested_date,item.time_window].filter(Boolean).join(" · ");
  return `<article class="crm-list-row">
    <div>
      <small>${esc(label(item.status))} · ${esc(date)}</small>
      <strong>${esc(label(item.service_type))}</strong>
      <span>${esc(item.zone||"Zona por confirmar")} · ${esc(item.client_name||"Cliente")} · ${esc(item.client_phone||"")}</span>
      <span>${item.supplies_source==="shinext"?"Insumos Shinext Partner":"Prestador lleva insumos"} · ${esc(item.frequency||"once")}</span>
    </div>
    <span class="crm-row-status">${item.assigned_worker_uid?"Asignado":"Pendiente"}</span>
  </article>`;
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
          <span class="crm-chip">Autoasignación + fallback manual</span>
        </div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando solicitudes…</div></div>
      </section>
    `,
    renderItem(item) {
      return `<article class="crm-list-row"><div><small>${esc(item.status||"Nueva")}</small><strong>${esc(item.serviceType||"Servicio de limpieza")}</strong><span>${esc(item.zone||"Zona por confirmar")} · ${esc(item.clientContactName||item.clientName||"Cliente")}</span></div><span class="crm-row-status">${item.assignedWorkerUid?"Asignado":"Pendiente"}</span></article>`;
    },
    async mount(){
      const list=document.querySelector("#module-list");
      try{
        if(!auth.currentUser) return;
        const token=await auth.currentUser.getIdToken();
        const response=await fetch(`${ADMIN_API}/leads`,{
          headers:{Authorization:`Bearer ${token}`},
        });
        if(!response.ok) return;
        const payload=await response.json();
        const leads=Array.isArray(payload.leads)?payload.leads:[];
        list.innerHTML=leads.length
          ? leads.map(renderLead).join("")
          : '<div class="crm-empty">No hay solicitudes para mostrar.</div>';
      }catch{
        // Keep the Firestore-rendered fallback already loaded by the CRM shell.
      }
    }
  };
}
