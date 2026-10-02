/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */
// Bump APP_VERSION on every deploy that changes cached files.
// A byte change here is what makes the browser fetch a new worker.
// NOTE: the placeholder on the next line is replaced by the server
// (index.js) with the git commit hash at serve time — do not hardcode
// a version here.
const APP_VERSION = '__APP_VERSION__';
const CACHE = `text-twist-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './app.js',
  './js/themes.js',
  './js/themes/twilight.js',
  './js/themes/neon.js',
  './js/themes/paper.js',
  './js/sound-fx.js',
  './js/fx.js',
  './js/theme-manager.js',
  './js/board.js',
  './js/pwa-update.js',
  './libs/jquery-2.0.2.min.js',
  './libs/textFit.min.js',
  './libs/fastclick.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // No skipWaiting here: the new worker waits until the user accepts
  // the update (SKIP_WAITING message), so a game in progress is
  // never yanked out from under the players.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
