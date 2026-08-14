const CACHE_NAME = 'growth-checkin-v31';
const APP_SHELL = [
  './',
  './index.html',
  './recovery.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];
const NETWORK_TIMEOUT = 6000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        const hasShell = keys.some(req => req.url.indexOf('/index.html') !== -1 || req.url.endsWith('/'));
        return caches.keys().then(allKeys => Promise.all(
          allKeys.filter(key => {
            if (key === CACHE_NAME) return false;
            if (key.indexOf('growth-checkin-') === 0 && !hasShell) return false;
            return true;
          }).map(key => caches.delete(key))
        ));
      })
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

async function handleRequest(request) {
  let cached = null;
  const cacheKeys = (await caches.keys()).filter(key => key.indexOf('growth-checkin-') === 0).sort().reverse();
  for (const key of cacheKeys) {
    try {
      cached = await caches.match(request, { cacheName: key });
      if (cached) break;
    } catch (e) {}
  }
  const network = fetch(request).then(response => {
    if (response && response.status === 200 && (response.type === 'basic' || response.type === 'default')) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => cached);

  if (cached) return cached;
  try {
    return await withTimeout(network, NETWORK_TIMEOUT);
  } catch (e) {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(handleRequest(event.request));
});
