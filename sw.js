const CACHE = 'shinext-shell-v4';
const SHELL = ['/', '/blog/', '/blog/limpieza-profunda-vs-mantenimiento/', '/blog/checklist-limpieza-airbnb-saltillo/', '/blog/limpieza-de-oficinas-en-saltillo/', '/styles.css', '/styles-desktop.css', '/overrides.css', '/app.js', '/manifest.webmanifest', '/brand/shinext-logo-original.webp', '/images/worker.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/__/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('/');
          return undefined;
        }),
    ),
  );
});
