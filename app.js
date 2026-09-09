document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/overrides.css">');
const installButton = document.querySelector('#install-app');
const status = document.querySelector('#install-status');
const year = document.querySelector('#year');
let deferredPrompt = null;
if (year) year.textContent = new Date().getFullYear();

window.dataLayer = window.dataLayer || [];
function track(name, params = {}) { window.dataLayer.push({ event: name, ...params }); }

document.querySelectorAll('[data-conversion]').forEach((element) => {
  element.addEventListener('click', () => track(element.dataset.conversion, { page_location: window.location.href }));
});

// Firebase-ready banner contract. Replace this local array with Firestore data when the CRM is connected.
window.ShinextBanners = window.ShinextBanners || [
  {
    id: 'distribuidores-01', type: 'distributor', placement: 'distributor',
    title: '¿Eres distribuidor de productos de limpieza?',
    text: 'Buscamos alianzas con proveedores para ofrecer mejores condiciones a nuestra operación.',
    cta: 'Contáctanos', href: 'https://wa.me/522291437041?text=Hola%20Shinext,%20soy%20distribuidor%20de%20productos%20de%20limpieza',
    active: true, audience: 'both', device: 'all'
  }
];

function bannerMatches(banner, placement) {
  if (!banner || banner.active !== true || banner.placement !== placement) return false;
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  return banner.device === 'all' || (mobile && banner.device === 'mobile') || (!mobile && banner.device === 'desktop');
}

function renderBanners() {
  document.querySelectorAll('[data-banner-placement]').forEach((slot) => {
    const placement = slot.dataset.bannerPlacement;
    const banner = window.ShinextBanners.find((item) => bannerMatches(item, placement));
    if (!banner) return;
    const link = document.createElement('a');
    link.className = `campaign-banner campaign-banner-${banner.type || 'standard'}`;
    link.href = banner.href || '#';
    link.dataset.bannerId = banner.id;
    if (/^https:\/\//.test(link.href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    link.innerHTML = `<div class="campaign-banner-copy"><span class="campaign-banner-kicker">${banner.type === 'distributor' ? 'Alianzas Shinext' : 'Promoción'}</span><strong>${banner.title}</strong><span>${banner.text}</span><b>${banner.cta || 'Conocer más'} →</b></div>`;
    if (banner.image) {
      const image = document.createElement('img');
      image.src = banner.image; image.alt = ''; image.loading = 'lazy';
      link.prepend(image);
    }
    slot.replaceChildren(link);
    track('banner_impression', { banner_id: banner.id, banner_type: banner.type, banner_placement: placement, page_location: window.location.href });
    link.addEventListener('click', () => track('banner_click', { banner_id: banner.id, banner_type: banner.type, banner_placement: placement, page_location: window.location.href }));
  });
}
renderBanners();

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); deferredPrompt = event;
  if (installButton) installButton.hidden = false;
  if (status) status.textContent = 'Tu navegador ya permite instalar Shinext.';
});

if (installButton) installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  track('pwa_install_prompt');
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  track('pwa_install_result', { outcome });
  if (status) status.textContent = outcome === 'accepted' ? 'Shinext se está instalando.' : 'Puedes instalarla más tarde desde este mismo apartado.';
  deferredPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  track('pwa_installed');
  if (status) status.textContent = 'Shinext ya está instalada en este dispositivo.';
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));