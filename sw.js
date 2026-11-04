// WayneOS Service Worker — Offline Reliability (NFR-3)
const CACHE_NAME = "wayneos-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/css/reset.css",
  "/css/design-system.css",
  "/css/layout.css",
  "/css/components.css",
  "/css/animations.css",
  "/js/app.js",
  "/js/pomodoro.js",
  "/js/audio.js",
  "/js/vance.js",
  "/js/tasks.js",
  "/js/telemetry.js",
  "/js/storage.js",
  "/manifest.json",
];

// Install — cache all static assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — purge old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for static, network-first for API
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Network-first for backend API calls
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "Offline — Vance AI unavailable" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // Cache-first for all other resources
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
