/* Pronti? VIA! — offline shell service worker */
const CACHE = "pv-shell-20261102s";
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./favicon.svg",
  "./logo.png",
  "./manifest.webmanifest?v=20261102s",
  "./account.css?v=20261102s",
  "./account.js?v=20261102s",
  "./ios-form-fix.js?v=20261029a",
  "./places-suggest.js?v=20261102s",
  "./assets/index-JJ3bX5VS.css",
  "./assets/index-loadForm-20261029a.js",
  "./assets/api-shim-20261102s.js",
  "./assets/magic-extras-20261102s.js",
  "./assets/expense-suite-20261102s.js",
  "./assets/preventivo-islanda-20261102s.js",
  "./assets/ux-suite-20261102s.js",
  "./map.html",
  "./coast.jpg",
  "./iceland.svg",
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
  // Never cache API — online path uses network; offline falls through to app localStorage.
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
