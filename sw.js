/* EmpowerFit service worker — app shell caching + offline support.
   Bump CACHE_VERSION whenever index.html or the shell assets change. */
const CACHE_VERSION = 'empowerfit-v9';
const SHELL = [
  '/',
  '/index.html',
  '/tailwind.css',
  '/fonts/fonts.css',
  '/fonts/icons.css',
  '/fonts/Nunito-400.woff2',
  '/fonts/Nunito-700.woff2',
  '/fonts/PlayfairDisplay-700.woff2',
  '/fonts/fa-solid-900.woff2',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/epf00.jpg',
  '/epf01.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // Individual failures must not abort the whole install.
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // CDNs / fonts: let the network handle them
  if (url.pathname.startsWith('/.netlify/')) return;     // never cache form posts or function calls

  // Navigations: network first so a fresh deploy wins, cache as the offline safety net.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then(hit => hit || caches.match('/')))
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req)
        .then(res => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
