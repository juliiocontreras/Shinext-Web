import { db } from "/assets/js/firebase-client.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

function esc(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function refreshInventory(){
  const [inventorySnap,checklistSnap]=await Promise.all([
    getDocs(collection(db,"inventory")),
    getDocs(collection(db,"supplyChecklists")),
  ]);
  const inventory=document.querySelector("#inventory-list");
  const checklists=document.querySelector("#checklist-list");

  if(inventory){
    inventory.innerHTML=inventorySnap.empty
      ? '<div class="crm-empty">Aún no hay inventario registrado.</div>'
      : inventorySnap.docs.map(d=>{
          const x=d.data();
          return `<article class="crm-list-row">
            <div><small>${esc(x.category||"Insumo")}</small><strong>${esc(x.name||"Insumo")}</strong><span>Existencia: ${Number(x.stock||0)} ${esc(x.unit||"pz")} · mínimo ${Number(x.minimumStock||0)}</span></div>
            <button class="crm-danger-button" type="button" data-delete-inventory="${esc(d.id)}">Eliminar</button>
          </article>`;
        }).join("");
  }

  if(checklists){
    checklists.innerHTML=checklistSnap.empty
      ? '<div class="crm-empty">Aún no hay checklists configurados.</div>'
      : checklistSnap.docs.map(d=>{
          const x=d.data();
          const items=Array.isArray(x.items)?x.items:[];
          return `<article class="crm-list-row">
            <div><small>${esc(x.serviceType||"Servicio")}</small><strong>${esc(x.title||"Checklist")}</strong><span>${items.map(esc).join(" · ")}</span></div>
            <button class="crm-danger-button" type="button" data-delete-checklist="${esc(d.id)}">Eliminar</button>
          </article>`;
        }).join("");
  }

  document.querySelectorAll("[data-delete-inventory]").forEach(button=>{
    button.addEventListener("click",async()=>{
      await deleteDoc(doc(db,"inventory",button.dataset.deleteInventory));
      await refreshInventory();
    });
  });
  document.querySelectorAll("[data-delete-checklist]").forEach(button=>{
    button.addEventListener("click",async()=>{
      await deleteDoc(doc(db,"supplyChecklists",button.dataset.deleteChecklist));
      await refreshInventory();
    });
  });
}

export function purchasingView() {
  return {
    title: "Insumos y recursos",
    kicker: "Shinext Partners",
    collection: "supplyRequests",
    html: `
      <section class="crm-content-grid">
        <article class="crm-panel">
          <div class="crm-panel-head"><div><p>Inventario</p><h2>Existencias Shinext</h2></div><span class="crm-chip">Partners</span></div>
          <form id="inventory-form" class="crm-form">
            <label>Insumo<input name="name" required maxlength="120" placeholder="Desengrasante"></label>
            <div class="crm-form-split">
              <label>Categoría<select name="category"><option value="cleaning_products">Productos</option><option value="tools">Herramientas</option><option value="uniform">Uniforme</option></select></label>
              <label>Unidad<input name="unit" required maxlength="30" value="pz"></label>
            </div>
            <div class="crm-form-split">
              <label>Existencia<input name="stock" type="number" min="0" step="0.01" required value="0"></label>
              <label>Mínimo<input name="minimumStock" type="number" min="0" step="0.01" required value="0"></label>
            </div>
            <button class="crm-primary-button" type="submit">Agregar al inventario</button>
            <div id="inventory-status" class="crm-status" aria-live="polite"></div>
          </form>
        </article>

        <article class="crm-panel">
          <div class="crm-panel-head"><div><p>Checklist</p><h2>Insumos por servicio</h2></div></div>
          <form id="checklist-form" class="crm-form">
            <label>Tipo de servicio<input name="serviceType" required maxlength="80" placeholder="Limpieza de hogar"></label>
            <label>Título<input name="title" required maxlength="120" placeholder="Kit básico"></label>
            <label>Lista de insumos <small>Uno por línea</small><textarea name="items" required rows="6" placeholder="Limpiador multiusos\nMicrofibras\nGuantes"></textarea></label>
            <button class="crm-primary-button" type="submit">Guardar checklist</button>
            <div id="checklist-status" class="crm-status" aria-live="polite"></div>
          </form>
        </article>
      </section>

      <section class="crm-content-grid crm-content-lists">
        <article class="crm-panel"><div class="crm-panel-head"><div><p>Stock</p><h2>Inventario actual</h2></div></div><div id="inventory-list" class="crm-list"><div class="crm-empty">Cargando…</div></div></article>
        <article class="crm-panel"><div class="crm-panel-head"><div><p>Preparación</p><h2>Checklists activos</h2></div></div><div id="checklist-list" class="crm-list"><div class="crm-empty">Cargando…</div></div></article>
      </section>

      <section class="crm-panel crm-content-lists">
        <div class="crm-panel-head"><div><p>Solicitudes</p><h2>Faltantes reportados por Partners</h2></div></div>
        <div id="module-list" class="crm-list"><div class="crm-empty">Cargando solicitudes…</div></div>
      </section>
    `,
    renderItem(item) {
      const labels={reported:"Reportado",reviewed:"Revisado",preparing_purchasing:"Preparando / comprando",ready_for_delivery:"Listo para entrega",delivered:"Entregado"};
      return `<article class="crm-list-row"><div><small>${esc(item.category||"Insumo")}</small><strong>${esc(item.item||"Solicitud de insumo")}</strong><span>Cantidad ${Number(item.quantity||1)} · Partner ${esc(item.workerUid||"")}</span></div><span class="crm-row-status">${labels[item.status]||"Reportado"}</span></article>`;
    },
    async mount(){
      const inventoryForm=document.querySelector("#inventory-form");
      const checklistForm=document.querySelector("#checklist-form");

      inventoryForm?.addEventListener("submit",async event=>{
        event.preventDefault();
        const status=document.querySelector("#inventory-status");
        status.textContent="Guardando…";
        try{
          await addDoc(collection(db,"inventory"),{
            name:inventoryForm.name.value.trim(),
            category:inventoryForm.category.value,
            unit:inventoryForm.unit.value.trim(),
            stock:Number(inventoryForm.stock.value||0),
            minimumStock:Number(inventoryForm.minimumStock.value||0),
            updatedAt:serverTimestamp(),
          });
          inventoryForm.reset();
          status.textContent="Inventario actualizado.";
          status.dataset.kind="success";
          await refreshInventory();
        }catch(error){
          status.textContent=error?.message||"No se pudo guardar.";
          status.dataset.kind="error";
        }
      });

      checklistForm?.addEventListener("submit",async event=>{
        event.preventDefault();
        const status=document.querySelector("#checklist-status");
        status.textContent="Guardando…";
        try{
          const items=checklistForm.items.value.split("\n").map(x=>x.trim()).filter(Boolean);
          await addDoc(collection(db,"supplyChecklists"),{
            serviceType:checklistForm.serviceType.value.trim(),
            title:checklistForm.title.value.trim(),
            items,
            active:true,
            updatedAt:serverTimestamp(),
          });
          checklistForm.reset();
          status.textContent="Checklist guardado.";
          status.dataset.kind="success";
          await refreshInventory();
        }catch(error){
          status.textContent=error?.message||"No se pudo guardar.";
          status.dataset.kind="error";
        }
      });

      await refreshInventory();
    }
  };
}
