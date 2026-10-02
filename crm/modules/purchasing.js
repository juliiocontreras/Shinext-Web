export function purchasingView() {
  return {
    title: "Compras",
    kicker: "Insumos e inventario",
    collection: "supplyRequests",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head"><div><p>Solicitudes</p><h2>Faltantes reportados</h2></div></div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando solicitudes…</div></div>
      </section>
    `,
    renderItem(item) {
      const labels={reported:"Reportado",reviewed:"Revisado",preparing_purchasing:"Preparando / comprando",ready_for_delivery:"Listo para entrega",delivered:"Entregado"};
      return `<article class="crm-list-row"><div><small>${item.category||"Insumo"}</small><strong>${item.item||"Solicitud de insumo"}</strong><span>Cantidad ${item.quantity||1} · Trabajador ${item.workerUid||""}</span></div><span class="crm-row-status">${labels[item.status]||"Reportado"}</span></article>`;
    }
  };
}
