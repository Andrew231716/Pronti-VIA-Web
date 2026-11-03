/* Pronti? VIA! — offline shell service worker */
const CACHE = "pv-shell-20261102ah";
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./favicon.svg",
  "./logo.png",
  "./manifest.webmanifest?v=20261102ah",
  "./account.css?v=20261102ah",
  "./account.js?v=20261102ah",
  "./ios-form-fix.js?v=20261029a",
  "./places-suggest.js?v=20261102ah",
  "./assets/index-JJ3bX5VS.css",
  "./assets/index-loadForm-20261029a.js",
  "./assets/api-shim-20261102ah.js",
  "./assets/magic-extras-20261102ah.js",
  "./assets/expense-suite-20261102ah.js",
  "./assets/app-suite-20261102ah.js",
  "./assets/preventivo-islanda-20261102ah.js",
  "./assets/ux-suite-20261102ah.js",
  "./map.html",
  "./coast.jpg",
  "./iceland.svg",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/leaflet.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (
            (await cache.match("./index.html")) ||
            (await cache.match("/index.html")) ||
            Response.error()
          );
        }
        return Response.error();
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
      return undefined;
    })
  );
});
