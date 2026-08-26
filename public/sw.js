// Minimal Service Worker to enable Chrome / Edge PWA installation.
//
// This deliberately does NOT precache index.html under a fixed cache name.
// The previous version did, and because CACHE_NAME never changed between
// builds the 'activate' cleanup never fired, so a stale index.html could be
// served forever. That old HTML referenced hashed asset filenames that no
// longer existed after a rebuild, so the browser kept booting an old bundle
// no matter how many times the app was rebuilt — the app looked broken and
// no source fix appeared to have any effect.
//
// Strategy: always network-first. The cache is only ever an offline fallback,
// and it is refreshed from the network on every successful navigation, so the
// fallback copy can never be older than the user's last successful visit.
//
// Bump CACHE_NAME whenever you need to force-purge every client's cache.
const CACHE_NAME = 'mtc-compliance-v2';
const STATIC_ASSETS = ['/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {
        /* a failed precache must never block installation */
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // The API and every non-GET request must always go straight to the network.
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  // Page loads: network-first, refreshing the offline copy as we go, so a new
  // build is picked up on the very next reload.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put('/index.html', copy))
            .catch(() => {});
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      // Must never resolve to undefined: respondWith(undefined) throws inside
      // the worker and surfaces in the page as an opaque "Failed to fetch".
      const cached = await caches.match(request);
      return cached || Response.error();
    })
  );
});
