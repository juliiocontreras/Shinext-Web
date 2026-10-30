import { db, firebaseCapabilities, functions } from "/assets/js/firebase-client.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";

function sparkSafeCallable(name){
  const invoke=httpsCallable(functions,name);
  return async payload=>{
    if(!firebaseCapabilities.functions){
      const error=new Error("Esta acción está temporalmente deshabilitada mientras Shinext opera en modo gratuito de Firebase.");
      error.code="shinext/spark-mode";
      throw error;
    }
    return invoke(payload);
  };
}

const saveMediaEmbed=sparkSafeCallable("saveMediaEmbed");
const saveBannerCampaign=sparkSafeCallable("saveBannerCampaign");

function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

async function refreshLists(){
  const [mediaSnap,bannerSnap]=await Promise.all([
    getDocs(collection(db,"mediaEmbeds")),
    getDocs(collection(db,"bannerCampaigns"))
  ]);
  const media=document.querySelector("#content-media-list");
  const banners=document.querySelector("#content-banner-list");
  if(media) media.innerHTML=mediaSnap.empty?'<div class="crm-empty">Aún no hay videos administrados.</div>':mediaSnap.docs.map(d=>{const x=d.data();return `<article class="crm-list-row"><div><small>${esc(x.provider||"video")} · ${esc(x.articleSlug||"")}</small><strong>${esc(x.title||"Video")}</strong><span>${x.active===false?"Inactivo":"Activo"}</span></div><span class="crm-row-status">${esc(x.provider||"video")}</span></article>`;}).join("");
  if(banners) banners.innerHTML=bannerSnap.empty?'<div class="crm-empty">Aún no hay banners administrados.</div>':bannerSnap.docs.map(d=>{const x=d.data();return `<article class="crm-list-row"><div><small>${esc(x.placement||"banner")}</small><strong>${esc(x.title||"Campaña")}</strong><span>${esc(x.text||"")}</span></div><span class="crm-row-status">${x.active===false?"Inactivo":"Activo"}</span></article>`;}).join("");
}

export function contentView(){
 return{
  title:"Contenido",
  kicker:"Blog, videos y banners",
  html:`
   <section class="crm-content-grid">
    <article class="crm-panel">
      <div class="crm-panel-head"><div><p>Multimedia</p><h2>Enlazar video al Blog</h2></div><span class="crm-chip">YouTube / TikTok</span></div>
      <form id="media-form" class="crm-form">
       <label>Artículo (slug)<input name="articleSlug" required placeholder="limpieza-profunda-vs-mantenimiento"></label>
       <label>Título del video<input name="title" required maxlength="160" placeholder="Consejos Shinext"></label>
       <label>URL oficial<input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=..."></label>
       <label>Descripción<input name="description" maxlength="300"></label>
       <label>Miniatura <small>(opcional, recomendada para VideoObject)</small><input name="thumbnailUrl" type="url" placeholder="https://..."></label>
       <label>Fecha de publicación <small>(opcional)</small><input name="publishedAt" type="date"></label>
       <button class="crm-primary-button" type="submit">Guardar video</button>
       <div id="media-form-status" class="crm-status" aria-live="polite"></div>
      </form>
    </article>
    <article class="crm-panel">
      <div class="crm-panel-head"><div><p>Campañas</p><h2>Crear banner</h2></div></div>
      <form id="banner-form" class="crm-form">
       <label>Ubicación<select name="placement"><option value="hero">Hero</option><option value="services">Servicios</option><option value="cta">CTA</option><option value="blog">Blog</option><option value="distributor">Distribuidores</option></select></label>
       <label>Título<input name="title" required maxlength="160"></label>
       <label>Texto<textarea name="text" required maxlength="300" rows="3"></textarea></label>
       <label>Texto del botón<input name="cta" required maxlength="80" value="Conocer más"></label>
       <label>Enlace<input name="href" required placeholder="/blog/... o https://..."></label>
       <div class="crm-form-split"><label>Audiencia<select name="audience"><option value="client">Clientes</option><option value="worker">Trabajadores</option><option value="both">Ambos</option></select></label><label>Dispositivo<select name="device"><option value="all">Todos</option><option value="mobile">Móvil</option><option value="desktop">Escritorio</option></select></label></div>
       <label>Prioridad<input name="priority" type="number" min="0" max="999" value="0"></label>
       <button class="crm-primary-button" type="submit">Crear banner</button>
       <div id="banner-form-status" class="crm-status" aria-live="polite"></div>
      </form>
    </article>
   </section>
   <section class="crm-content-grid crm-content-lists">
    <article class="crm-panel"><div class="crm-panel-head"><div><p>Videos</p><h2>Multimedia registrada</h2></div></div><div id="content-media-list" class="crm-list"><div class="crm-empty">Cargando…</div></div></article>
    <article class="crm-panel"><div class="crm-panel-head"><div><p>Banners</p><h2>Campañas registradas</h2></div></div><div id="content-banner-list" class="crm-list"><div class="crm-empty">Cargando…</div></div></article>
   </section>
  `,
  async mount(){
    await refreshLists();
    const mediaForm=document.querySelector("#media-form");
    const bannerForm=document.querySelector("#banner-form");
    mediaForm?.addEventListener("submit",async e=>{
      e.preventDefault();const s=document.querySelector("#media-form-status");s.textContent="Guardando…";
      try{
        await saveMediaEmbed({
          articleSlug:mediaForm.articleSlug.value.trim(),
          title:mediaForm.title.value.trim(),
          url:mediaForm.url.value.trim(),
          description:mediaForm.description.value.trim(),
          thumbnailUrl:mediaForm.thumbnailUrl.value.trim(),
          publishedAt:mediaForm.publishedAt.value||null,
          active:true
        });
        mediaForm.reset();s.textContent="Video guardado y listo para el artículo.";s.dataset.kind="success";await refreshLists();
      }catch(err){s.textContent=err?.message||"No se pudo guardar el video.";s.dataset.kind="error";}
    });
    bannerForm?.addEventListener("submit",async e=>{
      e.preventDefault();const s=document.querySelector("#banner-form-status");s.textContent="Guardando…";
      try{
        await saveBannerCampaign({
          placement:bannerForm.placement.value,
          title:bannerForm.title.value.trim(),
          text:bannerForm.text.value.trim(),
          cta:bannerForm.cta.value.trim(),
          href:bannerForm.href.value.trim(),
          audience:bannerForm.audience.value,
          device:bannerForm.device.value,
          priority:Number(bannerForm.priority.value||0),
          active:true
        });
        bannerForm.reset();s.textContent="Banner creado.";s.dataset.kind="success";await refreshLists();
      }catch(err){s.textContent=err?.message||"No se pudo crear el banner.";s.dataset.kind="error";}
    });
  }
 };
}
