// Service worker: guarda el juego para abrirlo sin conexión y lo actualiza en segundo plano.
const CACHE = 'contracorriente-__VERSION__';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero la red (para recibir actualizaciones); si no hay conexión, lo guardado
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // no-cache: pedir siempre la versión más nueva al servidor (sin pasar por la caché del navegador)
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
