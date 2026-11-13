/* Pronti? VIA! — offline shell service worker */
const CACHE_PREFIX = "pv-shell-";
const CACHE = `${CACHE_PREFIX}20261113a`;
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./favicon.svg?v=20261111q",
  "./assets/pronti-via-icon-192.png?v=20261111q",
  "./assets/pronti-via-apple-180.png?v=20261111q",
  "./logo.png",
  "./logo.png?v=20261111q",
  "./manifest.webmanifest?v=20261111q",
  "./account.css?v=20261112k",
  "./travel-diary.css?v=20261112n",
  "./account.js?v=20261112o",
  "./ios-form-fix.js?v=20261029a",
  "./places-suggest.js?v=20261104d",
  "./assets/index-JJ3bX5VS.css",
  // Must match the case-sensitive dynamic import in account.js.
  "./assets/index-loadfix-20261111x.js",
  "./assets/api-shim-20261112r.js",
  "./assets/magic-extras-20261113a.js",
  "./assets/expense-suite-20261111m.js",
  "./assets/expense-splitwise-20261111o.js",
  "./assets/app-suite-20261112r.js",
  "./assets/preventivo-islanda-20261111s.js",
  "./assets/ux-suite-20261112r.js",
  "./assets/pv-platform-20261112m.js",
  "./assets/destination-theme-20261112k.js",
  "./trip-notifications.js?v=20261111i",
  "./map.html",
  "./coast.jpg",
  "./assets/ghana-collage.webp",
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

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
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
      const ct = fresh?.headers?.get("content-type") || "";
      const wantsJs = /\.m?js(\?|$)/i.test(url.pathname) || req.destination === "script";
      // Never cache an HTML shell as a JS module (breaks dynamic import → blank home).
      const freshIsJsOk = Boolean(fresh?.ok && (!wantsJs || /javascript|ecmascript|json/i.test(ct)));
      if (freshIsJsOk) cache.put(req, fresh.clone()).catch(() => {});
      if (fresh && fresh.status < 500 && (!wantsJs || freshIsJsOk)) return fresh;

      const cached = await cache.match(req);
      if (cached) {
        const cachedCt = cached.headers?.get("content-type") || "";
        if (!wantsJs || /javascript|ecmascript|json/i.test(cachedCt)) return cached;
      }
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

self.addEventListener("push", event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(payload?.tripId || "")) return;
  const reminder = payload.kind === "reminder";
  event.waitUntil(self.registration.showNotification(reminder ? "Promemoria spese" : "Viaggio aggiornato", {
    body: reminder ? "Apri Pronti? VIA! per vedere il saldo da rimborsare." : "Apri Pronti? VIA! per vedere le modifiche.",
    icon: "./assets/pronti-via-icon-192.png?v=20261111q",
    tag: `pv-${payload.kind}-${payload.tripId}`,
    data: { tripId: payload.tripId },
  }));
});

self.addEventListener("notificationclick", event => {
  const tripId = event.notification.data?.tripId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tripId || "")) return;
  event.notification.close();
  const target = new URL(`./#pv-notification=${encodeURIComponent(tripId)}`, self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = windows.find(client => client.url.startsWith(self.registration.scope));
    if (app && "navigate" in app) {
      const opened = await app.navigate(target);
      if (opened) return opened.focus();
    }
    return self.clients.openWindow(target);
  })());
});
