// Service Worker — Sunshine Squad
const CACHE_NAME = "ss-v1";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

// Push notification received
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

// Click on notification → open URL
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
