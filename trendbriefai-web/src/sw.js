// Service Worker — cache last 20 articles for offline (Task 32.1)
const CACHE_NAME = 'trendbriefai-v1';
const ARTICLE_CACHE = 'trendbriefai-articles-v1';
const MAX_CACHED_ARTICLES = 50;

// Pre-cache app shell
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== ARTICLE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache article API responses
  if (url.pathname.startsWith('/api/public/articles/') && event.request.method === 'GET') {
    event.respondWith(
      caches.open(ARTICLE_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
            // Trim cache to MAX_CACHED_ARTICLES
            const keys = await cache.keys();
            if (keys.length > MAX_CACHED_ARTICLES) {
              await cache.delete(keys[0]);
            }
          }
          return response;
        } catch {
          const cached = await cache.match(event.request);
          return cached || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  // Cache feed API responses (stale-while-revalidate)
  if (url.pathname.startsWith('/api/public/feed') && event.request.method === 'GET') {
    event.respondWith(
      caches.open(ARTICLE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
