const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `nerve-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `nerve-dynamic-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('nerve-') && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status >= 400) return response;
          const clone = response.clone();
          event.waitUntil(caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, clone)));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status >= 400) return response;
        if (response.headers.get('content-type')?.includes('text/html')) {
          const clone = response.clone();
          event.waitUntil(caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, clone)));
        }
        return response;
      })
      .catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        return Response.error();
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith('nerve-')).map((n) => caches.delete(n))))
    );
  }
});
