// OraaSlayer Service Worker v1.0
// Caching Strategy: Cache-First for static assets, Network-First for API data

const CACHE_NAME = 'oraaslayer-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/api/firebase.js',
  '/api/auth.js',
  '/api/anilist.js',
  '/api/seo_gen.js',
  '/styles/shared.css'
];

const CACHE_STRATEGIES = {
  // Cache-First: for static assets (CSS, JS, fonts, images)
  cacheFirst: [
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.webp$/,
    /\.svg$/,
    /\.gif$/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/
  ],
  // Network-First: for API calls
  networkFirst: [
    /graphql\.anilist\.co/,
    /firebaseio\.com/,
    /googleapis\.com\/v1/
  ],
  // Stale-While-Revalidate: for anime images
  staleWhileRevalidate: [
    /s4\.anilist\.co/,
    /img\.youtube\.com/,
    /via\.placeholder\.com/
  ]
};

function matchesStrategy(url, patterns) {
  return patterns.some(pattern => pattern.test(url));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may fail in dev, that's ok
        console.log('[SW] Some static assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.startsWith('http')) return;

  if (matchesStrategy(url, CACHE_STRATEGIES.cacheFirst)) {
    event.respondWith(cacheFirst(request));
  } else if (matchesStrategy(url, CACHE_STRATEGIES.networkFirst)) {
    event.respondWith(networkFirst(request));
  } else if (matchesStrategy(url, CACHE_STRATEGIES.staleWhileRevalidate)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}
