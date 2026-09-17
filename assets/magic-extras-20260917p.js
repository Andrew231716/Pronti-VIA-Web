/**
 * Free Wanderlog-parity extras for Pronti? VIA!
 * - Bacchetta magica: suggest itinerary stops (Wikipedia / Overpass)
 * - Packing list templates
 * - Budget setter + expense category breakdown
 * - Day-colored map pins (via enriched postMessage + map.html)
 * - Distances between consecutive stops (fallback if React hops missing)
 * - Meteo sul giorno selezionato (Open-Meteo), cambio valuta locale (Frankfurter),
 *   link utili dopo Note, copia riepilogo
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
      #${ROOT_ID} .pv-magic-panel{width:min(360px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;background:#fff;border:1px solid #d7e4e4;border-radius:18px;box-shadow:0 18px 50px rgba(18,40,50,.18);padding:14px}
      #${ROOT_ID} .pv-magic-panel h3{margin:0 0 6px;font-size:1.05rem;color:#16353b}
      #${ROOT_ID} .pv-magic-panel p{margin:0 0 12px;color:#5b7076;font-size:.92rem}
      #${ROOT_ID} .pv-magic-panel label{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid #eef3f3;font-size:.92rem;color:#1d3338}
      #${ROOT_ID} .pv-magic-panel .pv-meta{display:block;color:#6a7f85;font-size:.8rem;margin-top:2px}
      #${ROOT_ID} .pv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #${ROOT_ID} .pv-actions button{appearance:none;border:0;border-radius:12px;padding:10px 12px;font:600 13px inherit;cursor:pointer}
      #${ROOT_ID} .pv-actions .primary{background:#007d82;color:#fff}
      #${ROOT_ID} .pv-actions .ghost{background:#eef5f5;color:#1d3338}
      #${ROOT_ID} .pv-status{font-size:.85rem;color:#5b7076;min-height:1.2em}
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
      .pv-fx-box,.pv-day-weather,.pv-links-box{margin:12px 0 14px;padding:14px 16px;border:1px solid #d9e7e7;border-radius:16px;background:#fff}
      .pv-fx-box .pv-block-title,.pv-day-weather .pv-block-title,.pv-links-box .pv-block-title{margin:0 0 10px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-fx-box .pv-block-meta,.pv-day-weather .pv-block-meta{margin:0 0 10px;font-size:.86rem;color:#5b7076}
      .pv-day-weather{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center}
      .pv-day-weather .pv-block-title{margin:0;width:100%}
      .pv-day-weather .pv-weather-card{flex:1;min-width:160px;padding:0;border:0;background:transparent;display:flex;flex-direction:column;gap:4px}
      .pv-day-weather .pv-weather-card strong{font-size:.92rem;color:#16353b}
      .pv-day-weather .pv-weather-card .temp{font-size:1.15rem;font-weight:700;color:#007d82}
      .pv-day-weather .pv-weather-card .cond{font-size:.82rem;color:#5b7076;line-height:1.35}
      .pv-fx-box .pv-fx-card{padding:12px;border-radius:14px;background:#eef7f7;border:1px solid #c5dede;max-width:280px}
      .pv-fx-box .pv-fx-card .code{display:block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#6a7f85;font-weight:700;margin-bottom:4px}
      .pv-fx-box .pv-fx-card .rate{font-size:1rem;font-weight:700;color:#16353b}
      .pv-fx-box .pv-fx-card .name{display:block;margin-top:2px;font-size:.75rem;color:#5b7076}
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
      if (panelOpen) void runMagicSuggest(panel);
    };
  }

  async function runMagicSuggest(panel) {
    panel.innerHTML = `<h3>Bacchetta magica</h3><p class="pv-status">Cerco idee per la destinazione…</p>`;
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const place = await geocodeDestination(trip.destination);
      const pois = distributeAcrossDays(await fetchPois(place.lat, place.lng), tripDays(trip));
      pendingPois = pois;
      const existing = new Set((trip.stops || []).map((s) => String(s.title || "").toLowerCase()));
      panel.innerHTML = `
        <h3>Bacchetta magica</h3>
        <p>Proposte (Wikipedia / OpenStreetMap) intorno a <strong>${escapeHtml(trip.destination)}</strong>. Scegli cosa aggiungere all’itinerario.</p>
        <div id="pv-magic-list"></div>
        <div class="pv-actions">
          <button type="button" class="primary" id="pv-magic-add">Aggiungi selezionati</button>
          <button type="button" class="ghost" id="pv-magic-close">Chiudi</button>
        </div>
        <p class="pv-status" id="pv-magic-status"></p>
      `;
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
        <h3>Bacchetta magica</h3>
        <p class="pv-status">${escapeHtml(err instanceof Error ? err.message : "Errore")}</p>
        <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
      `;
      panel.querySelector("#pv-magic-close").onclick = () => {
        panelOpen = false;
        panel.hidden = true;
      };
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
      const saved = await saveTrip(auth, trip, data.revision);
      // Confirm persistence before reload (cloud or local fallback).
      const verify = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const verified = await verify.json().catch(() => ({}));
      const count = Array.isArray(verified?.trip?.stops) ? verified.trip.stops.length : trip.stops.length;
      status.textContent = `Aggiunti ${added} luoghi (ora ${count} in itinerario). Aggiorno…`;
      void saved;
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Salvataggio non riuscito";
    }
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

  function injectBudgetAndCharts() {
    const money = document.querySelector(".money-stats");
    if (money && !money.parentElement.querySelector(".pv-budget-box")) {
      const box = document.createElement("div");
      box.className = "pv-budget-box";
      box.innerHTML = `
        <strong>Imposta budget</strong>
        <div class="row">
          <input type="text" inputmode="decimal" placeholder="Es. 1500" aria-label="Budget in euro" />
          <button type="button">Salva budget</button>
        </div>
      `;
      const input = box.querySelector("input");
      const button = box.querySelector("button");
      button.onclick = async () => {
        try {
          const cents = parseEuroToCents(input.value);
          const { auth, data } = await loadTrip();
          const trip = structuredClone(data.trip);
          trip.budget = cents;
          await saveTrip(auth, trip, data.revision);
          location.reload();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Budget non salvato");
        }
      };
      money.parentElement.insertBefore(box, money.nextSibling);
    }

    // Category breakdown near money-stats or expense list
    const expenseRoot =
      document.querySelector(".expense-columns") ||
      document.querySelector(".money-stats")?.parentElement;
    if (expenseRoot && !expenseRoot.querySelector(".pv-chart-box") && tripAuth()) {
      void renderExpenseChart(expenseRoot);
    }
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
    const q = String(destination || "").toLowerCase();
    const rules = [
      { re: /islanda|iceland|reykjav/, code: "ISK", name: "Corona islandese" },
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

  let weatherCache = null; // { key, mode, daily, destination }
  let weatherShownForDay = null;
  let dayStripClickBound = false;
  let fxDoneKey = "";

  function itineraryHost() {
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /il nostro itinerario|itinerario/i.test(el.textContent || "")
    );
    return (
      heading?.closest("section") ||
      heading?.parentElement ||
      document.querySelector(".day-strip")?.parentElement ||
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
    if (el.classList.contains("pv-day-weather")) {
      const existingFx = host.querySelector(".pv-fx-box");
      if (existingFx && existingFx.parentElement === host) {
        host.insertBefore(el, existingFx);
      } else {
        anchor.insertAdjacentElement("afterend", el);
      }
    } else if (el.classList.contains("pv-fx-box")) {
      const weather = host.querySelector(".pv-day-weather");
      if (weather) weather.insertAdjacentElement("afterend", el);
      else anchor.insertAdjacentElement("afterend", el);
    } else {
      anchor.insertAdjacentElement("afterend", el);
    }
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

  function injectFxCard() {
    const auth = tripAuth();
    if (!auth) return;
    // Remove legacy mega-block if still present.
    document.querySelectorAll(".pv-useful").forEach((el) => el.remove());
    if (document.querySelector(".pv-fx-box")) return;
    if (fxDoneKey === auth.id) return;
    if (!document.querySelector(".day-strip")) return;

    const box = document.createElement("div");
    box.className = "pv-fx-box";
    box.id = "pv-fx-box";
    box.innerHTML = `
      <div class="pv-block-title">Cambio</div>
      <div class="pv-block-meta" id="pv-fx-meta">Caricamento…</div>
      <div id="pv-fx"></div>
    `;
    if (!insertAfterDayStrip(box)) {
      box.remove();
      return;
    }
    void fillFxCard(box, auth.id);
  }

  async function fillFxCard(box, tripKey) {
    const fxEl = box.querySelector("#pv-fx");
    const fxMeta = box.querySelector("#pv-fx-meta");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const localFx = currencyForDestination(trip.destination);

      // Eurozone / unknown: no FX card.
      if (!localFx || localFx.code === "EUR") {
        fxDoneKey = tripKey;
        box.remove();
        return;
      }

      try {
        const fx = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${encodeURIComponent(localFx.code)}`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const rate = Number(fx.rates?.[localFx.code]);
        if (!Number.isFinite(rate)) throw new Error("no-rate");
        const digits = rate >= 100 ? 0 : 2;
        fxMeta.textContent = `Valuta locale · ${trip.destination}`;
        fxEl.innerHTML = `<div class="pv-fx-card"><span class="code">${escapeHtml(localFx.code)}</span><div class="rate">1 € = ${rate.toLocaleString("it-IT", { maximumFractionDigits: digits })}</div><span class="name">${escapeHtml(localFx.name)}</span></div>`;
        fxDoneKey = tripKey;
      } catch {
        fxMeta.textContent = "Cambio non disponibile al momento.";
        fxEl.innerHTML = "";
        fxDoneKey = tripKey;
      }
    } catch (err) {
      fxMeta.textContent = err instanceof Error ? err.message : "Cambio non disponibile.";
      fxDoneKey = tripKey;
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

  function tick() {
    renderFab();
    injectPackingTemplates();
    injectBudgetAndCharts();
    injectDistancesAndLegend();
    bindDayStripWeather();
    injectFxCard();
    void syncDayWeather(false);
    injectLinksAfterNotes();
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
    document.querySelectorAll(".pv-useful,.pv-fx-box,.pv-day-weather,.pv-links-box").forEach((el) => el.remove());
    setTimeout(tick, 300);
  });
  setTimeout(tick, 800);
  setTimeout(tick, 2000);
})();
