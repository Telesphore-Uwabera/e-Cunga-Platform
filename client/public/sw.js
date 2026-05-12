const CACHE_NAME = 'ecunga-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/e-Cunga.webp',
  '/ecunga-stock.webp',
  '/ecunga-supplier.webp'
];

// Install event - caching base assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - cleaning up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handling requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle API requests - Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response to save in cache if it's successful
          if (response.ok) {
            const copy = response.clone();
            caches.open('api-cache').then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Handle Static Assets - Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
