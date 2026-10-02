export function accountingView() {
  return {
    title: "Contabilidad",
    kicker: "Ganancias y pagos",
    collection: "workerEarnings",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head"><div><p>Finanzas V1</p><h2>Pagos a Trabajadores Shinext</h2></div></div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando movimientos…</div></div>
      </section>
    `,
    renderItem(item) {
      const money=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(item.amount||0));
      return `<article class="crm-list-row"><div><small>${item.paymentStatus==="paid"?"Pagado":"Pendiente"}</small><strong>${money}</strong><span>Servicio ${item.serviceId||""} · Trabajador ${item.workerUid||""}</span></div><span class="crm-row-status">${item.paymentStatus==="paid"?"Pagado":"Pendiente"}</span></article>`;
    }
  };
}
