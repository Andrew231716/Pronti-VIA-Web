/* Pronti? VIA! — offline shell service worker */
const CACHE_PREFIX = "pv-shell-";
const CACHE = `${CACHE_PREFIX}20261110i`;
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./favicon.svg?v=20261107e",
  "./assets/pronti-via-icon-192.png",
  "./assets/pronti-via-apple-180.png",
  "./logo.png",
  "./logo.png?v=20261107e",
  "./manifest.webmanifest?v=20261107e",
  "./account.css?v=20261110h",
  "./account.js?v=20261110h",
  "./ios-form-fix.js?v=20261029a",
  "./places-suggest.js?v=20261104d",
  "./assets/index-JJ3bX5VS.css",
  // Must match account.js dynamic import (loadfix = bugfix, not loadForm).
  "./assets/index-loadfix-20261104d.js",
  "./assets/api-shim-20261107l.js",
  "./assets/magic-extras-20261107l.js",
  "./assets/expense-suite-20261107l.js",
  "./assets/app-suite-20261107l.js",
  "./assets/preventivo-islanda-20261104d.js",
  "./assets/ux-suite-20261110f.js",
  "./assets/pv-platform-20261110b.js",
  "./assets/destination-theme-20261110b.js",
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
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  if (url.pathname.includes("/api/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const fresh = await fetch(req).catch(() => undefined);
      if (fresh?.ok) cache.put(req, fresh.clone()).catch(() => {});
      if (fresh && fresh.status < 500) return fresh;

      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        const index = new URL("index.html", self.registration.scope);
        const shell = await cache.match(index.href);
        if (shell) return shell;
      }
      return fresh || Response.error();
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
