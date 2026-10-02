export function salesView() {
  return {
    title: "Ventas",
    kicker: "Clientes y oportunidades",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head"><div><p>Ventas</p><h2>Seguimiento comercial</h2></div><span class="crm-chip">Preparado para crecimiento</span></div>
        <div class="crm-empty">El módulo queda reservado para prospectos, clientes, cotizaciones y recurrencias. Se conectará cuando el flujo comercial de clientes pase a Firestore.</div>
      </section>
    `,
  };
}
