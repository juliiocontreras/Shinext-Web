export function recruitmentView() {
  return {
    title: "Reclutamiento",
    kicker: "Candidatos y expedientes",
    collection: "workerApplications",
    html: `
      <section class="crm-panel">
        <div class="crm-panel-head"><div><p>Expedientes</p><h2>Candidatos</h2></div><span class="crm-chip">Aprobación habilitada</span></div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando candidatos…</div></div>
      </section>
    `,
    renderItem(item) {
      const labels={received:"Recibido",in_review:"En revisión",information_pending:"Información pendiente",approved:"Aprobado",rejected:"Rechazado"};
      return `<article class="crm-list-row"><div><small>${labels[item.status]||item.status||"Recibido"}</small><strong>${item.fullName||"Candidato"}</strong><span>${item.email||""} · ${item.zone||"Zona sin registrar"}</span></div><span class="crm-row-status">${labels[item.status]||"Recibido"}</span></article>`;
    }
  };
}
