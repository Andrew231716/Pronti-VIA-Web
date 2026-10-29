/**
 * Free Wanderlog-parity extras for Pronti? VIA!
 * - Bacchetta magica: Idee + chat suggerimenti (OSM/Wikipedia/TripAdvisor link)
 *   e sezione Lingua (frasario + traduzione simultanea)
 * - Packing list templates
 * - Budget privato + expense category breakdown
 * - Day-colored map pins, distances, meteo, FX in Spese, link utili
 */
(() => {
  const STYLE_ID = "pv-magic-extras-css";
  const ROOT_ID = "pv-magic-root";
  const DAY_COLORS = ["#007d82", "#4770b1", "#bb7735", "#8965a7", "#c05f67", "#528545", "#2a9d8f", "#e76f51"];
  const WMO = {
    0: "Sereno",
    1: "Prevalentemente sereno",
    2: "Parzialmente nuvoloso",
    3: "Coperto",
    45: "Nebbia",
    48: "Nebbia",
    51: "Pioggerella",
    61: "Pioggia",
    63: "Pioggia",
    65: "Pioggia forte",
    71: "Neve",
    80: "Rovesci",
    95: "Temporale",
  };

  const PACKING_TEMPLATES = {
    Mare: [
      "Costume e asciugamano",
      "Crema solare",
      "Occhiali da sole",
      "Ciabatte",
      "Cappello",
      "Documenti e assicurazione",
      "Caricabatterie",
      "Medicinali di base",
    ],
    Città: [
      "Scarpe comode",
      "Adattatore prese",
      "Power bank",
      "Documenti e biglietti",
      "Ombrello leggero",
      "Borraccia",
      "Medicinali di base",
      "Caricabatterie",
    ],
    Montagna: [
      "Scarponcini",
      "Giacca antivento",
      "Pile / strati",
      "Borraccia",
      "Crema solare",
      "Kit primo soccorso",
      "Torcia / frontale",
      "Documenti",
    ],
    Famiglia: [
      "Documenti di tutti",
      "Snack e borracce",
      "Giochi / cuffie",
      "Cambio extra",
      "Medicinali e termometro",
      "Crema solare",
      "Caricabatterie",
      "Prenotazioni stampate / offline",
    ],
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:auto 16px 16px auto;z-index:80;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:inherit}
      #${ROOT_ID} .pv-magic-btn{appearance:none;border:0;border-radius:999px;background:#007d82;color:#fff;padding:12px 16px;font:600 14px/1.2 inherit;box-shadow:0 10px 30px rgba(0,80,90,.28);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
      #${ROOT_ID} .pv-magic-btn[disabled]{opacity:.6;cursor:wait}
      #${ROOT_ID} .pv-magic-btn svg{width:18px;height:18px;flex:0 0 auto}
      #${ROOT_ID} .pv-magic-panel{width:min(420px,calc(100vw - 24px));max-height:min(78vh,680px);overflow:auto;background:#fff;border:1px solid #d7e4e4;border-radius:18px;box-shadow:0 18px 50px rgba(18,40,50,.18);padding:14px}
      #${ROOT_ID} .pv-magic-panel h3{margin:0 0 6px;font-size:1.05rem;color:#16353b}
      #${ROOT_ID} .pv-magic-panel p{margin:0 0 12px;color:#5b7076;font-size:.92rem}
      #${ROOT_ID} .pv-magic-panel label{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid #eef3f3;font-size:.92rem;color:#1d3338}
      #${ROOT_ID} .pv-magic-panel .pv-meta{display:block;color:#6a7f85;font-size:.8rem;margin-top:2px}
      #${ROOT_ID} .pv-tabs{display:flex;gap:4px;margin:0 0 12px;padding:3px;background:#eef5f5;border-radius:12px}
      #${ROOT_ID} .pv-tabs button{flex:1;appearance:none;border:0;border-radius:10px;padding:8px 6px;font:600 12px inherit;color:#3c5c62;background:transparent;cursor:pointer}
      #${ROOT_ID} .pv-tabs button.active{background:#fff;color:#007d82;box-shadow:0 1px 4px rgba(0,80,90,.12)}
      #${ROOT_ID} .pv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #${ROOT_ID} .pv-actions button,#${ROOT_ID} .pv-card-actions button{appearance:none;border:0;border-radius:12px;padding:10px 12px;font:600 13px inherit;cursor:pointer}
      #${ROOT_ID} .pv-actions .primary,#${ROOT_ID} .pv-card-actions .primary{background:#007d82;color:#fff}
      #${ROOT_ID} .pv-actions .ghost,#${ROOT_ID} .pv-card-actions .ghost{background:#eef5f5;color:#1d3338}
      #${ROOT_ID} .pv-status{font-size:.85rem;color:#5b7076;min-height:1.2em}
      #${ROOT_ID} .pv-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
      #${ROOT_ID} .pv-chips button{appearance:none;border:1px solid #c9dbdb;background:#fff;color:#184047;border-radius:999px;padding:6px 10px;font:600 11px inherit;cursor:pointer}
      #${ROOT_ID} .pv-chat{display:flex;flex-direction:column;gap:8px;min-height:180px;max-height:280px;overflow:auto;padding:4px 2px 8px}
      #${ROOT_ID} .pv-bubble{max-width:92%;padding:10px 12px;border-radius:14px;font-size:.88rem;line-height:1.4;color:#1d3338}
      #${ROOT_ID} .pv-bubble.bot{align-self:flex-start;background:#eef7f7;border-bottom-left-radius:4px}
      #${ROOT_ID} .pv-bubble.user{align-self:flex-end;background:#007d82;color:#fff;border-bottom-right-radius:4px}
      #${ROOT_ID} .pv-chat-form{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}
      #${ROOT_ID} .pv-chat-form input,#${ROOT_ID} .pv-lang-pair textarea,#${ROOT_ID} .pv-magic-panel select{width:100%;border:1px solid #c9dbdb;border-radius:12px;padding:10px 12px;font:inherit;color:#16353b;background:#fff}
      #${ROOT_ID} .pv-chat-form button{appearance:none;border:0;border-radius:12px;padding:10px 14px;background:#007d82;color:#fff;font:600 13px inherit;cursor:pointer}
      #${ROOT_ID} .pv-place-card{display:grid;grid-template-columns:88px 1fr;gap:10px;padding:10px 0;border-top:1px solid #eef3f3}
      #${ROOT_ID} .pv-place-card img{width:88px;height:72px;object-fit:cover;border-radius:10px;background:#e8f0f0}
      #${ROOT_ID} .pv-place-card .pv-ph{width:88px;height:72px;border-radius:10px;background:linear-gradient(135deg,#d9ecec,#eef6f6);display:grid;place-items:center;color:#5b7076;font-size:.7rem;font-weight:700;text-align:center;padding:4px}
      #${ROOT_ID} .pv-place-card strong{display:block;font-size:.9rem;color:#16353b;margin-bottom:2px}
      #${ROOT_ID} .pv-place-card .pv-extract{font-size:.78rem;color:#5b7076;line-height:1.35;margin:0 0 6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      #${ROOT_ID} .pv-card-actions{display:flex;flex-wrap:wrap;gap:6px}
      #${ROOT_ID} .pv-card-actions a,#${ROOT_ID} .pv-card-actions button{font-size:11px;padding:7px 9px;text-decoration:none}
      #${ROOT_ID} .pv-lang-pair{display:grid;gap:10px}
      #${ROOT_ID} .pv-lang-pair label{display:grid;gap:4px;border:0;padding:0;font-size:.78rem;font-weight:700;color:#5b7076;letter-spacing:.04em;text-transform:uppercase}
      #${ROOT_ID} .pv-lang-pair textarea{min-height:72px;resize:vertical;font:400 .92rem inherit;text-transform:none;letter-spacing:normal;color:#16353b}
      #${ROOT_ID} .pv-phrase{appearance:none;border:1px solid #d9e7e7;background:#f7fbfb;border-radius:12px;padding:8px 10px;text-align:left;cursor:pointer;width:100%;margin:0 0 6px}
      #${ROOT_ID} .pv-phrase strong{display:block;font-size:.86rem;color:#16353b}
      #${ROOT_ID} .pv-phrase span{display:block;font-size:.78rem;color:#5b7076;margin-top:2px}
      .pv-extras-bar{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
      .pv-extras-bar button,.pv-budget-box button,.pv-chart-box button{appearance:none;border:1px solid #c9dbdb;background:#fff;color:#184047;border-radius:999px;padding:7px 12px;font:600 12px inherit;cursor:pointer}
      .pv-extras-bar button:hover,.pv-budget-box button:hover{background:#eef7f7}
      .pv-budget-box,.pv-chart-box{margin:12px 0;padding:12px 14px;border:1px solid #d9e7e7;border-radius:16px;background:linear-gradient(180deg,#f7fbfb,#fff)}
      .pv-budget-box strong,.pv-chart-box strong{display:block;margin-bottom:8px;color:#16353b}
      .pv-budget-box .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .pv-budget-box input{flex:1;min-width:120px;border:1px solid #c9dbdb;border-radius:10px;padding:8px 10px;font:inherit}
      .pv-chart-row{display:grid;grid-template-columns:88px 1fr 64px;gap:8px;align-items:center;margin:6px 0;font-size:.86rem;color:#355055}
      .pv-chart-row .bar{height:10px;border-radius:999px;background:#e6efef;overflow:hidden}
      .pv-chart-row .fill{height:100%;background:#007d82;border-radius:inherit}
      .pv-dist-note,.route-hop{display:block;margin:4px 0 10px;padding:6px 10px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.78rem;font-weight:600;width:fit-content}
      .pv-day-legend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
      .pv-day-legend span{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:#456}
      .pv-day-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
      .pv-day-weather,.pv-links-box,.pv-fx-calc{margin:12px 0 14px;padding:14px 16px;border:1px solid #d9e7e7;border-radius:16px;background:#fff}
      .pv-day-weather .pv-block-title,.pv-links-box .pv-block-title,.pv-fx-calc .pv-block-title{margin:0 0 10px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-day-weather .pv-block-meta,.pv-fx-calc .pv-block-meta{margin:0 0 10px;font-size:.86rem;color:#5b7076}
      .pv-day-weather{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center}
      .pv-day-weather .pv-block-title{margin:0;width:100%}
      .pv-day-weather .pv-weather-card{flex:1;min-width:160px;padding:0;border:0;background:transparent;display:flex;flex-direction:column;gap:4px}
      .pv-day-weather .pv-weather-card strong{font-size:.92rem;color:#16353b}
      .pv-day-weather .pv-weather-card .temp{font-size:1.15rem;font-weight:700;color:#007d82}
      .pv-day-weather .pv-weather-card .cond{font-size:.82rem;color:#5b7076;line-height:1.35}
      .pv-fx-calc .pv-fx-rows{display:grid;gap:10px;max-width:420px}
      .pv-fx-calc .pv-fx-row{display:grid;grid-template-columns:minmax(0,1fr) 56px;gap:8px;align-items:center}
      .pv-fx-calc .pv-fx-row input{width:100%;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;font:600 1rem inherit;color:#16353b;background:#f7fbfb}
      .pv-fx-calc .pv-fx-row input:focus{outline:2px solid #007d82;outline-offset:1px;background:#fff}
      .pv-fx-calc .pv-fx-row .code{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-fx-calc .pv-fx-rate{margin:0;font-size:.82rem;color:#5b7076}
      .pv-expense-fx{margin:0;display:grid;gap:8px}
      .pv-expense-fx select{width:100%;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;font:inherit;background:#fff;color:#16353b}
      .pv-expense-fx-hint{margin:0;font-size:.82rem;color:#5b7076;min-height:1.2em}
      .pv-links-box .pv-action-list{display:grid;gap:0}
      .pv-links-box .pv-action-list a,.pv-links-box .pv-action-list button{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:11px 0;border:0;border-bottom:1px solid #eef3f3;background:transparent;color:#184047;font:600 0.92rem inherit;cursor:pointer;text-decoration:none;text-align:left}
      .pv-links-box .pv-action-list a:last-child,.pv-links-box .pv-action-list button:last-child{border-bottom:0;padding-bottom:0}
      .pv-links-box .pv-action-list a:first-child,.pv-links-box .pv-action-list button:first-child{padding-top:0}
      .pv-links-box .pv-action-list .hint{font-size:.78rem;font-weight:600;color:#7a9096}
      .pv-links-box .pv-status{min-height:1.1em;margin:10px 0 0;font-size:.82rem;color:#5b7076}
    `;
    document.head.appendChild(style);
  }

  function tripAuth() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const id = params.get("trip");
    const key = params.get("key");
    if (!id || !key) return null;
    return { id, key };
  }

  async function loadTrip() {
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio salvato per usare questa funzione.");
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Viaggio non disponibile");
    if (data.canEdit === false) throw new Error("Serve il link di modifica.");
    return { auth, data };
  }

  async function saveTrip(auth, trip, revision) {
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({ trip, revision }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Salvataggio non riuscito");
    return data;
  }

  function uid() {
    return crypto.randomUUID();
  }

  function parseEuroToCents(raw) {
    const n = Number(String(raw || "0").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n < 0) throw new Error("Importo non valido");
    return Math.round(n * 100);
  }

  function formatEuro(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  }

  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLng = (b.lng - a.lng) * toRad;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
  }

  function tripDays(trip) {
    const days = [];
    for (let t = Date.parse(trip.start); t <= Date.parse(trip.end); t += 864e5) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
    return days;
  }

  async function geocodeDestination(q) {
    // Prefer same-origin shim, but fall back to Photon/Nominatim so the wand
    // still works on GitHub Pages when trip proxies flap.
    try {
      const res = await fetch(`/api/places?scope=destination&q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      const place = (data.places || []).find((p) => p.lat != null && p.lng != null) || (data.places || [])[0];
      if (place && place.lat != null) return place;
    } catch {
      /* try public geocoders */
    }

    try {
      const photon = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=default`,
        { signal: AbortSignal.timeout(12000) }
      ).then((r) => r.json());
      for (const feature of photon.features || []) {
        const coords = feature.geometry?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng, title: feature.properties?.name || q };
        }
      }
    } catch {
      /* nominatim next */
    }

    const nom = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      }
    ).then((r) => r.json());
    const hit = Array.isArray(nom) ? nom[0] : null;
    if (!hit || hit.lat == null) throw new Error("Non trovo coordinate per la destinazione.");
    return { lat: Number(hit.lat), lng: Number(hit.lon), title: hit.display_name || q };
  }

  async function fetchPois(lat, lng) {
    // Wikipedia geosearch is free and CORS-friendly from the browser.
    const wikiUrls = [
      `https://it.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`,
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`,
    ];
    let items = [];
    for (const url of wikiUrls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const data = await res.json();
        const list = data?.query?.geosearch || [];
        if (list.length) {
          items = list;
          break;
        }
      } catch {
        /* try next */
      }
    }

    // Fallback: same-origin / Cloudflare proxy to Overpass.
    if (!items.length) {
      const res = await fetch(`/api/pois?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=10000`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ricerca luoghi non disponibile.");
      const elements = Array.isArray(data.elements) ? data.elements : [];
      items = elements.map((el) => ({
        title: el.tags?.name || el.tags?.["name:it"] || el.tags?.["name:en"],
        lat: el.lat,
        lon: el.lon,
        kind: el.tags?.tourism || el.tags?.historic || el.tags?.leisure || "luogo",
      }));
    }

    const seen = new Set();
    const pois = [];
    for (const el of items) {
      const name = el.title || el.name;
      if (!name || seen.has(String(name).toLowerCase())) continue;
      seen.add(String(name).toLowerCase());
      const kind = el.kind || "luogo";
      pois.push({
        title: String(name).slice(0, 120),
        category: "Visita",
        lat: el.lat,
        lng: el.lon ?? el.lng,
        address: "",
        notes: `Suggerito dalla bacchetta magica (${kind})`,
        kind,
      });
      if (pois.length >= 24) break;
    }
    if (!pois.length) throw new Error("Nessun luogo trovato qui intorno.");
    return pois;
  }

  function distributeAcrossDays(pois, days) {
    if (!days.length) return pois.map((p) => ({ ...p, day: "" }));
    return pois.map((p, i) => ({ ...p, day: days[i % days.length] }));
  }

  function wandIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20 L14.5 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 4 l1.2 2.4 2.6.4-1.9 1.9.5 2.6L13 10.2 10.6 11.3l.5-2.6L9.2 6.8l2.6-.4L13 4z" fill="currentColor"/><path d="M16.5 14.5 l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2.7-1.4z" fill="currentColor"/></svg>`;
  }

  function ensureRoot() {
    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  let panelOpen = false;
  let pendingPois = [];
  let magicTab = "chiedi";
  let chatPlaces = [];
  let magicTripCache = null;

  function magicTabsHtml(active) {
    return `
      <div class="pv-tabs" role="tablist">
        <button type="button" data-tab="idee" class="${active === "idee" ? "active" : ""}">Idee</button>
        <button type="button" data-tab="chiedi" class="${active === "chiedi" ? "active" : ""}">Chiedi</button>
        <button type="button" data-tab="lingua" class="${active === "lingua" ? "active" : ""}">Lingua</button>
      </div>`;
  }

  function bindMagicTabs(panel) {
    panel.querySelectorAll(".pv-tabs [data-tab]").forEach((btn) => {
      btn.onclick = () => {
        magicTab = btn.dataset.tab;
        void showMagicPanel(panel, magicTab);
      };
    });
  }

  function renderFab() {
    if (!document.body.classList.contains("pv-account-ready")) return;
    if (!tripAuth()) {
      const existing = document.getElementById(ROOT_ID);
      if (existing) existing.innerHTML = "";
      return;
    }
    if (document.querySelector("main.loading")) return;

    const root = ensureRoot();
    // Keep an open suggestion panel intact (MutationObserver would otherwise wipe it).
    if (root.querySelector("#pv-magic-panel") && !root.querySelector("#pv-magic-panel").hidden) {
      return;
    }
    if (root.querySelector("#pv-magic-open")) return;

    root.innerHTML = `
      <button type="button" class="pv-magic-btn" id="pv-magic-open">${wandIcon()} Bacchetta magica</button>
      <div class="pv-magic-panel" id="pv-magic-panel" hidden></div>
    `;
    root.querySelector("#pv-magic-open").onclick = () => {
      panelOpen = !panelOpen;
      const panel = root.querySelector("#pv-magic-panel");
      panel.hidden = !panelOpen;
      if (panelOpen) void showMagicPanel(panel, magicTab || "chiedi");
    };
  }

  async function showMagicPanel(panel, tab = "chiedi") {
    magicTab = tab;
    try {
      if (!magicTripCache) {
        const { data } = await loadTrip();
        magicTripCache = data.trip;
      }
    } catch (err) {
      panel.innerHTML = `
        <h3>Bacchetta magica</h3>
        <p class="pv-status">${escapeHtml(err instanceof Error ? err.message : "Errore")}</p>
        <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
      `;
      panel.querySelector("#pv-magic-close").onclick = () => {
        panelOpen = false;
        panel.hidden = true;
      };
      return;
    }

    if (tab === "idee") return void runMagicSuggest(panel);
    if (tab === "lingua") return void renderLanguageTab(panel);
    return void renderChatTab(panel);
  }

  async function runMagicSuggest(panel) {
    panel.innerHTML = `${magicTabsHtml("idee")}<h3>Idee per l’itinerario</h3><p class="pv-status">Cerco luoghi intorno alla destinazione…</p>`;
    bindMagicTabs(panel);
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      magicTripCache = trip;
      const place = await geocodeDestination(trip.destination);
      const pois = distributeAcrossDays(await fetchPois(place.lat, place.lng), tripDays(trip));
      pendingPois = pois;
      const existing = new Set((trip.stops || []).map((s) => String(s.title || "").toLowerCase()));
      panel.innerHTML = `
        ${magicTabsHtml("idee")}
        <h3>Idee per l’itinerario</h3>
        <p>Proposte (Wikipedia / OpenStreetMap) intorno a <strong>${escapeHtml(trip.destination)}</strong>. Scegli cosa aggiungere.</p>
        <div id="pv-magic-list"></div>
        <div class="pv-actions">
          <button type="button" class="primary" id="pv-magic-add">Aggiungi selezionati</button>
          <button type="button" class="ghost" id="pv-magic-close">Chiudi</button>
        </div>
        <p class="pv-status" id="pv-magic-status"></p>
      `;
      bindMagicTabs(panel);
      const list = panel.querySelector("#pv-magic-list");
      pois.forEach((poi, idx) => {
        const already = existing.has(poi.title.toLowerCase());
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="checkbox" data-idx="${idx}" ${already ? "" : "checked"} ${already ? "disabled" : ""} />
          <span>
            <strong>${escapeHtml(poi.title)}</strong>
            <span class="pv-meta">${escapeHtml(poi.kind)} · Giorno ${poi.day || "da decidere"}${already ? " · già in itinerario" : ""}</span>
          </span>
        `;
        list.appendChild(label);
      });
      panel.querySelector("#pv-magic-close").onclick = () => {
        panelOpen = false;
        panel.hidden = true;
      };
      panel.querySelector("#pv-magic-add").onclick = () => void addSelectedPois(panel);
    } catch (err) {
      panel.innerHTML = `
        ${magicTabsHtml("idee")}
        <h3>Idee per l’itinerario</h3>
        <p class="pv-status">${escapeHtml(err instanceof Error ? err.message : "Errore")}</p>
        <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
      `;
      bindMagicTabs(panel);
      panel.querySelector("#pv-magic-close").onclick = () => {
        panelOpen = false;
        panel.hidden = true;
      };
    }
  }

  function parseChatIntent(text) {
    const q = String(text || "").toLowerCase();
    if (/mangiar|ristor|cibo|cena|pranzo|gourmet|tipic/.test(q)) {
      return {
        kind: "restaurant",
        category: "Cibo",
        labelSingular: "posto dove mangiare",
        labelPlural: "posti dove mangiare",
        query: "restaurant",
        osmTags: ["amenity:restaurant", "amenity:fast_food"],
      };
    }
    if (/caff|bar|aperitiv|birra|pub/.test(q)) {
      return {
        kind: "cafe",
        category: "Cibo",
        labelSingular: "caffè / bar",
        labelPlural: "caffè e bar",
        query: "cafe",
        osmTags: ["amenity:cafe", "amenity:bar", "amenity:pub"],
      };
    }
    if (/muse|galleri|cultur|storia|arte/.test(q)) {
      return {
        kind: "museum",
        category: "Visita",
        labelSingular: "museo",
        labelPlural: "musei e cultura",
        query: "museum",
        osmTags: ["tourism:museum", "tourism:gallery"],
      };
    }
    if (/natur|parco|escurs|trekking|cascata|spiaggia|viewpoint|panorama/.test(q)) {
      return {
        kind: "nature",
        category: "Natura",
        labelSingular: "luogo natura",
        labelPlural: "luoghi natura e panorami",
        query: "viewpoint",
        osmTags: ["tourism:viewpoint", "leisure:park", "natural:beach"],
      };
    }
    if (/shopping|negozi|mercato|souvenir/.test(q)) {
      return {
        kind: "shop",
        category: "Shopping",
        labelSingular: "posto shopping",
        labelPlural: "posti shopping",
        query: "market",
        osmTags: ["amenity:marketplace", "shop:mall"],
      };
    }
    if (/notte|locali|musica|divert/.test(q)) {
      return {
        kind: "cafe",
        category: "Serata",
        labelSingular: "locale serale",
        labelPlural: "locali serali",
        query: "nightlife",
        osmTags: ["amenity:bar", "amenity:pub", "amenity:nightclub"],
      };
    }
    if (/bambin|famigli|kids/.test(q)) {
      return {
        kind: "attraction",
        category: "Famiglia",
        labelSingular: "idea per famiglie",
        labelPlural: "idee per famiglie",
        query: "attraction",
        osmTags: ["tourism:attraction", "tourism:zoo", "leisure:playground"],
      };
    }
    const cleaned = q.replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
    return {
      kind: "attraction",
      category: "Visita",
      labelSingular: "suggerimento",
      labelPlural: "suggerimenti",
      query: cleaned.slice(0, 80) || "attraction",
      osmTags: ["tourism:attraction", "tourism:museum"],
    };
  }

  /** Map vague/EN destination labels to a usable city for place search. */
  function searchCityForDestination(destination, title = "") {
    const raw = String(destination || "").trim();
    const blob = `${raw} ${title}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/islanda|\bisland\b|iceland|reykjav/.test(blob)) return "Reykjavik";
    if (/norvegia|norway/.test(blob) && !/oslo|bergen/.test(blob)) return "Oslo";
    if (/svezia|sweden/.test(blob) && !/stoccolma|stockholm/.test(blob)) return "Stockholm";
    if (/danimarca|denmark/.test(blob) && !/copenhagen|copenaghen/.test(blob)) return "Copenhagen";
    if (/france|francia/.test(blob) && !/parigi|paris/.test(blob)) return "Paris";
    if (/spain|spagna/.test(blob) && !/madrid|barcellona|barcelona/.test(blob)) return "Madrid";
    if (/germania|germany/.test(blob) && !/berlin|monaco|munich/.test(blob)) return "Berlin";
    // Drop country-only first tokens that are too vague for Photon amenity search
    const first = raw.split(",")[0].trim();
    if (/^(island|ísland|iceland|norway|sweden|denmark|france|spain|germany|italy|italia)$/i.test(first)) {
      return searchCityForDestination(`${first} capital`, title) || first;
    }
    return first || raw;
  }

  function formatDestGreeting(destination, title = "") {
    const blob = `${destination || ""} ${title || ""}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/islanda|\bisland\b|iceland|reykjav/.test(blob)) return "in Islanda";
    if (/norvegia|norway/.test(blob)) return "in Norvegia";
    if (/svezia|sweden/.test(blob)) return "in Svezia";
    if (/danimarca|denmark/.test(blob)) return "in Danimarca";
    if (/france|francia/.test(blob)) return "in Francia";
    if (/spain|spagna/.test(blob)) return "in Spagna";
    if (/germania|germany/.test(blob)) return "in Germania";
    if (/giappone|japan/.test(blob)) return "in Giappone";
    if (/usa|stati uniti|new york/.test(blob)) return "negli Stati Uniti";
    if (/uk|inghilterra|london|londra/.test(blob)) return "nel Regno Unito";
    const d = String(destination || "").trim();
    if (!d) return "per la tua destinazione";
    // Cities usually take "a", countries often already handled above
    return `a ${d}`;
  }

  function intentResultLabel(intent, count) {
    if (count === 1) return intent.labelSingular || "risultato";
    return intent.labelPlural || intent.labelSingular || "risultati";
  }

  function isCountryLikePlace(props, name, destination) {
    const type = String(props.type || props.osm_value || "").toLowerCase();
    const osmKey = String(props.osm_key || "").toLowerCase();
    if (type === "country" || type === "continent" || type === "state" || type === "county") return true;
    if (osmKey === "place" && /country|state|continent/.test(String(props.osm_value || ""))) return true;
    const n = String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const dest = String(destination || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const countryAliases = [
      "island",
      "islanda",
      "iceland",
      "norvegia",
      "norway",
      "svezia",
      "sweden",
      "danimarca",
      "denmark",
      "francia",
      "france",
      "spagna",
      "spain",
      "germania",
      "germany",
      "italia",
      "italy",
    ];
    if (countryAliases.includes(n)) return true;
    if (dest && (n === dest || n === dest.split(",")[0].trim())) {
      if (countryAliases.some((a) => dest.includes(a))) return true;
    }
    return false;
  }

  function matchesIntentKind(props, intent, { loose = false } = {}) {
    if (!intent?.kind || intent.kind === "attraction") return true;
    const val = String(props.osm_value || props.type || "").toLowerCase();
    const key = String(props.osm_key || "").toLowerCase();
    const kind = intent.kind;
    if (kind === "restaurant") {
      if (key === "amenity" && /restaurant|fast_food|food_court/.test(val)) return true;
      if (loose && /restaurant|bistro|kitchen|grill|pizzeria|sushi|seafood/i.test(props.name || "")) return true;
      return false;
    }
    if (kind === "cafe") {
      if (key === "amenity" && /cafe|bar|pub|biergarten|nightclub/.test(val)) return true;
      if (loose && /cafe|café|coffee|bar|pub/i.test(props.name || "")) return true;
      return false;
    }
    if (kind === "museum") {
      return (key === "tourism" && /museum|gallery/.test(val)) || val === "museum" || (loose && /museum|museo|gallery/i.test(props.name || ""));
    }
    if (kind === "nature") {
      return /viewpoint|park|beach|waterfall|peak|nature/.test(val) || key === "natural" || key === "leisure";
    }
    if (kind === "shop") {
      return key === "shop" || /marketplace|mall|supermarket/.test(val);
    }
    return true;
  }

  async function fetchWikivoyagePlaces(city, intent) {
    const sectionKeys = {
      restaurant: ["Eat", "Mangiare", "Drink", "Bere", "Buy", "Comprare"],
      cafe: ["Drink", "Bere", "Eat", "Mangiare"],
      museum: ["See", "Vedere", "Do", "Fare"],
      nature: ["See", "Vedere", "Do", "Fare", "Understand"],
      shop: ["Buy", "Comprare", "Eat"],
      attraction: ["See", "Vedere", "Do", "Fare", "Eat", "Mangiare"],
    };
    const wanted = new Set((sectionKeys[intent.kind] || sectionKeys.attraction).map((s) => s.toLowerCase()));
    const hosts = ["en.wikivoyage.org", "it.wikivoyage.org"];
    const places = [];
    const seen = new Set();

    for (const host of hosts) {
      if (places.length >= 8) break;
      try {
        const search = await fetch(
          `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(city)}&srlimit=3&format=json&origin=*`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const pageTitle = search?.query?.search?.[0]?.title;
        if (!pageTitle) continue;

        const parsed = await fetch(
          `https://${host}/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`,
          { signal: AbortSignal.timeout(12000) }
        ).then((r) => r.json());
        const wikitext = String(parsed?.parse?.wikitext?.["*"] || "");
        if (!wikitext) continue;

        // Split by == Section == headers
        const parts = wikitext.split(/\n==+\s*/);
        for (let i = 1; i < parts.length; i++) {
          const headerEnd = parts[i].search(/\s*==+/);
          const header = (headerEnd >= 0 ? parts[i].slice(0, headerEnd) : parts[i].slice(0, 40))
            .replace(/[\[\]']/g, "")
            .trim()
            .toLowerCase();
          if (![...wanted].some((w) => header.startsWith(w) || header.includes(w))) continue;
          const body = headerEnd >= 0 ? parts[i].slice(headerEnd) : parts[i];

          // {{eat|name=...}} / {{marker|name=...}} / '''[[Name]]''' / * [[Name]]
          const patterns = [
            /\{\{(?:eat|drink|see|do|buy|listing|marker)[^}]*\bname\s*=\s*([^}|]+)/gi,
            /\*\s*'{0,3}\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]'{0,3}/g,
            /\*\s*\*\*([^*\n]{3,60})\*\*/g,
          ];
          for (const re of patterns) {
            let m;
            while ((m = re.exec(body)) && places.length < 10) {
              let name = String(m[1] || "")
                .replace(/<\/?[^>]+>/g, "")
                .replace(/[{}]/g, "")
                .trim();
              if (name.length < 3 || name.length > 80) continue;
              if (/^(see|do|eat|drink|buy|list|file|image|wikipedia|commons)$/i.test(name)) continue;
              if (isCountryLikePlace({ type: "poi" }, name, city)) continue;
              const key = name.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              places.push({
                title: name.slice(0, 120),
                category: intent.category,
                kind: intent.kind === "restaurant" || intent.kind === "cafe" ? intent.kind : "wikivoyage",
                lat: null,
                lng: null,
                address: `${city} · Wikivoyage`,
                extract: `Consigliato su Wikivoyage (${pageTitle}), sezione “${header}”.`,
                notes: `Fonte: Wikivoyage — ${pageTitle}`,
                wikiUrl: `https://${host}/wiki/${encodeURIComponent(pageTitle)}`,
                source: "wikivoyage",
              });
            }
          }
        }
        if (places.length) break;
      } catch {
        /* try next host */
      }
    }
    return places;
  }

  function reliableWebSearches(city, intent, destination) {
    const qCity = city || destination || "";
    const topic =
      intent.kind === "restaurant"
        ? "restaurants"
        : intent.kind === "cafe"
          ? "cafes bars"
          : intent.kind === "museum"
            ? "museums"
            : intent.kind === "nature"
              ? "nature attractions"
              : intent.kind === "shop"
                ? "shopping"
                : "things to do";
    const topicIt =
      intent.kind === "restaurant"
        ? "ristoranti tipici"
        : intent.kind === "cafe"
          ? "caffè e bar"
          : intent.kind === "museum"
            ? "musei"
            : intent.kind === "nature"
              ? "natura e panorami"
              : "cose da fare";
    const enc = encodeURIComponent;
    return [
      {
        title: `${topicIt} su TripAdvisor`,
        category: intent.category,
        kind: "web",
        extract: `Risultati e recensioni su TripAdvisor per ${qCity}.`,
        address: "TripAdvisor",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(`${topicIt} ${qCity}`)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(`${topic} ${qCity}`)}`,
        wikiUrl: "",
        webOnly: true,
        notes: `Cerca su TripAdvisor: ${topicIt} ${qCity}`,
      },
      {
        title: `${topicIt} su Google Maps`,
        category: intent.category,
        kind: "web",
        extract: `Mappa e indicazioni per ${topicIt} a ${qCity}.`,
        address: "Google Maps",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(`${qCity}`)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(`${topic} near ${qCity}`)}`,
        wikiUrl: "",
        webOnly: true,
        notes: `Cerca su Google Maps: ${topic} ${qCity}`,
      },
      {
        title: `Guida Wikivoyage — ${qCity}`,
        category: intent.category,
        kind: "web",
        extract: "Guida di viaggio libera (Wikimedia): sezioni Eat / See / Do aggiornate dalla community.",
        address: "Wikivoyage",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(qCity)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(qCity)}`,
        wikiUrl: `https://en.wikivoyage.org/w/index.php?search=${enc(qCity)}`,
        webOnly: true,
        notes: `Wikivoyage: ${qCity}`,
      },
      {
        title: `Lonely Planet — ${qCity}`,
        category: intent.category,
        kind: "web",
        extract: `Articoli e consigli Lonely Planet su ${qCity}.`,
        address: "Lonely Planet",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(qCity)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(qCity)}`,
        wikiUrl: `https://www.lonelyplanet.com/search?q=${enc(qCity)}`,
        webOnly: true,
        notes: `Lonely Planet: ${qCity}`,
      },
    ];
  }

  async function searchPlacesForIntent(destination, intent, lat, lng, title = "") {
    const city = searchCityForDestination(destination, title);
    const seen = new Set();
    const places = [];

    const pushFeature = (feature, { loose = false } = {}) => {
      const props = { ...(feature.properties || {}), name: feature.properties?.name };
      const name = props.name;
      if (!name) return;
      if (isCountryLikePlace(props, name, destination)) return;
      if (!matchesIntentKind(props, intent, { loose })) return;
      const key = String(name).toLowerCase();
      if (seen.has(key)) return;
      const coords = feature.geometry?.coordinates || [];
      const plng = Number(coords[0]);
      const plat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(plat)) {
        const dist = haversineKm({ lat, lng }, { lat: plat, lng: plng });
        if (dist != null && dist > 45) return;
      }
      seen.add(key);
      places.push({
        title: String(name).slice(0, 120),
        category: intent.category,
        kind: props.osm_value || props.type || intent.kind,
        lat: Number.isFinite(plat) ? plat : null,
        lng: Number.isFinite(plng) ? plng : null,
        address: [props.street, props.housenumber, props.city || props.town, props.country]
          .filter(Boolean)
          .join(", "),
        notes: "",
        source: "openstreetmap",
      });
    };

    // 1) Photon with OSM amenity tags + lat/lon bias (best for restaurants/cafes)
    const tags = intent.osmTags || [];
    for (const tag of tags) {
      if (places.length >= 8) break;
      try {
        const params = new URLSearchParams({
          q: `${intent.query} ${city}`,
          limit: "15",
          lang: "en",
          osm_tag: tag,
        });
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          params.set("lat", String(lat));
          params.set("lon", String(lng));
        }
        const photon = await fetch(`https://photon.komoot.io/api/?${params}`, {
          signal: AbortSignal.timeout(12000),
        }).then((r) => r.json());
        for (const feature of photon.features || []) {
          pushFeature(feature);
          if (places.length >= 8) break;
        }
      } catch {
        /* try next tag */
      }
    }

    // 2) Free-text Photon queries (still filtered)
    if (places.length < 4) {
      const queries = [
        `${intent.query} ${city}`,
        `best ${intent.query} in ${city}`,
        `traditional food ${city}`,
        city,
      ];
      for (const q of queries) {
        if (places.length >= 8) break;
        try {
          const params = new URLSearchParams({ q, limit: "15", lang: "en" });
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            params.set("lat", String(lat));
            params.set("lon", String(lng));
          }
          const photon = await fetch(`https://photon.komoot.io/api/?${params}`, {
            signal: AbortSignal.timeout(12000),
          }).then((r) => r.json());
          for (const feature of photon.features || []) {
            pushFeature(feature, { loose: places.length < 2 });
            if (places.length >= 8) break;
          }
        } catch {
          /* next */
        }
      }
    }

    // 3) Overpass via proxy
    if (places.length < 3 && Number.isFinite(lat)) {
      try {
        const res = await fetch(
          `/api/pois?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=8000&kind=${encodeURIComponent(intent.kind)}`,
          { signal: AbortSignal.timeout(20000) }
        );
        const data = await res.json().catch(() => ({}));
        for (const el of data.elements || []) {
          const name = el.tags?.name || el.tags?.["name:en"] || el.tags?.["name:it"];
          if (!name || seen.has(String(name).toLowerCase())) continue;
          if (
            isCountryLikePlace(
              { type: "node", osm_value: el.tags?.amenity || el.tags?.tourism },
              name,
              destination
            )
          ) {
            continue;
          }
          seen.add(String(name).toLowerCase());
          places.push({
            title: String(name).slice(0, 120),
            category: intent.category,
            kind: el.tags?.amenity || el.tags?.tourism || intent.kind,
            lat: el.lat ?? el.center?.lat ?? null,
            lng: el.lon ?? el.center?.lon ?? null,
            address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
            notes: "",
            source: "openstreetmap",
          });
          if (places.length >= 8) break;
        }
      } catch {
        /* ignore */
      }
    }

    // 4) Wikivoyage (reliable Wikimedia travel guide — Eat/See/Do…)
    if (places.length < 6) {
      try {
        const wikiPlaces = await fetchWikivoyagePlaces(city, intent);
        for (const wp of wikiPlaces) {
          const key = wp.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          places.push(wp);
          if (places.length >= 10) break;
        }
      } catch {
        /* ignore */
      }
    }

    // 5) Always append trusted web search shortcuts (TripAdvisor, Maps, Wikivoyage, Lonely Planet)
    const webLinks = reliableWebSearches(city, intent, destination);
    return { places, webLinks, city };
  }

  async function enrichWithWikipedia(places) {
    const out = [];
    const destHint = searchCityForDestination(
      magicTripCache?.destination || "",
      magicTripCache?.title || ""
    );
    for (const place of places.slice(0, 10)) {
      if (place.webOnly) {
        out.push(place);
        continue;
      }
      const enriched = {
        ...place,
        image: place.image || "",
        extract: place.extract || "",
        wikiUrl: place.wikiUrl || "",
      };
      if (!enriched.tripadvisorUrl) {
        enriched.tripadvisorUrl = `https://www.tripadvisor.it/Search?q=${encodeURIComponent(
          `${place.title} ${destHint || magicTripCache?.destination || ""}`
        )}`;
      }
      if (!enriched.mapsUrl) {
        enriched.mapsUrl =
          place.lat != null && place.lng != null
            ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${place.title} ${destHint}`
              )}`;
      }
      if (place.source === "wikivoyage" && enriched.extract) {
        if (!enriched.notes) {
          enriched.notes = [
            enriched.extract.slice(0, 400),
            enriched.tripadvisorUrl ? `TripAdvisor: ${enriched.tripadvisorUrl}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
        out.push(enriched);
        continue;
      }
      try {
        const wikiHosts = ["it.wikipedia.org", "en.wikipedia.org"];
        for (const host of wikiHosts) {
          let title = place.title;
          try {
            const searchQ =
              place.category === "Cibo" || /restaurant|cafe|bar|pub|fast_food/i.test(place.kind || "")
                ? `${place.title} ${destHint} restaurant`
                : `${place.title} ${destHint}`;
            const search = await fetch(
              `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
                searchQ
              )}&srlimit=3&format=json&origin=*`,
              { signal: AbortSignal.timeout(8000) }
            ).then((r) => r.json());
            const hits = search?.query?.search || [];
            const good = hits.find((h) => {
              const t = String(h.title || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/\p{M}/gu, "");
              if (/^(island|islanda|iceland|norway|sweden|france|spain|germany|italy)\b/.test(t)) {
                return false;
              }
              if (/disambigua|disambiguation/i.test(h.snippet || "")) return false;
              return true;
            });
            if (good?.title) title = good.title;
            else if (hits[0]?.title && !/^(island|islanda|iceland)\b/i.test(hits[0].title)) {
              title = hits[0].title;
            } else {
              continue;
            }
          } catch {
            /* keep original title */
          }
          if (isCountryLikePlace({ type: "country" }, title, magicTripCache?.destination)) {
            continue;
          }
          const data = await fetch(
            `https://${host}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|extracts|info&inprop=url&exintro=1&explaintext=1&pithumbsize=320&format=json&origin=*`,
            { signal: AbortSignal.timeout(10000) }
          ).then((r) => r.json());
          const page = Object.values(data?.query?.pages || {})[0];
          if (!page || page.missing != null) continue;
          const extract = String(page.extract || "");
          if (/è uno Stato|is a (Nordic )?country|Repubblica d'/i.test(extract.slice(0, 160))) {
            continue;
          }
          enriched.image = page.thumbnail?.source || enriched.image;
          enriched.extract = extract.slice(0, 280) || enriched.extract;
          enriched.wikiUrl =
            page.fullurl || enriched.wikiUrl || `https://${host}/wiki/${encodeURIComponent(title)}`;
          if (enriched.extract || enriched.image) break;
        }
      } catch {
        /* keep without wiki */
      }
      if (!enriched.notes) {
        enriched.notes = [
          enriched.extract
            ? enriched.extract.slice(0, 400)
            : `Suggerito dalla bacchetta (${enriched.kind})`,
          enriched.tripadvisorUrl ? `TripAdvisor: ${enriched.tripadvisorUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
      out.push(enriched);
    }
    return out;
  }

  function renderPlaceCards(host, places, startIdx = 0) {
    host.innerHTML = "";
    places.forEach((poi, i) => {
      const idx = startIdx + i;
      const card = document.createElement("div");
      card.className = "pv-place-card";
      const isWeb = Boolean(poi.webOnly);
      card.innerHTML = `
        ${
          poi.image
            ? `<img src="${escapeHtml(poi.image)}" alt="" loading="lazy" />`
            : `<div class="pv-ph">${escapeHtml((poi.kind || "luogo").slice(0, 14))}</div>`
        }
        <div>
          <strong>${escapeHtml(poi.title)}</strong>
          <p class="pv-extract">${escapeHtml(poi.extract || poi.address || poi.kind || "Dettagli in arrivo…")}</p>
          <div class="pv-card-actions">
            ${
              isWeb
                ? ""
                : `<button type="button" class="primary" data-add="${idx}">Aggiungi</button>`
            }
            ${
              poi.tripadvisorUrl
                ? `<a class="ghost" href="${escapeHtml(poi.tripadvisorUrl)}" target="_blank" rel="noopener noreferrer">TripAdvisor</a>`
                : ""
            }
            ${
              poi.mapsUrl
                ? `<a class="ghost" href="${escapeHtml(poi.mapsUrl)}" target="_blank" rel="noopener noreferrer">Mappe</a>`
                : ""
            }
            ${
              poi.wikiUrl
                ? `<a class="ghost" href="${escapeHtml(poi.wikiUrl)}" target="_blank" rel="noopener noreferrer">${
                    /wikivoyage|lonelyplanet/i.test(poi.wikiUrl) ? "Apri guida" : "Wiki"
                  }</a>`
                : ""
            }
          </div>
        </div>
      `;
      host.appendChild(card);
    });
    host.querySelectorAll("[data-add]").forEach((btn) => {
      btn.onclick = () => void addSinglePlace(Number(btn.dataset.add), btn);
    });
  }

  async function addSinglePlace(idx, btn) {
    const poi = chatPlaces[idx] || pendingPois[idx];
    if (!poi) return;
    if (poi.webOnly) {
      alert("Questo è un link di ricerca: aprilo con TripAdvisor / Mappe / guida.");
      return;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.stops)) trip.stops = [];
      const exists = trip.stops.some((s) => String(s.title || "").toLowerCase() === poi.title.toLowerCase());
      if (exists) {
        btn.textContent = "Già dentro";
        return;
      }
      const days = tripDays(trip);
      trip.stops.push({
        id: uid(),
        title: poi.title.slice(0, 120),
        day: days[trip.stops.length % Math.max(days.length, 1)] || "",
        time: "",
        category: poi.category || "Visita",
        address: (poi.address || "").slice(0, 300),
        notes: (poi.notes || "").slice(0, 3000),
        lat: poi.lat ?? null,
        lng: poi.lng ?? null,
      });
      await saveTrip(auth, trip, data.revision);
      btn.textContent = "Aggiunto ✓";
    } catch (err) {
      btn.disabled = false;
      btn.textContent = prev;
      alert(err instanceof Error ? err.message : "Non riuscito");
    }
  }

  async function renderChatTab(panel) {
    const dest = magicTripCache?.destination || "la destinazione";
    const greetingWhere = formatDestGreeting(dest, magicTripCache?.title || "");
    panel.innerHTML = `
      ${magicTabsHtml("chiedi")}
      <h3>Chiedi alla bacchetta</h3>
      <p>Scrivi come a un’assistente: ristoranti, musei, idee per la giornata. Ti propongo posti con foto, dettagli e link TripAdvisor.</p>
      <div class="pv-chips" id="pv-chat-chips">
        <button type="button" data-q="Dove mangiare di tipico?">Dove mangiare</button>
        <button type="button" data-q="Musei e cultura">Musei</button>
        <button type="button" data-q="Natura e panorami">Natura</button>
        <button type="button" data-q="Cose da fare con bambini">Con bambini</button>
        <button type="button" data-q="Caffè e bar carini">Caffè / bar</button>
      </div>
      <div class="pv-chat" id="pv-chat-log"></div>
      <div id="pv-chat-results"></div>
      <form class="pv-chat-form" id="pv-chat-form">
        <input type="text" id="pv-chat-input" placeholder="Es. ristoranti ${escapeHtml(greetingWhere)}…" autocomplete="off" />
        <button type="submit">Invia</button>
      </form>
      <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
      <p class="pv-status" id="pv-chat-status"></p>
    `;
    bindMagicTabs(panel);
    const log = panel.querySelector("#pv-chat-log");
    appendBubble(
      log,
      "bot",
      `Ciao! Sono ${greetingWhere}. Dimmi cosa cerchi e preparo proposte da aggiungere all’itinerario.`
    );
    panel.querySelector("#pv-magic-close").onclick = () => {
      panelOpen = false;
      panel.hidden = true;
    };
    panel.querySelectorAll("#pv-chat-chips button").forEach((btn) => {
      btn.onclick = () => {
        const input = panel.querySelector("#pv-chat-input");
        if (input) input.value = "";
        void handleChatAsk(panel, btn.dataset.q);
      };
    });
    panel.querySelector("#pv-chat-form").onsubmit = (ev) => {
      ev.preventDefault();
      const input = panel.querySelector("#pv-chat-input");
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      void handleChatAsk(panel, text);
    };
  }

  function appendBubble(log, role, text) {
    const el = document.createElement("div");
    el.className = `pv-bubble ${role}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  async function handleChatAsk(panel, text) {
    const log = panel.querySelector("#pv-chat-log");
    const results = panel.querySelector("#pv-chat-results");
    const status = panel.querySelector("#pv-chat-status");
    const input = panel.querySelector("#pv-chat-input");
    if (input) input.value = "";
    appendBubble(log, "user", text);
    appendBubble(log, "bot", "Ok, cerco su mappe aperte e guide affidabili…");
    status.textContent = "OpenStreetMap · Wikivoyage · TripAdvisor · Lonely Planet…";
    try {
      const trip = magicTripCache || (await loadTrip()).data.trip;
      magicTripCache = trip;
      const intent = parseChatIntent(text);
      const cityHint = searchCityForDestination(trip.destination, trip.title);
      const place = await geocodeDestination(
        /^(island|ísland|iceland)$/i.test(String(trip.destination || "").trim())
          ? cityHint
          : trip.destination || cityHint
      );
      const found = await searchPlacesForIntent(
        trip.destination,
        intent,
        place.lat,
        place.lng,
        trip.title
      );
      let places = Array.isArray(found) ? found : found.places || [];
      const webLinks = Array.isArray(found) ? [] : found.webLinks || [];
      places = distributeAcrossDays(places, tripDays(trip));
      places = await enrichWithWikipedia(places.filter((p) => !p.webOnly));
      // Concrete places first, then trusted web searches
      const combined = [...places, ...webLinks];
      chatPlaces = combined;
      const concrete = places.length;
      const bots = [...log.querySelectorAll(".pv-bubble.bot")];
      if (bots.length) {
        if (concrete > 0) {
          bots[bots.length - 1].textContent = `Ho trovato ${concrete} ${intentResultLabel(
            intent,
            concrete
          )} da guide e mappe. Sotto anche i link a TripAdvisor, Maps e Wikivoyage.`;
        } else {
          bots[bots.length - 1].textContent =
            `Non ho trovato schede locali, ma puoi cercare su siti affidabili qui sotto (TripAdvisor, Google Maps, Wikivoyage, Lonely Planet).`;
        }
      }
      renderPlaceCards(results, combined);
      status.textContent = concrete
        ? "Fonti: OpenStreetMap / Wikivoyage · link TripAdvisor / Maps / Lonely Planet"
        : "Apri i link sotto per cercare su siti affidabili";
    } catch (err) {
      appendBubble(log, "bot", err instanceof Error ? err.message : "Qualcosa è andato storto.");
      status.textContent = "";
    }
  }

  async function addSelectedPois(panel) {
    const status = panel.querySelector("#pv-magic-status");
    const checked = [...panel.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')].map((el) =>
      Number(el.dataset.idx)
    );
    if (!checked.length) {
      status.textContent = "Seleziona almeno un luogo.";
      return;
    }
    status.textContent = "Aggiungo i luoghi al viaggio…";
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.stops)) trip.stops = [];
      const before = trip.stops.length;
      const existing = new Set(trip.stops.map((s) => String(s.title || "").toLowerCase()));
      for (const idx of checked) {
        const poi = pendingPois[idx];
        if (!poi || existing.has(poi.title.toLowerCase())) continue;
        trip.stops.push({
          id: uid(),
          title: poi.title.slice(0, 120),
          day: poi.day || "",
          time: "",
          category: poi.category || "Visita",
          address: (poi.address || "").slice(0, 300),
          notes: (poi.notes || "").slice(0, 3000),
          lat: poi.lat ?? null,
          lng: poi.lng ?? null,
        });
        existing.add(poi.title.toLowerCase());
      }
      const added = trip.stops.length - before;
      if (!added) {
        status.textContent = "Nessun nuovo luogo da aggiungere.";
        return;
      }
      await saveTrip(auth, trip, data.revision);
      const verify = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const verified = await verify.json().catch(() => ({}));
      const count = Array.isArray(verified?.trip?.stops) ? verified.trip.stops.length : trip.stops.length;
      status.textContent = `Aggiunti ${added} luoghi (ora ${count} in itinerario). Aggiorno…`;
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Salvataggio non riuscito";
    }
  }

  const PHRASEBOOK = {
    en: [
      ["Hello", "Ciao"],
      ["Thank you", "Grazie"],
      ["Please", "Per favore"],
      ["How much is it?", "Quanto costa?"],
      ["Where is the bathroom?", "Dov’è il bagno?"],
      ["I would like…", "Vorrei…"],
      ["Do you speak English?", "Parli inglese?"],
      ["Help!", "Aiuto!"],
      ["The bill, please", "Il conto, per favore"],
      ["Where is…?", "Dove si trova…?"],
    ],
    is: [
      ["Halló", "Ciao"],
      ["Takk", "Grazie"],
      ["Afsakið", "Scusa / Permesso"],
      ["Hvað kostar þetta?", "Quanto costa?"],
      ["Hvar er salernið?", "Dov’è il bagno?"],
      ["Ég ætla að fá…", "Vorrei…"],
      ["Talarðu ensku?", "Parli inglese?"],
      ["Hjálp!", "Aiuto!"],
      ["Reikninginn, takk", "Il conto, per favore"],
      ["Hvar er…?", "Dove si trova…?"],
    ],
    fr: [
      ["Bonjour", "Ciao / Buongiorno"],
      ["Merci", "Grazie"],
      ["S’il vous plaît", "Per favore"],
      ["Ça coûte combien ?", "Quanto costa?"],
      ["Où sont les toilettes ?", "Dov’è il bagno?"],
      ["Je voudrais…", "Vorrei…"],
      ["Parlez-vous anglais ?", "Parli inglese?"],
      ["Au secours !", "Aiuto!"],
      ["L’addition, s’il vous plaît", "Il conto, per favore"],
      ["Où est… ?", "Dove si trova…?"],
    ],
    de: [
      ["Hallo", "Ciao"],
      ["Danke", "Grazie"],
      ["Bitte", "Per favore"],
      ["Was kostet das?", "Quanto costa?"],
      ["Wo ist die Toilette?", "Dov’è il bagno?"],
      ["Ich hätte gern…", "Vorrei…"],
      ["Sprechen Sie Englisch?", "Parli inglese?"],
      ["Hilfe!", "Aiuto!"],
      ["Die Rechnung, bitte", "Il conto, per favore"],
      ["Wo ist…?", "Dove si trova…?"],
    ],
    es: [
      ["Hola", "Ciao"],
      ["Gracias", "Grazie"],
      ["Por favor", "Per favore"],
      ["¿Cuánto cuesta?", "Quanto costa?"],
      ["¿Dónde está el baño?", "Dov’è il bagno?"],
      ["Quisiera…", "Vorrei…"],
      ["¿Habla inglés?", "Parli inglese?"],
      ["¡Ayuda!", "Aiuto!"],
      ["La cuenta, por favor", "Il conto, per favore"],
      ["¿Dónde está…?", "Dove si trova…?"],
    ],
    pt: [
      ["Olá", "Ciao"],
      ["Obrigado / Obrigada", "Grazie"],
      ["Por favor", "Per favore"],
      ["Quanto custa?", "Quanto costa?"],
      ["Onde fica o banheiro?", "Dov’è il bagno?"],
      ["Eu gostaria de…", "Vorrei…"],
      ["Fala inglês?", "Parli inglese?"],
      ["Socorro!", "Aiuto!"],
      ["A conta, por favor", "Il conto, per favore"],
      ["Onde fica…?", "Dove si trova…?"],
    ],
    ja: [
      ["こんにちは (Konnichiwa)", "Ciao"],
      ["ありがとう (Arigatō)", "Grazie"],
      ["お願いします (Onegaishimasu)", "Per favore"],
      ["いくらですか (Ikura desu ka?)", "Quanto costa?"],
      ["トイレはどこですか", "Dov’è il bagno?"],
      ["…をお願いします", "Vorrei…"],
      ["英語を話せますか", "Parli inglese?"],
      ["助けて！", "Aiuto!"],
      ["お会計お願いします", "Il conto, per favore"],
      ["…はどこですか", "Dove si trova…?"],
    ],
  };

  function languageForDestination(destination) {
    const q = String(destination || "").toLowerCase();
    const rules = [
      { re: /islanda|\bisland\b|iceland|reykjav/, code: "is", name: "Islandese", pair: "it|is" },
      { re: /regno unito|uk|inghilterra|scozia|london|londra|ireland|irlanda|usa|stati uniti|canada|australia/, code: "en", name: "Inglese", pair: "it|en" },
      { re: /france|francia|parigi|paris/, code: "fr", name: "Francese", pair: "it|fr" },
      { re: /germania|germany|berlin|monaco|österreich|austria|svizzera|switzerland/, code: "de", name: "Tedesco", pair: "it|de" },
      { re: /spain|spagna|madrid|barcellona|mexico|messico/, code: "es", name: "Spagnolo", pair: "it|es" },
      { re: /portugal|portogallo|lisbona|brasile|brazil/, code: "pt", name: "Portoghese", pair: "it|pt" },
      { re: /giappone|japan|tokyo|osaka|kyoto/, code: "ja", name: "Giapponese", pair: "it|ja" },
      { re: /norvegia|norway/, code: "en", name: "Norvegese (base EN)", pair: "it|no" },
      { re: /svezia|sweden/, code: "en", name: "Svedese (base EN)", pair: "it|sv" },
      { re: /danimarca|denmark/, code: "en", name: "Danese (base EN)", pair: "it|da" },
      { re: /olanda|netherlands|amsterdam/, code: "en", name: "Olandese (base EN)", pair: "it|nl" },
      { re: /grecia|greece|athen/, code: "en", name: "Greco (base EN)", pair: "it|el" },
      { re: /turchia|turkey|istanbul/, code: "en", name: "Turco (base EN)", pair: "it|tr" },
      { re: /polonia|poland/, code: "en", name: "Polacco (base EN)", pair: "it|pl" },
      { re: /italia|rome|roma|milan|firenze/, code: "en", name: "Italiano (sei a casa)", pair: "it|en" },
    ];
    for (const rule of rules) {
      if (rule.re.test(q)) return rule;
    }
    return { code: "en", name: "Inglese", pair: "it|en" };
  }

  async function translateText(text, langpair) {
    const q = String(text || "").trim();
    if (!q) return "";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=${encodeURIComponent(langpair)}`;
    const data = await fetch(url, { signal: AbortSignal.timeout(12000) }).then((r) => r.json());
    const out = data?.responseData?.translatedText;
    if (!out || /INVALID|QUERY LENGTH/i.test(out)) throw new Error("Traduzione non disponibile");
    return out;
  }

  async function renderLanguageTab(panel) {
    const trip = magicTripCache || (await loadTrip()).data.trip;
    magicTripCache = trip;
    const lang = languageForDestination(trip.destination);
    const phrases = PHRASEBOOK[lang.code] || PHRASEBOOK.en;
    const [src, dst] = lang.pair.split("|");

    panel.innerHTML = `
      ${magicTabsHtml("lingua")}
      <h3>Lingua di viaggio</h3>
      <p>Basi per <strong>${escapeHtml(trip.destination)}</strong> · ${escapeHtml(lang.name)}. Frasi utili + traduzione simultanea.</p>
      <div id="pv-phrases"></div>
      <p style="margin:14px 0 8px;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b7076">Traduzione simultanea</p>
      <div class="pv-lang-pair">
        <label>Italiano
          <textarea id="pv-tr-it" placeholder="Scrivi in italiano…"></textarea>
        </label>
        <label>${escapeHtml(lang.name)} (${escapeHtml(dst.toUpperCase())})
          <textarea id="pv-tr-local" placeholder="Traduzione in tempo reale…"></textarea>
        </label>
      </div>
      <p class="pv-status" id="pv-tr-status">Digita sopra: traduco in entrambe le direzioni.</p>
      <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
    `;
    bindMagicTabs(panel);
    const phraseHost = panel.querySelector("#pv-phrases");
    for (const [local, it] of phrases) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-phrase";
      btn.innerHTML = `<strong>${escapeHtml(local)}</strong><span>${escapeHtml(it)}</span>`;
      btn.onclick = () => {
        panel.querySelector("#pv-tr-local").value = local;
        panel.querySelector("#pv-tr-it").value = it;
        panel.querySelector("#pv-tr-status").textContent = "Frase pronta · puoi modificarla e ritradurre.";
      };
      phraseHost.appendChild(btn);
    }
    panel.querySelector("#pv-magic-close").onclick = () => {
      panelOpen = false;
      panel.hidden = true;
    };

    let tIt = 0;
    let tLocal = 0;
    const itBox = panel.querySelector("#pv-tr-it");
    const localBox = panel.querySelector("#pv-tr-local");
    const status = panel.querySelector("#pv-tr-status");

    itBox.addEventListener("input", () => {
      clearTimeout(tIt);
      tIt = setTimeout(async () => {
        const text = itBox.value.trim();
        if (!text) return;
        status.textContent = "Traduco…";
        try {
          localBox.value = await translateText(text, `${src}|${dst}`);
          status.textContent = "Aggiornato";
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : "Errore traduzione";
        }
      }, 450);
    });

    localBox.addEventListener("input", () => {
      clearTimeout(tLocal);
      tLocal = setTimeout(async () => {
        const text = localBox.value.trim();
        if (!text) return;
        status.textContent = "Traduco…";
        try {
          itBox.value = await translateText(text, `${dst}|${src}`);
          status.textContent = "Aggiornato";
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : "Errore traduzione";
        }
      }, 450);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectPackingTemplates() {
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /cose da portare/i.test(el.textContent || "")
    );
    if (!heading) return;
    const host = heading.closest(".section-heading")?.parentElement || heading.parentElement;
    if (!host || host.querySelector(".pv-extras-bar")) return;
    const bar = document.createElement("div");
    bar.className = "pv-extras-bar";
    bar.innerHTML = `<span style="width:100%;font-size:.8rem;color:#5b7076;margin-bottom:2px">Template valigia</span>`;
    for (const name of Object.keys(PACKING_TEMPLATES)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      btn.onclick = () => void applyPackingTemplate(name);
      bar.appendChild(btn);
    }
    const progress = host.querySelector(".packing-progress");
    if (progress) host.insertBefore(bar, progress);
    else host.appendChild(bar);
  }

  async function applyPackingTemplate(name) {
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.checklist)) trip.checklist = [];
      const existing = new Set(trip.checklist.map((c) => String(c.title || "").toLowerCase()));
      for (const title of PACKING_TEMPLATES[name] || []) {
        if (existing.has(title.toLowerCase())) continue;
        trip.checklist.push({ id: uid(), title, done: false });
      }
      await saveTrip(auth, trip, data.revision);
      location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Non riesco ad applicare il template");
    }
  }

  function readPrivateBudgetCents(tripId) {
    if (!tripId) return null;
    try {
      const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
      const user = String(session?.user?.username || "anon")
        .trim()
        .toLowerCase() || "anon";
      const db = JSON.parse(localStorage.getItem("viavia-private-budget-v1") || "{}");
      const v = db[`${user}::${tripId}`];
      return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    } catch {
      return null;
    }
  }

  function writePrivateBudgetCents(tripId, cents) {
    const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
    const user = String(session?.user?.username || "anon")
      .trim()
      .toLowerCase() || "anon";
    const db = JSON.parse(localStorage.getItem("viavia-private-budget-v1") || "{}");
    db[`${user}::${tripId}`] = Math.round(cents);
    localStorage.setItem("viavia-private-budget-v1", JSON.stringify(db));
  }

  function injectBudgetAndCharts() {
    const money = document.querySelector(".money-stats");
    if (money && !money.parentElement.querySelector(".pv-budget-box")) {
      const auth = tripAuth();
      const priv = auth ? readPrivateBudgetCents(auth.id) : null;
      const preset =
        priv != null
          ? String(Math.round(priv) / 100).replace(".", ",")
          : "";
      const box = document.createElement("div");
      box.className = "pv-budget-box";
      box.innerHTML = `
        <strong>Budget privato</strong>
        <p style="margin:0 0 8px;font-size:.82rem;color:#5b7076">Visibile solo a te su questo account. Il resto del viaggio resta condiviso.</p>
        <div class="row">
          <input type="text" inputmode="decimal" placeholder="Es. 1500" aria-label="Budget privato in euro" value="${escapeHtml(preset)}" />
          <button type="button" data-pv-save-budget="1">Salva budget</button>
        </div>
      `;
      money.parentElement.insertBefore(box, money.nextSibling);
      const saveBtn = box.querySelector("[data-pv-save-budget]");
      if (saveBtn) {
        saveBtn.dataset.pvBound = "1";
        saveBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void savePrivateBudgetFromUi(box).catch((err) => {
            alert(err instanceof Error ? err.message : "Budget non salvato");
          });
        });
      }
    }

    // Category breakdown near money-stats or expense list
    const expenseRoot =
      document.querySelector(".expense-columns") ||
      document.querySelector(".money-stats")?.parentElement;
    if (expenseRoot && !expenseRoot.querySelector(".pv-chart-box") && tripAuth()) {
      void renderExpenseChart(expenseRoot);
    }
  }

  async function savePrivateBudgetFromUi(box) {
    const input = box.querySelector("input");
    const cents = parseEuroToCents(input?.value);
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio salvato.");
    // Persist privately first — never rely on the shared trip blob for budget.
    writePrivateBudgetCents(auth.id, cents);
    const btn = box.querySelector("[data-pv-save-budget]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Salvato…";
    }
    // Strip shared budget in background; do not let network delays block private persist.
    const stripShared = (async () => {
      try {
        const { data } = await loadTrip();
        const trip = structuredClone(data.trip);
        trip.budget = 0;
        await saveTrip(auth, trip, data.revision);
      } catch {
        /* private save already done */
      }
      writePrivateBudgetCents(auth.id, cents);
    })();
    await Promise.race([stripShared, new Promise((r) => setTimeout(r, 2500))]);
    writePrivateBudgetCents(auth.id, cents);
    location.reload();
  }

  if (!window.__pvBudgetSaveBound) {
    window.__pvBudgetSaveBound = true;
    document.addEventListener(
      "click",
      (event) => {
        const btn = event.target?.closest?.("[data-pv-save-budget]");
        if (!btn) return;
        // Prefer the direct listener attached on inject; skip if already handled.
        if (btn.dataset.pvBound === "1") return;
        const box = btn.closest(".pv-budget-box");
        if (!box) return;
        event.preventDefault();
        void savePrivateBudgetFromUi(box).catch((err) => {
          alert(err instanceof Error ? err.message : "Budget non salvato");
        });
      },
      true
    );
  }

  async function renderExpenseChart(host) {
    try {
      const { data } = await loadTrip();
      const expenses = data.trip.expenses || [];
      if (host.querySelector(".pv-chart-box")) return;
      if (!expenses.length) {
        const tip = document.createElement("div");
        tip.className = "pv-chart-box";
        tip.innerHTML = `<strong>Spese per categoria</strong><p style="margin:0;color:#5b7076;font-size:.88rem">Aggiungi una spesa per vedere il riparto per categoria.</p>`;
        host.insertBefore(tip, host.firstChild);
        return;
      }
      const byCat = {};
      let total = 0;
      for (const e of expenses) {
        const cat = e.category || "Altro";
        byCat[cat] = (byCat[cat] || 0) + (e.amount || 0);
        total += e.amount || 0;
      }
      const box = document.createElement("div");
      box.className = "pv-chart-box";
      box.innerHTML = `<strong>Spese per categoria</strong>`;
      const max = Math.max(...Object.values(byCat), 1);
      for (const [cat, amount] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
        const row = document.createElement("div");
        row.className = "pv-chart-row";
        row.innerHTML = `
          <span>${escapeHtml(cat)}</span>
          <div class="bar"><div class="fill" style="width:${Math.round((amount / max) * 100)}%"></div></div>
          <span>${formatEuro(amount)}</span>
        `;
        box.appendChild(row);
      }
      const foot = document.createElement("p");
      foot.style.cssText = "margin:8px 0 0;font-size:.8rem;color:#5b7076";
      foot.textContent = `Totale ${formatEuro(total)} · ${Math.round((total / Math.max(data.trip.budget || total, 1)) * 100)}% del budget`;
      box.appendChild(foot);
      host.insertBefore(box, host.firstChild);
    } catch {
      /* ignore when demo / no auth */
    }
  }

  function injectDistancesAndLegend() {
    const iframe = document.querySelector('iframe[src*="map.html"]');
    if (iframe && !iframe.parentElement.querySelector(".pv-day-legend")) {
      const legend = document.createElement("div");
      legend.className = "pv-day-legend";
      tripDaysFromDom().forEach((label, i) => {
        const span = document.createElement("span");
        span.innerHTML = `<i style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></i>${escapeHtml(label)}`;
        legend.appendChild(span);
      });
      if (legend.childElementCount) iframe.parentElement.appendChild(legend);
    }

    // Fallback distance notes when React route-hop is missing (e.g. unordered lists).
    if (document.querySelector(".route-hop") || !tripAuth()) return;
    void annotateStopDistances();
  }

  async function annotateStopDistances() {
    try {
      const { data } = await loadTrip();
      const stops = (data.trip.stops || []).filter((s) => s.lat != null && s.lng != null);
      if (stops.length < 2) return;
      const cards = [...document.querySelectorAll("article.stop-card")];
      if (!cards.length) return;
      for (let i = 0; i < cards.length - 1; i++) {
        const aTitle = cards[i].querySelector("h3")?.textContent?.trim();
        const bTitle = cards[i + 1].querySelector("h3")?.textContent?.trim();
        const a = stops.find((s) => s.title === aTitle);
        const b = stops.find((s) => s.title === bTitle);
        const km = haversineKm(a, b);
        if (km == null) continue;
        if (cards[i].parentElement?.querySelector(".pv-dist-note,.route-hop")) continue;
        const note = document.createElement("p");
        note.className = "pv-dist-note";
        const walkMin = Math.max(1, Math.round((km / 4.5) * 60));
        const driveMin = Math.max(1, Math.round((km / 30) * 60));
        note.textContent =
          km < 10
            ? `↓ ${km.toFixed(1)} km · ~${walkMin} min a piedi / ~${driveMin} min in auto`
            : `↓ ${Math.round(km)} km · ~${driveMin} min in auto`;
        cards[i].insertAdjacentElement("afterend", note);
      }
    } catch {
      /* ignore */
    }
  }

  function weatherLabel(code) {
    return WMO[code] || WMO[Math.floor(Number(code) / 10) * 10] || "Meteo";
  }

  function formatDayIt(iso) {
    try {
      return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(
        new Date(iso + "T12:00:00")
      );
    } catch {
      return iso;
    }
  }

  function currencyForDestination(destination) {
    const q = String(destination || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const rules = [
      // "Island" is a common EN short form / autocomplete leftover for Iceland
      { re: /islanda|\bisland\b|iceland|reykjav|akureyr/, code: "ISK", name: "Corona islandese" },
      { re: /norvegia|norway|oslo|bergen/, code: "NOK", name: "Corona norvegese" },
      { re: /svezia|sweden|stoccolma|stockholm/, code: "SEK", name: "Corona svedese" },
      { re: /danimarca|denmark|copenhagen|copenaghen/, code: "DKK", name: "Corona danese" },
      { re: /regno unito|uk|inghilterra|scozia|london|londra|edinburgh/, code: "GBP", name: "Sterlina" },
      { re: /svizzera|switzerland|zurigo|ginevra|zermatt/, code: "CHF", name: "Franco svizzero" },
      { re: /stati uniti|usa|new york|california|miami|hawaii/, code: "USD", name: "Dollaro USA" },
      { re: /giappone|japan|tokyo|osaka|kyoto/, code: "JPY", name: "Yen" },
      { re: /canada|toronto|vancouver|montreal/, code: "CAD", name: "Dollaro canadese" },
      { re: /australia|sydney|melbourne/, code: "AUD", name: "Dollaro australiano" },
      { re: /polonia|poland|varsavia|krakow|cracovia/, code: "PLN", name: "Złoty" },
      { re: /repubblica ceca|czech|praga|prague/, code: "CZK", name: "Corona ceca" },
      { re: /ungheria|hungary|budapest/, code: "HUF", name: "Fiorino" },
      { re: /romania|bucharest|bucarest/, code: "RON", name: "Leu" },
      { re: /turchia|turkey|istanbul|antalya/, code: "TRY", name: "Lira turca" },
      { re: /thailandia|thailand|bangkok|phuket/, code: "THB", name: "Baht" },
      { re: /singapore/, code: "SGD", name: "Dollaro di Singapore" },
      { re: /hong kong/, code: "HKD", name: "Dollaro di Hong Kong" },
      { re: /cina|china|pechino|shanghai|beijing/, code: "CNY", name: "Yuan" },
      { re: /india|delhi|mumbai|goa/, code: "INR", name: "Rupia indiana" },
      { re: /israele|israel|tel aviv|gerusalemme/, code: "ILS", name: "Shekel" },
      { re: /brasile|brazil|rio|sao paulo/, code: "BRL", name: "Real" },
      { re: /messico|mexico|cancun|tulum/, code: "MXN", name: "Peso messicano" },
      { re: /sudafrica|south africa|cape town|johannesburg/, code: "ZAR", name: "Rand" },
      { re: /nuova zelanda|new zealand|auckland|queenstown/, code: "NZD", name: "Dollaro NZ" },
      // Eurozone leftovers — no local conversion needed
      { re: /\b(italia|france|francia|spain|spagna|germania|germany|portugal|portogallo|greece|grecia|austria|belgio|belgium|olanda|netherlands|irlanda|ireland|finlandia|croatia|croazia)\b/, code: "EUR", name: "Euro" },
    ];
    for (const rule of rules) {
      if (rule.re.test(q)) return { code: rule.code, name: rule.name };
    }
    return null;
  }

  /** Prefer destination; fall back to trip title (e.g. "Vacanza in Islanda" with dest "Island"). */
  function currencyForTrip(trip) {
    if (!trip) return null;
    return (
      currencyForDestination(trip.destination) ||
      currencyForDestination(trip.title) ||
      null
    );
  }

  let weatherCache = null; // { key, mode, daily, destination }
  let weatherShownForDay = null;
  let dayStripClickBound = false;
  let fxDoneKey = "";

  function itineraryHost() {
    // Prefer the panel that actually contains the day strip (not the heading wrapper).
    const strip = document.querySelector(".day-strip");
    if (strip?.parentElement) return strip.parentElement;
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /il nostro itinerario|itinerario/i.test(el.textContent || "")
    );
    return (
      heading?.closest("section") ||
      heading?.closest(".primary-panel") ||
      heading?.parentElement?.parentElement ||
      null
    );
  }

  function insertAfterDayStrip(el) {
    const host = itineraryHost();
    const dayStrip = host?.querySelector(".day-strip");
    if (!host || !dayStrip) return false;
    // Keep day strip first: insert after strip (and after utility-strip if present).
    const utility = dayStrip.nextElementSibling?.classList?.contains("utility-strip")
      ? dayStrip.nextElementSibling
      : null;
    const anchor = utility || dayStrip;
    anchor.insertAdjacentElement("afterend", el);
    return true;
  }

  function getSelectedDayIso(days) {
    const buttons = [...document.querySelectorAll(".day-strip button")];
    if (!buttons.length || !days.length) return null;
    const selected = buttons.find((b) => b.classList.contains("selected")) || buttons[0];
    const idx = buttons.indexOf(selected);
    return days[idx] || days[0] || null;
  }

  function bindDayStripWeather() {
    if (dayStripClickBound) return;
    dayStripClickBound = true;
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.(".day-strip button");
        if (!btn) return;
        setTimeout(() => void syncDayWeather(true), 50);
        setTimeout(() => void syncDayWeather(true), 300);
      },
      true
    );
  }

  function expensesHost() {
    const money = document.querySelector(".money-stats");
    if (money?.parentElement) return money.parentElement;
    const cols = document.querySelector(".expense-columns");
    if (cols?.parentElement) return cols.parentElement;
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /spese di gruppo|spese/i.test((el.textContent || "").trim())
    );
    return heading?.closest("section") || heading?.parentElement?.parentElement || heading?.parentElement || null;
  }

  function parseFxAmount(raw) {
    const n = Number(String(raw || "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function formatFxAmount(n, code) {
    if (!Number.isFinite(n)) return "";
    const digits = code === "JPY" || code === "ISK" || code === "HUF" || n >= 1000 ? 0 : 2;
    return n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  function injectFxCalculator() {
    const auth = tripAuth();
    if (!auth) return;
    // Remove legacy itinerary FX / mega-block if still present.
    document.querySelectorAll(".pv-useful,.pv-fx-box").forEach((el) => el.remove());
    if (document.querySelector(".pv-fx-calc")) return;
    if (fxDoneKey === `${auth.id}:skip`) return;
    const host = expensesHost();
    if (!host) return;

    const box = document.createElement("div");
    box.className = "pv-fx-calc";
    box.id = "pv-fx-calc";
    box.innerHTML = `
      <div class="pv-block-title">Cambio</div>
      <div class="pv-block-meta" id="pv-fx-meta">Caricamento…</div>
      <div id="pv-fx-body"></div>
    `;
    const money = host.querySelector(".money-stats");
    const budget = host.querySelector(".pv-budget-box");
    const chart = host.querySelector(".pv-chart-box");
    if (budget) budget.insertAdjacentElement("afterend", box);
    else if (money) money.insertAdjacentElement("afterend", box);
    else if (chart) chart.insertAdjacentElement("beforebegin", box);
    else host.insertBefore(box, host.firstChild);
    void fillFxCalculator(box, auth.id);
  }

  async function fillFxCalculator(box, tripKey) {
    const meta = box.querySelector("#pv-fx-meta");
    const body = box.querySelector("#pv-fx-body");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const localFx = currencyForTrip(trip);

      if (!localFx || localFx.code === "EUR") {
        fxDoneKey = `${tripKey}:skip`;
        meta.textContent = "Destinazione in euro: nessun cambio necessario.";
        body.innerHTML = "";
        return;
      }

      const fx = await fetch(
        `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${encodeURIComponent(localFx.code)}`,
        { signal: AbortSignal.timeout(10000) }
      ).then((r) => r.json());
      const rate = Number(fx.rates?.[localFx.code]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("no-rate");

      const digits = rate >= 100 ? 0 : 2;
      meta.textContent = `${localFx.name} (${localFx.code}) · ${trip.destination}`;
      body.innerHTML = `
        <p class="pv-fx-rate">1 € = ${rate.toLocaleString("it-IT", { maximumFractionDigits: digits })} ${escapeHtml(localFx.code)}</p>
        <div class="pv-fx-rows">
          <label class="pv-fx-row">
            <input type="text" inputmode="decimal" id="pv-fx-eur" value="1" aria-label="Importo in euro" />
            <span class="code">EUR</span>
          </label>
          <label class="pv-fx-row">
            <input type="text" inputmode="decimal" id="pv-fx-local" aria-label="Importo in ${escapeHtml(localFx.code)}" />
            <span class="code">${escapeHtml(localFx.code)}</span>
          </label>
        </div>
      `;
      const eurInput = body.querySelector("#pv-fx-eur");
      const localInput = body.querySelector("#pv-fx-local");
      let syncing = false;

      const setFromEur = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          localInput.value = "";
          return;
        }
        localInput.value = formatFxAmount(n * rate, localFx.code);
      };
      const setFromLocal = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          eurInput.value = "";
          return;
        }
        eurInput.value = formatFxAmount(n / rate, "EUR");
      };

      setFromEur(eurInput.value);
      eurInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        setFromEur(eurInput.value);
        syncing = false;
      });
      localInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        setFromLocal(localInput.value);
        syncing = false;
      });
      fxDoneKey = `${tripKey}:ok`;
    } catch (err) {
      meta.textContent =
        err instanceof Error && err.message !== "no-rate"
          ? err.message
          : "Cambio non disponibile al momento.";
      body.innerHTML = "";
      fxDoneKey = "";
      // Drop empty shell so the next tick can retry after remount / transient errors.
      box.remove();
    }
  }

  async function fetchTripWeather(trip) {
    const key = `${trip.destination}|${trip.start}|${trip.end}`;
    if (weatherCache?.key === key) return weatherCache;

    const place = await geocodeDestination(trip.destination);
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${encodeURIComponent(trip.start)}&end_date=${encodeURIComponent(trip.end)}`;
    let daily = null;
    let mode = "forecast";
    try {
      const res = await fetch(forecastUrl, { signal: AbortSignal.timeout(12000) });
      const json = await res.json();
      if (res.ok && json.daily?.time?.length) daily = json.daily;
      else throw new Error(json.reason || "forecast-range");
    } catch {
      mode = "climate";
      try {
        const climateUrl =
          `https://climate-api.open-meteo.com/v1/climate?latitude=${place.lat}&longitude=${place.lng}` +
          `&start_date=${encodeURIComponent(trip.start)}&end_date=${encodeURIComponent(trip.end)}` +
          `&models=EC_Earth3P_HR&daily=temperature_2m_mean,precipitation_sum`;
        const json = await fetch(climateUrl, { signal: AbortSignal.timeout(15000) }).then((r) => r.json());
        if (json.daily?.time?.length) daily = json.daily;
      } catch {
        daily = null;
      }
    }
    weatherCache = { key, mode, daily, destination: trip.destination };
    return weatherCache;
  }

  function renderDayWeatherCard(box, trip, dayIso, cache) {
    const meta = box.querySelector("#pv-weather-meta");
    const cardHost = box.querySelector("#pv-weather-day");
    if (!cache?.daily?.time?.length) {
      meta.textContent = "Meteo non disponibile per queste date.";
      cardHost.innerHTML = "";
      return;
    }
    const i = cache.daily.time.indexOf(dayIso);
    if (i < 0) {
      meta.textContent = "Nessuna previsione per questo giorno.";
      cardHost.innerHTML = "";
      return;
    }
    meta.textContent =
      cache.mode === "forecast"
        ? `Previsione · ${formatDayIt(dayIso)}`
        : `Media climatica · ${formatDayIt(dayIso)}`;
    if (cache.mode === "forecast") {
      const code = cache.daily.weather_code?.[i];
      const tmax = cache.daily.temperature_2m_max?.[i];
      const tmin = cache.daily.temperature_2m_min?.[i];
      const rain = cache.daily.precipitation_probability_max?.[i];
      cardHost.innerHTML = `
        <div class="pv-weather-card">
          <strong>${escapeHtml(trip.destination)}</strong>
          <span class="cond">${escapeHtml(weatherLabel(code))}${rain != null ? ` · ${rain}% pioggia` : ""}</span>
          <span class="temp">${tmin != null && tmax != null ? `${Math.round(tmin)}°–${Math.round(tmax)}°` : "—"}</span>
        </div>
      `;
    } else {
      const tmean = cache.daily.temperature_2m_mean?.[i];
      const precip = cache.daily.precipitation_sum?.[i];
      cardHost.innerHTML = `
        <div class="pv-weather-card">
          <strong>${escapeHtml(trip.destination)}</strong>
          <span class="cond">${precip != null ? `${Number(precip).toFixed(1)} mm tipici` : "Clima medio"}</span>
          <span class="temp">${tmean != null ? `~${Math.round(tmean)}°` : "—"}</span>
        </div>
      `;
    }
  }

  async function syncDayWeather(fromClick = false) {
    if (!tripAuth()) return;
    bindDayStripWeather();
    if (!document.querySelector(".day-strip")) {
      document.querySelector(".pv-day-weather")?.remove();
      weatherShownForDay = null;
      return;
    }

    // Only show weather after the user selects a day (click), or when already shown for a day.
    const selectedBtn = document.querySelector(".day-strip button.selected");
    if (!fromClick && !weatherShownForDay && !document.querySelector(".pv-day-weather")) {
      return;
    }
    // First paint with a selected day after a click: proceed.
    if (!selectedBtn && !weatherShownForDay) return;

    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const dayIso = getSelectedDayIso(days);
      if (!dayIso) return;

      if (!fromClick && weatherShownForDay === dayIso && document.querySelector(".pv-day-weather")) {
        return;
      }

      let box = document.querySelector(".pv-day-weather");
      if (!box) {
        box = document.createElement("div");
        box.className = "pv-day-weather";
        box.id = "pv-day-weather";
        box.innerHTML = `
          <div class="pv-block-title">Meteo</div>
          <div class="pv-block-meta" id="pv-weather-meta">Caricamento…</div>
          <div id="pv-weather-day"></div>
        `;
        if (!insertAfterDayStrip(box)) {
          box.remove();
          return;
        }
      } else if (!box.previousElementSibling?.classList?.contains("day-strip") &&
                 !box.previousElementSibling?.classList?.contains("utility-strip") &&
                 !document.querySelector(".day-strip")) {
        /* keep existing placement */
      }

      // Ensure day strip stays above: if somehow weather ended up before strip, move it.
      const host = itineraryHost();
      const strip = host?.querySelector(".day-strip");
      if (host && strip && box.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING) {
        insertAfterDayStrip(box);
      }

      weatherShownForDay = dayIso;
      const cache = await fetchTripWeather(trip);
      renderDayWeatherCard(box, trip, dayIso, cache);
    } catch (err) {
      const box = document.querySelector(".pv-day-weather");
      if (box) {
        const meta = box.querySelector("#pv-weather-meta");
        if (meta) meta.textContent = err instanceof Error ? err.message : "Meteo non disponibile.";
      }
    }
  }

  function injectLinksAfterNotes() {
    if (!tripAuth()) return;
    if (document.querySelector(".pv-links-box")) return;

    // Notes tab content: heading "Appunti di viaggio" + .notes-paper
    const notesHeading = [...document.querySelectorAll("h2")].find((el) =>
      /appunti di viaggio|^note$/i.test((el.textContent || "").trim())
    );
    const notesPaper = document.querySelector(".notes-paper");
    const anchor = notesPaper || notesHeading?.closest(".section-heading") || notesHeading;
    if (!anchor) return;

    const host = notesPaper?.parentElement || notesHeading?.closest("section") || notesHeading?.parentElement;
    if (!host) return;

    const box = document.createElement("div");
    box.className = "pv-links-box";
    box.id = "pv-links-box";
    box.innerHTML = `
      <div class="pv-block-title">Link e azioni</div>
      <div class="pv-action-list" id="pv-actions-list"></div>
      <p class="pv-status" id="pv-links-status"></p>
    `;
    if (notesPaper) notesPaper.insertAdjacentElement("afterend", box);
    else if (notesHeading?.closest(".section-heading")) {
      notesHeading.closest(".section-heading").insertAdjacentElement("afterend", box);
    } else {
      host.appendChild(box);
    }
    void fillLinksBox(box);
  }

  async function fillLinksBox(box) {
    const actionsEl = box.querySelector("#pv-actions-list");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const destQ = encodeURIComponent(trip.destination);
      actionsEl.innerHTML = `
        <a href="https://www.google.com/maps/search/?api=1&query=${destQ}" target="_blank" rel="noopener noreferrer"><span>Apri in Google Maps</span><span class="hint">mappa</span></a>
        <a href="https://it.wikivoyage.org/wiki/Special:Search?search=${destQ}" target="_blank" rel="noopener noreferrer"><span>Guida Wikivoyage</span><span class="hint">consigli</span></a>
        <a href="https://it.wikipedia.org/wiki/Special:Search?search=${destQ}" target="_blank" rel="noopener noreferrer"><span>Wikipedia</span><span class="hint">info</span></a>
        <a href="https://www.google.com/search?q=${encodeURIComponent(trip.destination + " emergenza numero")}" target="_blank" rel="noopener noreferrer"><span>Numeri utili</span><span class="hint">emergenze</span></a>
        <button type="button" id="pv-copy-day"><span>Copia riepilogo del giorno</span><span class="hint">testo</span></button>
        <button type="button" id="pv-copy-trip"><span>Copia riepilogo del viaggio</span><span class="hint">testo</span></button>
      `;
      box.querySelector("#pv-copy-day").onclick = () => void copyDaySummary(box);
      box.querySelector("#pv-copy-trip").onclick = () => void copyTripSummary(box);
    } catch (err) {
      const status = box.querySelector("#pv-links-status");
      if (status) status.textContent = err instanceof Error ? err.message : "Link non disponibili.";
    }
  }

  async function copyDaySummary(box) {
    const status = box.querySelector("#pv-links-status") || box.querySelector("#pv-useful-status");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const day = getSelectedDayIso(days) || days[0] || "";
      const dayIndex = Math.max(0, days.indexOf(day));
      const stops = (trip.stops || []).filter((s) => !day || s.day === day);
      const lines = [
        `${trip.title} — ${trip.destination}`,
        day ? `Giorno ${dayIndex + 1} (${day})` : "Itinerario",
        ...stops.map((s, i) => `${i + 1}. ${s.time ? s.time + " · " : ""}${s.title}${s.address ? " — " + s.address : ""}`),
        stops.length ? "" : "(nessuna tappa)",
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      if (status) status.textContent = "Riepilogo giorno copiato.";
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? err.message : "Copia non riuscita";
    }
  }

  async function copyTripSummary(box) {
    const status = box.querySelector("#pv-links-status") || box.querySelector("#pv-useful-status");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const lines = [
        `${trip.title}`,
        `${trip.destination} · ${trip.start} → ${trip.end}`,
        trip.budget ? `Budget ${formatEuro(trip.budget)}` : "",
        "",
      ];
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const stops = (trip.stops || []).filter((s) => s.day === day);
        lines.push(`Giorno ${i + 1} — ${day}`);
        if (!stops.length) lines.push("  (nessuna tappa)");
        for (const s of stops) lines.push(`  • ${s.time ? s.time + " " : ""}${s.title}`);
        lines.push("");
      }
      await navigator.clipboard.writeText(lines.filter((l, idx, arr) => l || arr[idx - 1]).join("\n").trim());
      if (status) status.textContent = "Riepilogo viaggio copiato.";
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? err.message : "Copia non riuscita";
    }
  }

  function tripDaysFromDom() {
    const labels = [...document.querySelectorAll("button,div,span")]
      .map((el) => (el.textContent || "").trim())
      .filter((t) => /^Giorno\s+\d+/i.test(t))
      .slice(0, 12);
    return [...new Set(labels)];
  }

  // Enrich map postMessage with day colors by patching postMessage calls.
  window.addEventListener("message", (event) => {
    if (event.data?.type === "viavia-ready") {
      void pushColoredMapPoints();
    }
  });

  async function pushColoredMapPoints() {
    const iframe = document.querySelector('iframe[src*="map.html"]');
    if (!iframe?.contentWindow || !tripAuth()) return;
    try {
      const { data } = await loadTrip();
      const days = tripDays(data.trip);
      const dayIndex = Object.fromEntries(days.map((d, i) => [d, i]));
      const points = (data.trip.stops || [])
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: s.id,
          title: s.title,
          lat: s.lat,
          lng: s.lng,
          color: DAY_COLORS[(dayIndex[s.day] ?? days.length) % DAY_COLORS.length],
          day: s.day || "",
        }));
      iframe.contentWindow.postMessage({ type: "viavia-map", points, selected: null, pick: false }, location.origin);
    } catch {
      /* ignore */
    }
  }

  let expenseFxState = { code: "EUR", rate: 1, name: "Euro" };

  function setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function enhanceExpenseCurrencyField() {
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    });
    if (!amountLabel) return;

    const auth = tripAuth();
    if (!auth) return;

    let host = amountLabel.closest(".form-grid") || amountLabel.parentElement;
    if (!host) return;
    if (host.querySelector(".pv-expense-fx")) return;

    let localFx = null;
    let rate = 1;
    try {
      const { data } = await loadTrip();
      localFx = currencyForTrip(data.trip);
      if (localFx && localFx.code !== "EUR") {
        const fx = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${encodeURIComponent(localFx.code)}`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        rate = Number(fx.rates?.[localFx.code]);
        if (!Number.isFinite(rate) || rate <= 0) localFx = null;
      } else {
        localFx = null;
      }
    } catch {
      localFx = null;
    }

    // Re-check after await — React may have remounted.
    if (host.querySelector(".pv-expense-fx")) return;
    if (!document.contains(amountLabel)) return;

    const box = document.createElement("label");
    box.className = "field pv-expense-fx";
    const options = [`<option value="EUR">Euro (€)</option>`];
    if (localFx) {
      options.push(
        `<option value="${escapeHtml(localFx.code)}">${escapeHtml(localFx.name)} (${escapeHtml(localFx.code)})</option>`
      );
    }
    box.innerHTML = `
      <span>Valuta della spesa</span>
      <select id="pv-expense-currency" aria-label="Valuta della spesa">${options.join("")}</select>
      <p class="pv-expense-fx-hint" id="pv-expense-fx-hint"></p>
    `;
    amountLabel.insertAdjacentElement("afterend", box);

    const select = box.querySelector("#pv-expense-currency");
    const hint = box.querySelector("#pv-expense-fx-hint");
    const span = amountLabel.querySelector(":scope > span");
    const input = amountLabel.querySelector("input");
    expenseFxState = {
      code: "EUR",
      rate: localFx ? rate : 1,
      name: localFx?.name || "Euro",
      localCode: localFx?.code || null,
    };

    const refreshHint = () => {
      const code = select.value;
      expenseFxState.code = code;
      if (!span || !input) return;
      if (code === "EUR") {
        span.textContent = "Totale in €";
        hint.textContent = localFx
          ? `Puoi anche inserire l'importo in ${localFx.code}; verrà convertito in euro (condiviso).`
          : "";
        return;
      }
      span.textContent = `Totale in ${code}`;
      const n = parseFxAmount(input.value);
      if (n == null) {
        hint.textContent = `Al salvataggio convertiamo in euro (1 € = ${rate.toLocaleString("it-IT", {
          maximumFractionDigits: rate >= 100 ? 0 : 2,
        })} ${code}).`;
        return;
      }
      const eur = n / rate;
      hint.textContent = `≈ ${eur.toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
      })} · salvato in euro per la condivisione`;
    };

    select.addEventListener("change", refreshHint);
    input?.addEventListener("input", refreshHint);
    refreshHint();
  }

  function convertExpenseAmountBeforeSubmit() {
    const select = document.querySelector("#pv-expense-currency");
    if (!select || select.value === "EUR") return;
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    });
    const input = amountLabel?.querySelector("input");
    if (!input) return;
    const local = parseFxAmount(input.value);
    if (local == null) return;
    const rate = expenseFxState.rate || 1;
    const eur = Math.round((local / rate) * 100) / 100;
    // Keep enough decimals for React kn() parser.
    setNativeInputValue(input, String(eur));
    const titleLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /Per cosa avete speso/i.test((span.textContent || "").trim());
    });
    const titleInput = titleLabel?.querySelector("input");
    if (titleInput && titleInput.value && !new RegExp(`\\b${select.value}\\b`).test(titleInput.value)) {
      setNativeInputValue(titleInput, `${titleInput.value.trim()} (${formatFxAmount(local, select.value)} ${select.value})`);
    }
  }

  if (!window.__pvExpenseFxBound) {
    window.__pvExpenseFxBound = true;
    document.addEventListener(
      "click",
      (event) => {
        const btn = event.target?.closest?.("button[type='submit']");
        if (!btn) return;
        if (!document.querySelector("#pv-expense-currency")) return;
        convertExpenseAmountBeforeSubmit();
      },
      true
    );
    document.addEventListener(
      "submit",
      () => {
        if (!document.querySelector("#pv-expense-currency")) return;
        convertExpenseAmountBeforeSubmit();
      },
      true
    );
  }

  function tick() {
    renderFab();
    injectPackingTemplates();
    injectBudgetAndCharts();
    injectDistancesAndLegend();
    bindDayStripWeather();
    injectFxCalculator();
    void syncDayWeather(false);
    injectLinksAfterNotes();
    void enhanceExpenseCurrencyField();
    markPrivateBudgetLabels();
  }

  function markPrivateBudgetLabels() {
    for (const span of document.querySelectorAll("label.field > span")) {
      const t = (span.textContent || "").trim();
      if (/^Budget opzionale/i.test(t)) span.textContent = "Budget privato (€)";
      if (/^Budget del viaggio$/i.test(t) && !span.dataset.pvPrivate) {
        span.dataset.pvPrivate = "1";
        span.insertAdjacentHTML(
          "beforeend",
          ` <em class="pv-private-tag" style="font-style:normal;margin-left:6px;padding:2px 8px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.7rem;font-weight:700">PRIVATO</em>`
        );
      }
    }
    for (const el of document.querySelectorAll(".budget-card .eyebrow, .money-stats span")) {
      const t = (el.textContent || "").trim();
      if (
        !el.dataset.pvPrivate &&
        (/IL BUDGET/i.test(t) || /^Budget del viaggio$/i.test(t))
      ) {
        el.dataset.pvPrivate = "1";
        el.textContent = "IL TUO BUDGET PRIVATO";
      }
    }
  }

  const obs = new MutationObserver(() => {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => {
    weatherCache = null;
    weatherShownForDay = null;
    fxDoneKey = "";
    magicTripCache = null;
    chatPlaces = [];
    pendingPois = [];
    panelOpen = false;
    document.querySelectorAll(".pv-useful,.pv-fx-box,.pv-fx-calc,.pv-day-weather,.pv-links-box").forEach((el) => el.remove());
    const root = document.getElementById(ROOT_ID);
    if (root) root.innerHTML = "";
    setTimeout(tick, 300);
  });
  setTimeout(tick, 800);
  setTimeout(tick, 2000);
})();
