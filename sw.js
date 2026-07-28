// Service worker for F3 Campfire.
//
// Job: make the app shell installable and instant on a cold open, without ever
// getting between the page and Firebase. Goals and sign-in are live data —
// serving those from a cache would show the crew a stale fire.
//
// Bump CACHE when shipping changes so clients pick them up.
const CACHE = 'f3-campfire-v2';

// Relative so this works under a project subpath (GitHub Pages) as well as at
// a domain root (Firebase Hosting).
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/sky.js',
  './js/data.js',
  './js/config.js',
  './js/constellations.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Individually, so one bad path can't fail the whole install.
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Everything off-origin is Google's — the Firebase SDK on gstatic, the auth
  // handler, Firestore's streaming channel, profile photos. Never touch it.
  if (url.origin !== self.location.origin) return;

  // Firebase's auth helper iframes live under /__/ on the auth domain; if this
  // app is ever hosted there too, leave them alone.
  if (url.pathname.includes('/__/')) return;

  // Navigations: try the network so a deployed change lands, fall back to the
  // cached shell when offline. The crew id lives in the hash, so the shell is
  // the right response for every URL.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Static app files: serve fast from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const live = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || live;
    }),
  );
});
