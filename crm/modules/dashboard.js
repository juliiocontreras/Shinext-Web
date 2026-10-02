export function dashboardView() {
  return {
    title: "Panel",
    kicker: "Resumen operativo",
    html: `
      <section class="crm-hero-card">
        <div><p>Centro de control</p><h2>Lo que necesita atención hoy</h2><span>Los indicadores se alimentarán progresivamente de cada módulo operativo.</span></div>
      </section>
      <section class="crm-metric-grid" id="dashboard-metrics">
        <article><small>Solicitudes sin asignar</small><strong data-metric="unassigned">—</strong></article>
        <article><small>Ofertas pendientes</small><strong data-metric="offers">—</strong></article>
        <article><small>Incidencias abiertas</small><strong data-metric="incidents">—</strong></article>
        <article><small>Insumos reportados</small><strong data-metric="supplies">—</strong></article>
      </section>
      <section class="crm-panel"><div class="crm-panel-head"><div><p>Pendientes</p><h2>Acciones prioritarias</h2></div></div><div id="dashboard-alerts" class="crm-list"><div class="crm-empty">Los pendientes autorizados para tu rol aparecerán aquí.</div></div></section>
    `,
  };
}
