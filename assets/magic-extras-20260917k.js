/**
 * Free Wanderlog-parity extras for Pronti? VIA!
 * - Bacchetta magica: suggest itinerary stops from OpenStreetMap (Overpass)
 * - Packing list templates
 * - Budget setter
 * - Expense category breakdown
 * - Day-colored map pins (via enriched postMessage + map.html)
 * - Distances between consecutive stops
 */
(() => {
  const STYLE_ID = "pv-magic-extras-css";
  const ROOT_ID = "pv-magic-root";
  const DAY_COLORS = ["#007d82", "#4770b1", "#bb7735", "#8965a7", "#c05f67", "#528545", "#2a9d8f", "#e76f51"];

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
      .pv-dist-note{display:inline-block;margin:4px 0 8px;padding:4px 8px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.78rem;font-weight:600}
      .pv-day-legend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
      .pv-day-legend span{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:#456}
      .pv-day-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
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
    const res = await fetch(`/api/places?scope=destination&q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    const place = (data.places || []).find((p) => p.lat != null && p.lng != null) || (data.places || [])[0];
    if (!place || place.lat == null) throw new Error("Non trovo coordinate per la destinazione.");
    return place;
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
        <p>Proposte gratuite (Wikipedia / OpenStreetMap) intorno a <strong>${escapeHtml(trip.destination)}</strong>. Scegli cosa aggiungere all’itinerario.</p>
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
    bar.innerHTML = `<span style="width:100%;font-size:.8rem;color:#5b7076;margin-bottom:2px">Template valigia (gratuiti)</span>`;
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
      if (!expenses.length) return;
      if (host.querySelector(".pv-chart-box")) return;
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
    // Annotate consecutive stop cards with distance if coordinates are present in map payload / DOM is limited.
    // Instead, enrich map legend under iframe if present.
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
  }

  function tripDaysFromDom() {
    const labels = [...document.querySelectorAll("button,div,span")]
      .map((el) => (el.textContent || "").trim())
      .filter((t) => /^Giorno\s+\d+/i.test(t))
      .slice(0, 12);
    return [...new Set(labels)];
  }

  // Enrich map postMessage with day colors by patching postMessage calls.
  const originalPostMessage = window.postMessage.bind(window);
  // Intercept iframe contentWindow.postMessage from React by wrapping HTMLIFrameElement
  const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
  // Safer: monkey-patch Window.prototype.postMessage cannot see iframe target.
  // Patch EventTarget isn't needed — instead observe and re-post enriched data.
  window.addEventListener("message", (event) => {
    if (event.data?.type === "viavia-ready") {
      // When map is ready, try to push colored points from last known trip cache.
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
  }

  const obs = new MutationObserver(() => {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => setTimeout(tick, 300));
  setTimeout(tick, 800);
  setTimeout(tick, 2000);
})();
