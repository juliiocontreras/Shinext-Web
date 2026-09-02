document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/overrides.css">');
const installButton = document.querySelector('#install-app');
const status = document.querySelector('#install-status');
const year = document.querySelector('#year');
let deferredPrompt = null;
if (year) year.textContent = new Date().getFullYear();

// Conversion-ready layer: Google Analytics/Ads can consume these events later
// without changing the conversion buttons. No vendor ID is hard-coded here.
window.dataLayer = window.dataLayer || [];
function track(name, params = {}) { window.dataLayer.push({ event: name, ...params }); }
document.querySelectorAll('[data-conversion]').forEach((element) => {
  element.addEventListener('click', () => track(element.dataset.conversion, { page_location: window.location.href }));
});

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