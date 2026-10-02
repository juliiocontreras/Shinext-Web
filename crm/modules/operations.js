export function operationsView() {
  return {
    title: "Operaciones",
    kicker: "Servicios y asignaciones",
    collection: "serviceRequests",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head"><div><p>Operación</p><h2>Solicitudes de servicio</h2></div><span class="crm-chip">Asignación manual</span></div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando solicitudes…</div></div>
      </section>
    `,
    renderItem(item) {
      return `<article class="crm-list-row"><div><small>${item.status||"Nueva"}</small><strong>${item.serviceType||"Servicio de limpieza"}</strong><span>${item.zone||"Zona por confirmar"} · ${item.clientContactName||"Cliente"}</span></div><span class="crm-row-status">${item.assignedWorkerUid?"Asignado":"Pendiente"}</span></article>`;
    }
  };
}
