/**
 * NERVE Service Worker
 * 
 * Provides offline support, caching, and install prompt functionality
 * for the PWA experience.
 * 
 * Cache Strategy:
 * - Static assets (images, fonts, CSS, JS): Cached with long TTL
 * - HTML pages: Network-first with cache fallback
 * - API requests: Cache-first with stale-while-revalidate
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `nerve-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `nerve-dynamic-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/nervee-logo-favicon.png',
  '/assets/vendor-*.js',
  '/assets/context-*.js',
  '/assets/*.js',
  '/assets/*.css',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('nerve-') && 
                     cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE;
            })
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Chrome extensions and other non-HTTP protocols
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If cache hit, return it
        if (cachedResponse) {
          // Update cache in background
          event.waitUntil(updateCache(event.request));
          return cachedResponse;
        }

        // If no cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache responses with errors
            if (!networkResponse || networkResponse.status >= 400) {
              return networkResponse;
            }

            // Clone the response since it can only be read once
            const responseClone = networkResponse.clone();
            
            // Update cache
            event.waitUntil(
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(event.request, responseClone))
            );

            return networkResponse;
          })
          .catch(() => {
            // For navigation requests, return offline page
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html');
            }
            return Response.error();
          });
      })
  );
});

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith('nerve-'))
              .map((cacheName) => caches.delete(cacheName))
          );
        })
    );
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.payload;
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(urlsToCache))
    );
  }
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

// Sync orders function (example)
async function syncOrders() {
  // This would sync pending orders when connection is restored
  console.log('[SW] Syncing orders...');
  // Implement actual sync logic here
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action) {
    // Handle specific actions
    if (event.action === 'view-order') {
      event.waitUntil(
        clients.openWindow(`https://www.nerveey.shop/my-orders`)
      );
    }
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'New update from NERVE',
    icon: '/nervee-logo-favicon.png',
    badge: '/nervee-logo-favicon.png',
    data: data.url ? { url: data.url } : {},
    vibrate: [100, 50, 100],
    tag: 'notification-tag',
    renotify: true,
    actions: [
      { action: 'view-order', title: 'View Order' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'NERVE', options)
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  // Handle subscription expiration or changes
  console.log('[SW] Push subscription changed');
});
