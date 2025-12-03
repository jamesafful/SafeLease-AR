const CACHE_NAME = 'safelease-ar-v1.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './public/css/app.css',
  './src/app.js',
  './src/ar.js',
  './src/checklist.json',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Offline and not cached — return basic fallback for root
      if (req.mode === 'navigate') {
        return await cache.match('./index.html');
      }
      throw err;
    }
  })());
});