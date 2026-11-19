/* Pronti? VIA! — offline shell service worker */
const CACHE_PREFIX = "pv-shell-";
const CACHE = `${CACHE_PREFIX}20261119u-tint`;
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
  "./account.css?v=20261118b",
  "./travel-diary.css?v=20261119u-tint",
  "./account.js?v=20261119u",
  "./ios-form-fix.js?v=20261029a",
  "./places-suggest.js?v=20261104d",
  "./assets/index-JJ3bX5VS.css",
  // Must match the case-sensitive dynamic import in account.js.
  "./assets/index-loadfix-20261111x.js",
  "./assets/api-shim-20261119f.js",
  "./assets/magic-extras-20261119t.js",
  "./assets/expense-suite-20261111m.js",
  "./assets/expense-splitwise-20261111o.js",
  "./assets/app-suite-20261118h.js",
  "./assets/preventivo-islanda-20261117e.js",
  "./assets/ux-suite-20261119s.js",
  "./assets/pv-platform-20261118c.js",
  "./assets/destination-theme-20261119u.js",
  "./assets/event-pdf.mjs",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
  "./trip-notifications.js?v=20261111i",
  "./map.html",
  "./coast.jpg",
  "./assets/ghana-collage.webp",
  "./iceland.svg",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
];

const NETWORK_MS = 2800;

async function precacheAll(cache) {
  for (const entry of PRECACHE) {
    try {
      await cache.add(new Request(entry, { cache: "reload" }));
    } catch (err) {
      console.warn("[pv-sw] precache miss", entry, err);
    }
  }
}

function isStaticAsset(url) {
  return /\.(?:css|js|mjs|webmanifest|svg|png|webp|jpe?g|ico|woff2?)(?:\?|$)/i.test(url.pathname);
}

function isJsRequest(req, url) {
  return /\.m?js(?:\?|$)/i.test(url.pathname) || req.destination === "script";
}

function jsContentOk(response, wantsJs) {
  // Never cache an HTML shell as a JS module (breaks dynamic import → blank home).
  if (!wantsJs) return true;
  const ct = response?.headers?.get("content-type") || "";
  return /javascript|ecmascript|json/i.test(ct);
}

async function networkWithTimeout(req, ms) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), ms);
  try {
    return await fetch(req, controller ? { signal: controller.signal } : undefined);
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => precacheAll(cache))
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
      const cached = await cache.match(req);
      const wantsJs = isJsRequest(req, url);
      // HTML/navigate: network-first so stamp bumps (meteo sticker, Ghana contrast) reach users.
      if (req.mode === "navigate") {
        try {
          const fresh = await networkWithTimeout(req, NETWORK_MS);
          if (fresh?.ok && fresh.status < 500) {
            cache.put(req, fresh.clone()).catch(() => {});
            return fresh;
          }
        } catch {
          /* fall through */
        }
        if (cached) return cached;
        const index = new URL("index.html", self.registration.scope);
        const shell = await cache.match(index.href);
        if (shell) return shell;
        return Response.error();
      }

      const preferCache = isStaticAsset(url);

      // Instant offline / flaky-net shell: return cache first for known assets.
      if (cached && preferCache && jsContentOk(cached, wantsJs)) {
        event.waitUntil(
          (async () => {
            try {
              const fresh = await networkWithTimeout(req, NETWORK_MS);
              const ct = fresh?.headers?.get("content-type") || "";
              const freshIsJsOk = Boolean(fresh?.ok && (!wantsJs || /javascript|ecmascript|json/i.test(ct)));
              if (freshIsJsOk) await cache.put(req, fresh.clone()).catch(() => {});
            } catch {
              /* keep cached shell */
            }
          })()
        );
        return cached;
      }

      try {
        const fresh = await networkWithTimeout(req, NETWORK_MS);
        const ct = fresh?.headers?.get("content-type") || "";
        const freshIsJsOk = Boolean(fresh?.ok && (!wantsJs || /javascript|ecmascript|json/i.test(ct)));
        if (freshIsJsOk) cache.put(req, fresh.clone()).catch(() => {});
        if (fresh && fresh.status < 500 && (!wantsJs || freshIsJsOk)) return fresh;
      } catch {
        /* fall through to cache */
      }

      if (cached && jsContentOk(cached, wantsJs)) return cached;

      if (req.mode === "navigate") {
        const index = new URL("index.html", self.registration.scope);
        const shell = await cache.match(index.href);
        if (shell) return shell;
      }
      return Response.error();
    })()
  );
});

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(payload?.tripId || "")) return;
  const reminder = payload.kind === "reminder";
  event.waitUntil(
    self.registration.showNotification(reminder ? "Promemoria spese" : "Viaggio aggiornato", {
      body: reminder
        ? "Apri Pronti? VIA! per vedere il saldo da rimborsare."
        : "Apri Pronti? VIA! per vedere le modifiche.",
      icon: "./assets/pronti-via-icon-192.png?v=20261111q",
      tag: `pv-${payload.kind}-${payload.tripId}`,
      data: { tripId: payload.tripId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tripId = event.notification.data?.tripId;
  const target = /^[a-zA-Z0-9_-]{1,128}$/.test(tripId || "")
    ? new URL(`./#pv-notification=${encodeURIComponent(tripId)}`, self.registration.scope).href
    : new URL("./", self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((client) => client.url.startsWith(self.registration.scope));
      if (app && "navigate" in app) {
        const opened = await app.navigate(target);
        if (opened) return opened.focus();
      }
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })()
  );
});
