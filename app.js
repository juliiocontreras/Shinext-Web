document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/overrides.css">');
const installButton = document.querySelector('#install-app');
const status = document.querySelector('#install-status');
const year = document.querySelector('#year');
let deferredPrompt = null;
year.textContent = new Date().getFullYear();
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); deferredPrompt = event; installButton.hidden = false;
  status.textContent = 'Tu navegador ya permite instalar Shinext.';
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return; deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  status.textContent = outcome === 'accepted' ? 'Shinext se está instalando.' : 'Puedes instalarla más tarde desde este mismo apartado.';
  deferredPrompt = null; installButton.hidden = true;
});
window.addEventListener('appinstalled', () => { status.textContent = 'Shinext ya está instalada en este dispositivo.'; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));