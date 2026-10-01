// Life OS service worker — makes the hosted app installable and fully offline.
// Strategy: the app is one HTML file, so the shell is cached on install and served instantly
// (stale-while-revalidate: you get the cached copy now, and a fresh copy is fetched in the background
// for next launch). Nothing the user types ever touches the network: their data lives in IndexedDB.
const CACHE = 'lifeos-shell-v2';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // only the app shell belongs to this worker (the Phase 0 prototype under /poc-storage-test/ does not)
  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname;
  const isShell = req.mode === 'navigate' ? path === scope || path === scope + 'index.html' : SHELL.some((s) => new URL(s, self.registration.scope).pathname === path);
  if (!isShell) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? new Request(self.registration.scope) : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res && res.ok) void cache.put(key, res.clone()); return res; }).catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('Life OS is offline and has not been opened online yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
