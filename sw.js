// Service Worker — Sunshine Squad
const CACHE_NAME    = "ss-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/css/main.css",
  "/assets/js/app.js",
  "/assets/js/auth.js",
  "/assets/js/components.js",
  "/assets/js/push-manager.js",
  "/components/navbar.html",
  "/components/footer.html",
];

// ── Install: pre-cache static shell ─────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ───────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

// ── Fetch: network-first for API, cache-first for static assets ──────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Only handle GET requests
  if (e.request.method !== "GET") return;

  // API calls: network-first, no cache fallback
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }))
    );
    return;
  }

  // CDN resources (Bootstrap, emoji): cache-first
  if (url.hostname !== "sunshinesquad.es" && url.hostname !== location.hostname) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Site pages and assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(e.request);
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== "opaque") {
          cache.put(e.request, res.clone());
        }
        return res;
      }).catch(() => null);

      return cached || networkFetch || new Response("Offline", { status: 503 });
    })
  );
});

// ── Push notification received ───────────────────────────────────────
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch {}

  const title   = data.title || "Sunshine Squad";
  const options = {
    body:    data.body || "",
    icon:    data.icon || "https://em-content.zobj.net/source/twitter/376/sun_2600-fe0f.png",
    badge:   data.icon || "https://em-content.zobj.net/source/twitter/376/sun_2600-fe0f.png",
    tag:     data.tag  || "ss-notification",
    data:    { url: data.url || "https://sunshinesquad.es" },
    vibrate: [200, 100, 200],
    renotify: false,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Click on notification → open URL ────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "https://sunshinesquad.es";
  e.waitUntil(
    clients.matchAll({ type:"window", includeUncontrolled:true }).then(cs => {
      for (const c of cs) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
