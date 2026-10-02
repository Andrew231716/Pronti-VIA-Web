(() => {
  const STYLE_ID = "pv-preventivo-css";
  const ROOT_ID = "pv-preventivo-root";
  const STORE_KEY = "viavia-preventivo-v1";
  const VERSION = "20261002-generic";

  const SECTIONS = [
    ["overview", "Panoramica"],
    ["flights", "Voli"],
    ["stays", "Alloggi"],
    ["transport", "Trasporti"],
    ["itinerary", "Itinerario"],
    ["activities", "Attività"],
    ["budget", "Budget"],
    ["sources", "Fonti"],
    ["safety", "Sicurezza"],
    ["export", "Esportazione"],
  ];

  const FALLBACK_PARAMS = {
    title: "Nuovo viaggio",
    destination: "Nuova destinazione",
    departureCity: "Milano, Italia",
    airportsOut: ["MXP", "LIN", "BGY"],
    airportIn: "",
    start: "",
    end: "",
    nights: 3,
    days: 4,
    travelers: 2,
    currency: "EUR",
    language: "it",
    prefs: {
      cheapest: true,
      noHostels: true,
      preferApartmentKitchen: true,
      maxStops: 1,
      compareTransport: true,
      splitVehicles: true,
      freeActivities: true,
      winterSafe: false,
    },
  };

  const OFFICIAL = {
    flights: "https://www.google.com/travel/flights",
    booking: "https://www.booking.com/",
    airbnb: "https://www.airbnb.it/",
    tourism: "https://www.google.com/search?q=official+tourism+website+destination",
    weather: "https://www.google.com/search?q=official+weather+site+destination",
  };

  const DRAFT_KEY = "__draft__";

  let state = {
    open: false,
    section: "overview",
    tripId: "",
    params: clone(FALLBACK_PARAMS),
    scenario: "economico",
    lines: [],
    flightNotes: [],
    stayConfigs: [],
    transport: { strategy: "A", notes: "" },
    sources: [],
    safety: { weather: null, fetchedAt: "" },
    flightFilters: { maxPricePp: "", maxStops: "1", airport: "all", bags: "any" },
    status: "",
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid() {
    return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function fmtMoney(value, currency = "EUR") {
    const n = Number(value || 0);
    try {
      return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  }

  function eurosToCents(value) {
    const n = Number(String(value).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  function tripAuth() {
    const hash = location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const id = params.get("trip");
    const key = params.get("key");
    return id && key ? { id, key } : null;
  }

  function normalizeDestination(value) {
    return String(value || "").trim();
  }

  function getDurationDays(start, end) {
    if (!start && !end) return 4;
    const s = start ? new Date(start) : new Date();
    const e = end ? new Date(end) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 4);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 4;
    const diff = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    return diff + 1;
  }

  function buildGenericParamsFromTrip(trip = null) {
    const destination = normalizeDestination(trip?.destination || trip?.title || "");
    const base = clone(FALLBACK_PARAMS);
    const travelers = Array.isArray(trip?.members) ? Math.max(1, trip.members.length) : Number(trip?.travelers || base.travelers);
    const start = trip?.start || base.start;
    const end = trip?.end || "";
    const duration = getDurationDays(start, end);

    base.title = trip?.title || (destination ? `${destination} — Nuovo viaggio` : base.title);
    base.destination = destination || base.destination;
    base.departureCity = trip?.departureCity || base.departureCity;
    base.airportsOut = Array.isArray(trip?.airportsOut) && trip.airportsOut.length ? trip.airportsOut : base.airportsOut;
    base.airportIn = trip?.airportIn || "";
    base.start = start;
    base.end = end;
    base.travelers = travelers;
    base.nights = Math.max(1, Math.min(30, duration - 1));
    base.days = Math.max(2, duration);
    return base;
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeStore(database) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(database));
    } catch {
      // quota ignored
    }
  }

  function loadStateForTrip(tripId) {
    const database = readStore();
    return database[tripId] || null;
  }

  function persistState() {
    const slot = state.tripId || DRAFT_KEY;
    const database = readStore();
    database[slot] = {
      version: VERSION,
      updated: nowIso(),
      params: state.params,
      scenario: state.scenario,
      lines: state.lines,
      flightNotes: state.flightNotes,
      stayConfigs: state.stayConfigs,
      transport: state.transport,
      sources: state.sources,
      safety: state.safety,
      flightFilters: state.flightFilters,
    };
    writeStore(database);
  }

  async function loadTripRecord() {
    const auth = tripAuth();
    if (!auth) return null;
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.trip) return null;
      return { auth, data };
    } catch {
      return null;
    }
  }

  function defaultBudgetLines(params, scenario) {
    const people = params.travelers || 2;
    const byScenario = {
      economico: { flights: 220, bags: 30, stay: 120, airport: 25, car: 0, fuel: 0, parking: 0, transit: 20, tours: 60, tickets: 25, food: 70, insurance: 18, misc: 25, buffer: 35 },
      intermedio: { flights: 290, bags: 40, stay: 170, airport: 35, car: 80, fuel: 40, parking: 20, transit: 25, tours: 90, tickets: 40, food: 100, insurance: 25, misc: 35, buffer: 50 },
      comfort: { flights: 360, bags: 60, stay: 220, airport: 45, car: 120, fuel: 60, parking: 25, transit: 25, tours: 130, tickets: 60, food: 140, insurance: 35, misc: 50, buffer: 70 },
    };
    const base = byScenario[scenario] || byScenario.economico;
    const labels = [
      ["flights", "Voli (A/R)", "pp"],
      ["bags", "Bagagli", "pp"],
      ["stay", "Alloggi", "pp"],
      ["airport", "Transfer aeroporto", "pp"],
      ["car", "Noleggio auto", "group"],
      ["fuel", "Carburante", "group"],
      ["parking", "Parcheggi", "group"],
      ["transit", "Trasporti", "pp"],
      ["tours", "Escursioni", "pp"],
      ["tickets", "Ingressi", "pp"],
      ["food", "Alimentazione", "pp"],
      ["insurance", "Assicurazione", "pp"],
      ["misc", "Varie", "pp"],
      ["buffer", "Fondo imprevisti", "pp"],
    ];

    return labels.map(([key, title, mode]) => ({
      id: uid(),
      key,
      title,
      mode,
      unitCents: Math.round((base[key] || 0) * 100),
      qty: mode === "group" ? 1 : people,
      status: "STIMA",
      source: "Bozza generica — da verificare sui siti ufficiali",
      url: "",
      verifiedAt: "",
    }));
  }

  function defaultFlightRows(params) {
    const airportsOut = Array.isArray(params.airportsOut) && params.airportsOut.length ? params.airportsOut : ["MXP"];
    const airportIn = params.airportIn || "DESTINAZIONE";
    return airportsOut.map((ap) => ({
      id: uid(),
      from: ap,
      to: airportIn,
      depart: params.start || "",
      returnDate: params.end || "",
      stops: "0-1",
      airline: "",
      totalGroupCents: 0,
      perPersonCents: 0,
      bags: "Da verificare",
      status: "DA VERIFICARE",
      groupFareConfirmed: false,
      source: "Compagnia / Google Flights",
      url: OFFICIAL.flights,
      notes: "La tariffa deve essere verificata con il sito ufficiale della compagnia.",
    }));
  }

  function defaultStayConfigs() {
    return [
      { id: "A", title: "Appartamento condiviso", rooms: 1, baths: 1, kitchen: true, totalCents: 0, status: "DA VERIFICARE", source: "Booking / Airbnb", url: OFFICIAL.booking, notes: "Verifica capienza reale del gruppo." },
      { id: "B", title: "Due appartamenti separati", rooms: 2, baths: 1, kitchen: true, totalCents: 0, status: "DA VERIFICARE", source: "Booking / Airbnb", url: OFFICIAL.airbnb, notes: "Buona soluzione per gruppi numerosi." },
      { id: "C", title: "Hotel / guesthouse", rooms: 2, baths: 2, kitchen: false, totalCents: 0, status: "DA VERIFICARE", source: "Booking", url: OFFICIAL.booking, notes: "Da verificare dimensione camere e bagni." },
    ];
  }

  function defaultSources() {
    return [
      { id: uid(), title: "Google Flights", url: OFFICIAL.flights, kind: "voli" },
      { id: uid(), title: "Booking.com", url: OFFICIAL.booking, kind: "alloggi" },
      { id: uid(), title: "Airbnb", url: OFFICIAL.airbnb, kind: "alloggi" },
      { id: uid(), title: "Official destination page", url: OFFICIAL.tourism, kind: "info" },
      { id: uid(), title: "Official weather page", url: OFFICIAL.weather, kind: "meteo" },
    ];
  }

  function genericItineraryForDestination(params) {
    const destination = normalizeDestination(params.destination || "Destinazione");
    const start = params.start || "Data inizio";
    return [
      { day: start, title: `Arrivo a ${destination}`, category: "Trasporto", address: destination, notes: "Verifica trasporto ufficiale e orari pronti per il primo giorno.", lat: 0, lng: 0 },
      { day: start, title: `Centro storico e orientamento`, category: "Visita", address: destination, notes: "Punti principali e check-in; lasciare spazio alla sistemazione.", lat: 0, lng: 0 },
      { day: start, title: `Giornata principale di visita`, category: "Visita", address: destination, notes: "Programmare le attività principali e verificare ticket e orari ufficiali.", lat: 0, lng: 0 },
      { day: start, title: `Giorno libero / attività opzionale`, category: "Visita", address: destination, notes: "Lascio margine per condizioni meteo, ritardi o preferenze del gruppo.", lat: 0, lng: 0 },
    ];
  }

  function defaultSafety(params) {
    return {
      weather: {
        place: normalizeDestination(params.destination || "Destinazione") || "Destinazione",
        note: "Consulta sempre il sito ufficiale del meteo e le pagine di trasporto / sicurezza della destinazione prima dei trasferimenti principali.",
        sample: "I dati qui sotto sono una base di partenza, non una previsione ufficiale.",
      },
      fetchedAt: "",
    };
  }

  function ensureBudgetLines() {
    if (!state.lines || !state.lines.length) {
      state.lines = defaultBudgetLines(state.params, state.scenario);
    }
  }

  function lineTotal(line) {
    return (Number(line.unitCents || 0) / 100) * (Number(line.qty) || 0);
  }

  function budgetTotals() {
    ensureBudgetLines();
    const group = state.lines.reduce((sum, line) => sum + lineTotal(line), 0);
    const pp = state.params.travelers ? group / state.params.travelers : 0;
    const perDay = state.params.days ? pp / state.params.days : 0;
    const byStatus = { VERIFICATO: 0, STIMA: 0, "DA VERIFICARE": 0, SCADUTO: 0 };
    for (const line of state.lines) {
      const status = byStatus[line.status] != null ? line.status : "STIMA";
      byStatus[status] += lineTotal(line);
    }
    return { group, pp, perDay, byStatus };
  }

  function initWorkingState(tripId, saved) {
    const baseTripParams = buildGenericParamsFromTrip(saved?.tripData || null);
    const mergedParams = saved?.params ? { ...baseTripParams, ...saved.params, prefs: { ...baseTripParams.prefs, ...(saved.params.prefs || {}) } } : baseTripParams;
    state.tripId = tripId || "";
    state.params = mergedParams;
    state.scenario = saved?.scenario || "economico";
    state.lines = saved?.lines?.length ? saved.lines : defaultBudgetLines(state.params, state.scenario);
    state.flightNotes = saved?.flightNotes?.length ? saved.flightNotes : defaultFlightRows(state.params);
    state.stayConfigs = saved?.stayConfigs?.length ? saved.stayConfigs : defaultStayConfigs();
    state.transport = saved?.transport || { strategy: "A", notes: "" };
    state.sources = saved?.sources?.length ? saved.sources : defaultSources();
    state.safety = saved?.safety || defaultSafety(state.params);
    state.flightFilters = saved?.flightFilters || { maxPricePp: "", maxStops: "1", airport: "all", bags: "any" };
    state.section = "overview";
  }

  async function resolveCurrentTrip() {
    const auth = tripAuth();
    if (!auth) return null;
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.trip) return null;
      return data.trip;
    } catch {
      return null;
    }
  }

  async function createTripForCurrentParams() {
    const p = state.params;
    const members = Array.from({ length: p.travelers || 1 }, (_, index) => ({
      id: uid(),
      name: index === 0 ? "Viaggiatore principale" : `Viaggiatore ${index + 1}`,
    }));
    const trip = {
      title: p.title || `${p.destination} — Viaggio`,
      destination: p.destination || "Nuova destinazione",
      start: p.start || "",
      end: p.end || "",
      departureCity: p.departureCity || "Milano, Italia",
      budget: 0,
      members,
      stops: [],
      bookings: [],
      expenses: [],
      transfers: [],
      checklist: [
        { id: uid(), title: "Verifica prezzi e link ufficiali prima di prenotare", done: false },
        { id: uid(), title: "Conferma hotel / appartamento per il gruppo", done: false },
        { id: uid(), title: "Controlla documenti, assicurazione e meteo", done: false },
      ],
      notes: "Preventivo intelligente generato dal viaggio attivo. Tutti i prezzi vanno verificati prima di prenotare.",
    };

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) throw new Error(data.error || "Creazione viaggio non riuscita");

    const draft = loadStateForTrip(DRAFT_KEY);
    state.tripId = data.id;
    if (draft) {
      initWorkingState(data.id, { ...draft, tripData: trip });
      const database = readStore();
      delete database[DRAFT_KEY];
      writeStore(database);
    } else {
      initWorkingState(data.id, { tripData: trip, params: buildGenericParamsFromTrip(trip) });
    }
    persistState();

    const url = new URL(location.href);
    if (url.pathname.endsWith("/index.html")) url.pathname = url.pathname.slice(0, -10) || "/";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.hash = new URLSearchParams({ trip: data.id, key: data.key }).toString();
    location.href = url.toString();
    return data;
  }

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #${ROOT_ID} { position: fixed; inset: 0; z-index: 99999; display: none; background: #f3fafb; }
      #${ROOT_ID}.open { display: flex; flex-direction: column; }
      #${ROOT_ID} .pv-prev-top { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #0b5d60; color: white; }
      #${ROOT_ID} .pv-prev-top h1 { margin: 0; font-size: 1.1rem; }
      #${ROOT_ID} .pv-prev-top button, #${ROOT_ID} button { font: inherit; cursor: pointer; }
      #${ROOT_ID} .pv-prev-tabs { display: flex; gap: 6px; overflow-x: auto; background: #dfeef0; padding: 10px 12px; }
      #${ROOT_ID} .pv-prev-tabs button { border: 1px solid #bfd8d8; border-radius: 999px; padding: 8px 12px; background: white; color: #113e42; }
      #${ROOT_ID} .pv-prev-tabs button.active { background: #0b5d60; color: white; border-color: #0b5d60; }
      #${ROOT_ID} .pv-prev-body { flex: 1; overflow: auto; padding: 14px; max-width: 980px; width: 100%; margin: 0 auto; box-sizing: border-box; }
      #${ROOT_ID} .pv-prev-card { background: white; border: 1px solid #dce9ea; border-radius: 16px; padding: 14px; margin-bottom: 12px; }
      #${ROOT_ID} .pv-prev-card h2 { margin: 0 0 10px; font-size: 1.05rem; color: #0e3438; }
      #${ROOT_ID} .pv-prev-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
      #${ROOT_ID} label.pv-field { display: grid; gap: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #5c6d70; }
      #${ROOT_ID} label.pv-field input, #${ROOT_ID} label.pv-field select, #${ROOT_ID} label.pv-field textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cfe3e5; border-radius: 10px; font: 600 0.96rem inherit; color: #1a2d33; }
      #${ROOT_ID} .pv-prev-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      #${ROOT_ID} .pv-prev-actions button { border: 0; border-radius: 12px; padding: 10px 14px; min-height: 42px; }
      #${ROOT_ID} .pv-prev-actions .primary { background: #0b5d60; color: white; }
      #${ROOT_ID} .pv-prev-actions .ghost { background: #edf6f6; color: #1c3436; }
      #${ROOT_ID} .pv-callout { background: #edf8f8; border: 1px solid #dfeef0; color: #17393d; border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; }
      #${ROOT_ID} .pv-badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; }
      #${ROOT_ID} .pv-badge.STIMA { background: #fff3cd; color: #7b5d00; }
      #${ROOT_ID} .pv-badge.DA\ VERIFICARE { background: #fde8e8; color: #8b1e20; }
      #${ROOT_ID} .pv-badge.VERIFICATO { background: #dff5e8; color: #1f5d3d; }
      #${ROOT_ID} .pv-badge.SCADUTO { background: #efefef; color: #444; }
      #${ROOT_ID} table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
      #${ROOT_ID} th, #${ROOT_ID} td { padding: 8px 6px; border-bottom: 1px solid #edf4f4; text-align: left; vertical-align: top; }
      #${ROOT_ID} a { color: #0b5d60; font-weight: 600; }
      #${ROOT_ID} .pv-status { margin-top: 12px; min-height: 1.3em; font-size: 0.82rem; color: #44666d; }
      .pv-prev-launch { position: fixed; left: 16px; bottom: 18px; background: #0b5d60; color: white; padding: 12px 14px; border: 0; border-radius: 12px; box-shadow: 0 14px 30px rgba(11, 93, 96, 0.18); display: none; z-index: 10000; }
      body.pv-account-ready .pv-prev-launch { display: inline-block; }
      @media (max-width: 640px) { .pv-prev-launch { bottom: 74px; left: 10px; } }
    `;
  }

  function rootEl() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function setOpen(open) {
    state.open = open;
    const root = rootEl();
    if (!root) return;
    root.classList.toggle("open", open);
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) render();
  }

  async function openPreventivo() {
    ensureStyles();
    const draft = loadStateForTrip(DRAFT_KEY);
    const auth = tripAuth();
    let tripData = null;
    if (auth) {
      tripData = await resolveCurrentTrip();
    }
    const saved = auth ? (loadStateForTrip(auth.id) || draft) : draft;
    if (saved) {
      initWorkingState(auth?.id || "", { ...saved, tripData: tripData || saved.tripData || null });
      state.status = tripData ? "Preventivo generato dal viaggio attuale." : "Preventivo caricato dal dispositivo.";
    } else {
      initWorkingState(auth?.id || "", { tripData: tripData || null, params: buildGenericParamsFromTrip(tripData || null) });
      state.status = tripData ? "Nuovo preventivo generato dal viaggio attuale." : "Nessun viaggio aperto: puoi creare un nuovo preventivo generico.";
    }
    setOpen(true);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function field(key, label, value, type = "text") {
    return `<label class="pv-field">${label}<input data-param="${key}" type="${type}" value="${escapeAttr(value)}" /></label>`;
  }

  function renderOverview() {
    const p = state.params;
    return `
      <div class="pv-prev-card">
        <h2>Panoramica</h2>
        <div class="pv-prev-grid">
          ${field("title", "Nome viaggio", p.title)}
          ${field("destination", "Destinazione", p.destination)}
          ${field("departureCity", "Partenza", p.departureCity)}
          ${field("airportIn", "Aeroporto di arrivo", p.airportIn || "")}
          ${field("start", "Data partenza", p.start || "", "date")}
          ${field("end", "Data ritorno", p.end || "", "date")}
          ${field("travelers", "Numero persone", p.travelers || 1, "number")}
          ${field("currency", "Valuta", p.currency)}
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="create-trip">Crea viaggio in Pronti? VIA!</button>
          <button type="button" class="ghost" data-act="save-local">Salva parametri</button>
        </div>
        <p style="margin-top:10px; color:#4e646b;">I prezzi sono inizialmente stime e devono essere verificati sui siti ufficiali prima di prenotare.</p>
      </div>
    `;
  }

  function renderFlights() {
    const rows = state.flightNotes.map((row) => `
      <tr>
        <td>${escapeHtml(row.from)} → ${escapeHtml(row.to)}</td>
        <td>${escapeHtml(row.stops)}</td>
        <td>${escapeHtml(row.bags || "—")}</td>
        <td><input data-flight="${row.id}" data-k="perPersonCents" type="number" min="0" step="1" value="${Math.round((row.perPersonCents || 0) / 100)}" style="width:90px" /></td>
        <td><input data-flight="${row.id}" data-k="totalGroupCents" type="number" min="0" step="1" value="${Math.round((row.totalGroupCents || 0) / 100)}" style="width:110px" /></td>
        <td><span class="pv-badge ${row.groupFareConfirmed ? "VERIFICATO" : "DA VERIFICARE"}">${row.groupFareConfirmed ? "gruppo ok" : "da verificare"}</span></td>
        <td><a href="${escapeAttr(row.url || OFFICIAL.flights)}" target="_blank" rel="noopener">Apri ricerca</a></td>
      </tr>
    `).join("");

    return `
      <div class="pv-prev-card">
        <h2>Voli</h2>
        <p class="pv-callout">Usa link ufficiali della compagnia, Google Flights o sito aeroporto. I prezzi single non vanno usati come prezzo confermato per il gruppo.</p>
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Rotta</th><th>Scali</th><th>Bagagli</th><th>€/pax</th><th>Totale gruppo</th><th>Stato</th><th>Link</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva voli</button></div>
      </div>
    `;
  }

  function renderStays() {
    const cards = state.stayConfigs.map((s) => `
      <div class="pv-prev-card">
        <h2>${escapeHtml(s.title)} <span class="pv-badge ${s.status || "DA VERIFICARE"}">${escapeHtml(s.status || "DA VERIFICARE")}</span></h2>
        <div class="pv-prev-grid">
          <label class="pv-field">Totale 7 notti (€)<input data-stay="${s.id}" data-k="totalEuros" type="number" min="0" value="${Math.round((s.totalCents || 0) / 100)}" /></label>
          <label class="pv-field">Camere<input data-stay="${s.id}" data-k="rooms" type="number" min="0" value="${s.rooms || 0}" /></label>
          <label class="pv-field">Bagni<input data-stay="${s.id}" data-k="baths" type="number" min="0" value="${s.baths || 0}" /></label>
          <label class="pv-field">Cucina<select data-stay="${s.id}" data-k="kitchen"><option value="1" ${s.kitchen ? "selected" : ""}>Sì</option><option value="0" ${!s.kitchen ? "selected" : ""}>No</option></select></label>
        </div>
        <p style="margin-top:10px; color:#4e646b;">${escapeHtml(s.notes || "")}</p>
        ${s.url ? `<p><a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">Apri risorsa</a></p>` : ""}
      </div>
    `).join("");

    return `
      <div class="pv-prev-card"><h2>Alloggi</h2><p>Confronta più soluzioni. Il gruppo non deve usare camere improprie o capienza non verificata.</p></div>
      ${cards}
      <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva alloggi</button></div>
    `;
  }

  function renderTransport() {
    return `
      <div class="pv-prev-card">
        <h2>Trasporti</h2>
        <label class="pv-field">Strategia attiva <select data-transport="strategy"><option value="A" ${state.transport.strategy === "A" ? "selected" : ""}>A — Nessuna auto</option><option value="B" ${state.transport.strategy === "B" ? "selected" : ""}>B — Due auto</option><option value="C" ${state.transport.strategy === "C" ? "selected" : ""}>C — Un veicolo capiente</option></select></label>
        <label class="pv-field" style="margin-top:10px;">Note<textarea data-transport="notes" rows="5">${escapeHtml(state.transport.notes || "")}</textarea></label>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva trasporti</button></div>
      </div>
    `;
  }

  function renderItinerary() {
    const items = genericItineraryForDestination(state.params).map((entry) => `
      <tr><td>${escapeHtml(entry.day)}</td><td><strong>${escapeHtml(entry.title)}</strong><br><span style="color:#546d71;">${escapeHtml(entry.notes)}</span></td><td>${escapeHtml(entry.address)}</td></tr>
    `).join("");
    return `
      <div class="pv-prev-card">
        <h2>Itinerario</h2>
        <p class="pv-callout">L’itinerario è un punto di partenza generico. Puoi adattarlo dopo la verifica dei siti ufficiali e delle condizioni del viaggio.</p>
        <div style="overflow:auto">
          <table><thead><tr><th>Data</th><th>Presa</th><th>Luogo</th></tr></thead><tbody>${items}</tbody></table>
        </div>
        <div class="pv-prev-actions"><button type="button" class="primary">Scrivi tappe nel viaggio</button><button type="button" class="ghost" data-act="save-local">Salva</button></div>
      </div>
    `;
  }

  function renderActivities() {
    const list = [
      ["City tour", "Puntare alle attrazioni principali e lasciare spazio al tempo libero."],
      ["Giornata fuori città", "Verifica trasporti e ticket ufficiali prima della prenotazione."],
      ["Musei / cultura", "Usare i siti ufficiali delle istituzioni."],
      ["Serate / cucina", "Valutare la distanza dal centro e gli orari."],
    ];
    const cards = list.map(([title, note]) => `
      <div class="pv-prev-card">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(note)}</p>
        <p><span class="pv-badge DA VERIFICARE">DA VERIFICARE</span></p>
      </div>
    `).join("");
    return `<div class="pv-prev-card"><h2>Attività</h2><p>Le attività devono essere confermate tramite sito ufficiale e link di prenotazione.</p></div>${cards}`;
  }

  function renderBudget() {
    ensureBudgetLines();
    const totals = budgetTotals();
    const rows = state.lines.map((line) => `
      <tr>
        <td>${escapeHtml(line.title)}<br><span class="pv-badge ${line.status}">${escapeHtml(line.status)}</span></td>
        <td><input data-line="${line.id}" data-k="unitEuros" type="number" min="0" value="${(line.unitCents / 100).toFixed(0)}" style="width:90px" /></td>
        <td><input data-line="${line.id}" data-k="qty" type="number" min="0" value="${line.qty}" style="width:70px" /></td>
        <td>${fmtMoney(lineTotal(line))}</td>
        <td><select data-line="${line.id}" data-k="status"><option value="STIMA" ${line.status === "STIMA" ? "selected" : ""}>STIMA</option><option value="DA VERIFICARE" ${line.status === "DA VERIFICARE" ? "selected" : ""}>DA VERIFICARE</option><option value="VERIFICATO" ${line.status === "VERIFICATO" ? "selected" : ""}>VERIFICATO</option><option value="SCADUTO" ${line.status === "SCADUTO" ? "selected" : ""}>SCADUTO</option></select></td>
      </tr>
    `).join("");

    return `
      <div class="pv-prev-card">
        <h2>Budget</h2>
        <p class="pv-callout">Questi valori sono una base di lavoro: ogni riga può essere modificata manualmente e verificata con i link ufficiali.</p>
        <p><strong>Totale gruppo:</strong> ${fmtMoney(totals.group)} · <strong>/persona:</strong> ${fmtMoney(totals.pp)} · <strong>/giorno:</strong> ${fmtMoney(totals.perDay)}</p>
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Voce</th><th>€ unit.</th><th>Qty</th><th>Totale</th><th>Stato</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="save-local">Salva budget</button>
          <button type="button" class="ghost" data-act="reset-budget">Ripristina budget</button>
        </div>
      </div>
    `;
  }

  function renderSources() {
    const rows = state.sources.map((item) => `
      <tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.title)}</td><td><a href="${escapeAttr(item.url || "#")}" target="_blank" rel="noopener">${escapeHtml(item.url || "Nessun link")}</a></td></tr>
    `).join("");
    return `
      <div class="pv-prev-card">
        <h2>Fonti</h2>
        <p>Per ogni voce puoi usare un sito ufficiale o un primo riferimento. I dati non verificati restano marcati come da verificare.</p>
        <div style="overflow:auto"><table><thead><tr><th>Tipo</th><th>Nome</th><th>URL</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
    `;
  }

  function renderSafety() {
    const weather = state.safety?.weather || {};
    return `
      <div class="pv-prev-card">
        <h2>Sicurezza</h2>
        <p class="pv-callout">Controlla sempre le condizioni climatiche, i collegamenti e i siti ufficiali del paese di destinazione.</p>
        <p><strong>Destinazione:</strong> ${escapeHtml(weather.place || state.params.destination || "Destinazione")}</p>
        <p>${escapeHtml(weather.note || "Nessun dato di sicurezza inserito.")}</p>
        <p style="color:#4e646b;">${escapeHtml(weather.sample || "")}</p>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="fetch-safety">Aggiorna riferimento sicurezza</button></div>
      </div>
    `;
  }

  function renderExport() {
    const totals = budgetTotals();
    return `
      <div class="pv-prev-card">
        <h2>Esportazione</h2>
        <p>Salva il riepilogo del preventivo, stampa PDF o copia il testo riassuntivo.</p>
        <p><strong>${escapeHtml(state.params.title)}</strong><br>${escapeHtml(state.params.destination)} · ${escapeHtml(state.params.start || "Data non impostata")} → ${escapeHtml(state.params.end || "Data non impostata")}</p>
        <p>Totale gruppo: ${fmtMoney(totals.group)} · /persona: ${fmtMoney(totals.pp)}</p>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="export-print">Stampa PDF</button>
          <button type="button" class="ghost" data-act="export-csv">Esporta CSV</button>
          <button type="button" class="ghost" data-act="export-summary">Copia riepilogo</button>
        </div>
      </div>
    `;
  }

  function renderSection() {
    switch (state.section) {
      case "overview": return renderOverview();
      case "flights": return renderFlights();
      case "stays": return renderStays();
      case "transport": return renderTransport();
      case "itinerary": return renderItinerary();
      case "activities": return renderActivities();
      case "budget": return renderBudget();
      case "sources": return renderSources();
      case "safety": return renderSafety();
      case "export": return renderExport();
      default: return renderOverview();
    }
  }

  function render() {
    ensureStyles();
    const root = rootEl();
    const tabs = SECTIONS.map(([id, label]) => `<button type="button" class="${state.section === id ? "active" : ""}" data-section="${id}">${label}</button>`).join("");
    root.innerHTML = `
      <div class="pv-prev-top">
        <h1>Preventivo intelligente</h1>
        <button type="button" data-act="close">Chiudi</button>
      </div>
      <div class="pv-prev-tabs">${tabs}</div>
      <div class="pv-prev-body">${renderSection()}<p class="pv-status">${escapeHtml(state.status || "")}</p></div>
    `;
    bind(root);
  }

  function bind(root) {
    root.querySelectorAll("[data-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.section = btn.getAttribute("data-section");
        render();
      });
    });

    root.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => void onAction(btn.getAttribute("data-act")));
    });

    root.querySelectorAll("[data-param]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-param");
        let value = el.value;
        if (key === "travelers") value = Number(value) || 1;
        if (key === "destination" && !state.params.title) state.params.title = `${value} — Nuovo viaggio`;
        state.params[key] = value;
        persistState();
      });
    });

    root.querySelectorAll("[data-flight]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-flight");
        const key = el.getAttribute("data-k");
        const row = state.flightNotes.find((item) => item.id === id);
        if (!row) return;
        if (key === "perPersonCents" || key === "totalGroupCents") row[key] = eurosToCents(el.value);
        persistState();
      });
    });

    root.querySelectorAll("[data-stay]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-stay");
        const key = el.getAttribute("data-k");
        const row = state.stayConfigs.find((item) => item.id === id);
        if (!row) return;
        if (key === "totalEuros") row.totalCents = eurosToCents(el.value);
        else if (key === "kitchen") row.kitchen = el.value === "1";
        else row[key] = Number(el.value) || 0;
        persistState();
      });
    });

    root.querySelectorAll("[data-line]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-line");
        const key = el.getAttribute("data-k");
        const row = state.lines.find((item) => item.id === id);
        if (!row) return;
        if (key === "unitEuros") row.unitCents = eurosToCents(el.value);
        else if (key === "qty") row.qty = Number(el.value) || 0;
        else if (key === "status") row.status = el.value;
        persistState();
        render();
      });
    });

    root.querySelectorAll("[data-transport]").forEach((el) => {
      el.addEventListener("change", () => {
        state.transport[el.getAttribute("data-transport")] = el.value;
        persistState();
      });
    });
  }

  async function onAction(action) {
    try {
      if (action === "close") {
        setOpen(false);
        return;
      }
      if (action === "save-local") {
        persistState();
        state.status = "Salvato sul dispositivo.";
        render();
        return;
      }
      if (action === "create-trip") {
        state.status = "Creazione viaggio in corso…";
        render();
        await createTripForCurrentParams();
        return;
      }
      if (action === "reset-budget") {
        state.lines = defaultBudgetLines(state.params, state.scenario);
        persistState();
        state.status = "Budget ripristinato.";
        render();
        return;
      }
      if (action === "fetch-safety") {
        state.safety = defaultSafety(state.params);
        state.safety.fetchedAt = nowIso();
        persistState();
        state.status = "Riferimenti sicurezza aggiornati.";
        render();
        return;
      }
      if (action === "export-print") {
        const printWindow = window.open("", "_blank", "noopener,noreferrer");
        if (!printWindow) {
          state.status = "Popup bloccato: apri il PDF in una finestra consentita.";
          render();
          return;
        }
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Preventivo</title></head><body>${escapeHtml(state.params.title)}<br>${escapeHtml(state.params.destination)}<br>${escapeHtml(state.params.start || "")}${escapeHtml(state.params.start && state.params.end ? " → " : "")}${escapeHtml(state.params.end || "")}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 200);
        return;
      }
      if (action === "export-csv") {
        ensureBudgetLines();
        const rows = [["title", "status", "unit_eur", "qty", "total_eur", "source"]];
        state.lines.forEach((line) => {
          rows.push([line.title, line.status, (line.unitCents / 100).toFixed(2), String(line.qty), lineTotal(line).toFixed(2), line.source]);
        });
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "preventivo.csv";
        link.click();
        return;
      }
      if (action === "export-summary") {
        const totals = budgetTotals();
        const summary = [
          state.params.title,
          `${state.params.start || ""} → ${state.params.end || ""}`,
          `${state.params.travelers} persone`,
          `Totale gruppo: ${fmtMoney(totals.group)}`,
          `Per persona: ${fmtMoney(totals.pp)}`,
          "I prezzi sono stime da verificare sui siti ufficiali.",
        ].join("\n");
        await navigator.clipboard.writeText(summary);
        state.status = "Riepilogo copiato.";
        render();
        return;
      }
    } catch (error) {
      state.status = error?.message || "Operazione non riuscita";
      render();
    }
  }

  function launchBtn() {
    let button = document.querySelector(".pv-prev-launch");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "pv-prev-launch";
      button.textContent = "Preventivo intelligente";
      button.addEventListener("click", () => openPreventivo());
      document.body.appendChild(button);
    }
  }

  function tick() {
    ensureStyles();
    launchBtn();
  }

  function boot() {
    ensureStyles();
    tick();
    window.__pvOpenPreventivo = openPreventivo;
    const observer = new MutationObserver(() => tick());
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("hashchange", () => {
      if (state.open && /(?:^|[&#])trip=/.test(location.hash)) setOpen(false);
    });
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
