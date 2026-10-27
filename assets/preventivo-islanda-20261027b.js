/**
 * Preventivo intelligente — modulo generico per qualsiasi viaggio in Pronti? VIA!
 * Crea/aggiorna trip via /api/trips, UI overlay, persistenza locale + sync nel trip.
 * Include un preset opzionale «Islanda» come esempio, non come unico percorso.
 * Prezzi: solo STIMA / DA VERIFICARE — mai inventati come VERIFICATO.
 */
(() => {
  const STYLE_ID = "pv-preventivo-css";
  const ROOT_ID = "pv-preventivo-root";
  const STORE_KEY = "viavia-preventivo-v2";
  const STORE_KEY_LEGACY = "viavia-preventivo-v1";
  const VERSION = "20261027b";
  const FAB_POS_KEY = "viavia-preventivo-fab-pos-v3";
  const FAB_SAFE = "max(48px, env(safe-area-inset-bottom, 0px) + 24px)";
  const FAB_DOCK_RIGHT = 18;
  const FAB_SIZE = 62;
  // Lower dock slot — Pronty sits above this one.
  const PREV_FAB_BOTTOM = `calc(${FAB_SAFE})`;
  const PANEL_POS_KEY = "viavia-preventivo-panel-pos";

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

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }

  function defaultDateRange(nights = 7) {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() + 30);
    const s = isoDate(start);
    return { start: s, end: addDays(s, nights), nights, days: nights + 1 };
  }

  const DATE_RANGE = defaultDateRange(7);

  /** Blank template for any new trip */
  const DEFAULT_PARAMS = {
    title: "",
    destination: "",
    departureCity: "Milano, Italia",
    airportsOut: ["MXP", "LIN", "BGY"],
    airportIn: "",
    start: DATE_RANGE.start,
    end: DATE_RANGE.end,
    nights: DATE_RANGE.nights,
    days: DATE_RANGE.days,
    travelers: 2,
    currency: "EUR",
    language: "it",
    prefs: {
      cheapest: true,
      noHostels: true,
      preferApartmentKitchen: true,
      maxStops: 1,
      compareTransport: true,
      splitVehicles: false,
      freeActivities: true,
      winterSafe: false,
    },
  };

  /** Optional example preset (not required). */
  const ICELAND_PRESET = {
    title: "Islanda — Avventura invernale",
    destination: "Islanda",
    departureCity: "Milano, Italia",
    airportsOut: ["MXP", "LIN", "BGY"],
    airportIn: "KEF",
    start: "2027-02-15",
    end: "2027-02-22",
    nights: 7,
    days: 8,
    travelers: 8,
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
      winterSafe: true,
    },
  };

  function officialLinks(params) {
    const dest = encodeURIComponent(params.destination || "destinazione");
    const adults = params.travelers || 2;
    const start = params.start || DATE_RANGE.start;
    const end = params.end || DATE_RANGE.end;
    const from = (params.airportsOut || ["MXP"])[0] || "MXP";
    const to = params.airportIn || dest;
    return {
      googleFlights: `https://www.google.com/travel/flights?q=Flights%20to%20${encodeURIComponent(
        to
      )}%20from%20${encodeURIComponent(from)}%20on%20${start}%20returning%20${end}%20${adults}%20adults`,
      booking: `https://www.booking.com/searchresults.html?ss=${dest}&group_adults=${adults}&checkin=${start}&checkout=${end}`,
      airbnb: `https://www.airbnb.com/s/${dest}/homes?checkin=${start}&checkout=${end}&adults=${adults}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${dest}`,
      easyjet: "https://www.easyjet.com/",
      wizz: "https://www.wizzair.com/",
      ryanair: "https://www.ryanair.com/",
      kayak: "https://www.kayak.it/",
      // Iceland-specific extras (used only by Iceland preset / when destination matches)
      icelandair: "https://www.icelandair.com/",
      visiticeland: "https://www.visiticeland.com/",
      visitreykjavik: "https://visitreykjavik.is/",
      safetravel: "https://safetravel.is/",
      vedur: "https://en.vedur.is/",
      roads: "https://umferdin.is/",
      blueLagoon: "https://www.bluelagoon.com/",
      skyLagoon: "https://www.skylagoon.com/",
      re: "https://www.re.is/",
      citybus: "https://www.straeto.is/",
    };
  }

  const OFFICIAL = officialLinks(DEFAULT_PARAMS);

  function isIcelandTrip(params) {
    const p = params || {};
    return /islanda|iceland|reykjav|keflav/i.test(
      `${p.destination || ""} ${p.title || ""} ${p.airportIn || ""}`
    );
  }

  const ICELAND_ITINERARY_SEED = [
    {
      day: "2027-02-15",
      title: "Arrivo KEF → Reykjavík",
      category: "Trasporto",
      address: "Reykjavík, Islanda",
      notes: "Trasferimento aeroporto (Flybus/taxi condiviso). Check-in. Passeggiata leggera in centro se orari lo permettono.",
      lat: 64.1466,
      lng: -21.9426,
    },
    {
      day: "2027-02-16",
      title: "Reykjavík — centro e lungomare",
      category: "Visita",
      address: "Hallgrímskirkja, Reykjavík",
      notes: "Hallgrímskirkja, Harpa, Sun Voyager. Molto a piedi. Alternativa maltempo: musei / piscine geotermiche cittadine.",
      lat: 64.142,
      lng: -21.9266,
    },
    {
      day: "2027-02-17",
      title: "Golden Circle (giornata)",
      category: "Visita",
      address: "Þingvellir National Park",
      notes: "Þingvellir → Geysir → Gullfoss. Preferire tour organizzato se nessuna auto, oppure 2 auto. Verificare strade su umferdin.is.",
      lat: 64.255,
      lng: -21.129,
    },
    {
      day: "2027-02-18",
      title: "Costa meridionale (fino a Vík se condizioni ok)",
      category: "Visita",
      address: "Seljalandsfoss, Islanda",
      notes: "Seljalandsfoss, Skógafoss, Reynisfjara (attenzione onde!). Non forzare Vík se meteo/strade critiche.",
      lat: 63.6156,
      lng: -19.9885,
    },
    {
      day: "2027-02-19",
      title: "Giorno flessibile / aurora",
      category: "Visita",
      address: "Reykjavík, Islanda",
      notes: "Buffer maltempo. Opzioni: terme (Sky Lagoon / locali), museo, oppure tour aurora SERALE (nessuna garanzia avvistamento).",
      lat: 64.1466,
      lng: -21.9426,
    },
    {
      day: "2027-02-20",
      title: "Attività a scelta (ghiaccio / laguna)",
      category: "Visita",
      address: "Reykjavík area",
      notes: "Grotte di ghiaccio o Blue Lagoon solo se budget e slot disponibili — verificare siti ufficiali. Alternativa economica: piscine pubbliche Reykjavík.",
      lat: 64.1466,
      lng: -21.9426,
    },
    {
      day: "2027-02-21",
      title: "Reykjavík libera + packing",
      category: "Visita",
      address: "Reykjavík, Islanda",
      notes: "Spesa per cena in appartamento, souvenir, preparazione rientro. Eventuale seconda chance aurora.",
      lat: 64.1466,
      lng: -21.9426,
    },
    {
      day: "2027-02-22",
      title: "Transfer → KEF e volo di rientro",
      category: "Trasporto",
      address: "Keflavík Airport (KEF)",
      notes: "Partire con margine (meteo invernale). Flybus o auto. Non programmare tappe lontane il giorno del volo.",
      lat: 63.985,
      lng: -22.6056,
    },
  ];

  function generateDaySeeds(params) {
    if (isIcelandTrip(params) && params.start === ICELAND_PRESET.start) {
      return ICELAND_ITINERARY_SEED;
    }
    const dest = String(params.destination || "destinazione").trim() || "destinazione";
    const start = params.start || DATE_RANGE.start;
    const n = Math.max(1, Number(params.days) || 1);
    const days = [];
    for (let i = 0; i < n; i++) {
      const day = addDays(start, i);
      let title = `${dest} — giorno ${i + 1}`;
      let category = "Visita";
      let notes = "Da pianificare: luoghi, orari e spostamenti.";
      if (i === 0) {
        title = `Arrivo — ${dest}`;
        category = "Trasporto";
        notes = "Transfer, check-in, orientamento. Non sovraccaricare il primo giorno.";
      } else if (i === n - 1) {
        title = `Rientro da ${dest}`;
        category = "Trasporto";
        notes = "Margine per transfer/aeroporto. Evitare tappe lontane il giorno del volo.";
      }
      days.push({
        day,
        title,
        category,
        address: dest,
        notes,
        lat: null,
        lng: null,
      });
    }
    return days;
  }

  function activityCatalog(params) {
    const links = officialLinks(params);
    if (isIcelandTrip(params)) {
      return [
        {
          id: "aurora",
          title: "Tour aurora boreale",
          org: "Operatori locali",
          url: links.re,
          note: "Nessuna garanzia di avvistamento.",
          transport: "Spesso incluso nel tour",
        },
        {
          id: "golden",
          title: "Golden Circle day tour",
          org: "Vari operatori / self-drive",
          url: links.visiticeland,
          note: "Verificare strade aperte.",
          transport: "Tour o auto",
        },
        {
          id: "blue",
          title: "Blue Lagoon / Sky Lagoon",
          org: "Siti ufficiali",
          url: links.blueLagoon,
          note: "Prezzi e slot solo dal sito ufficiale.",
          transport: "Transfer opzionale",
        },
      ];
    }
    const dest = params.destination || "destinazione";
    return [
      {
        id: "walk",
        title: `Centro / quartieri di ${dest}`,
        org: "A piedi / trasporto locale",
        url: links.googleMaps,
        note: "Parti dalle zone pedonabili e dai punti di interesse principali.",
        transport: "A piedi / mezzi pubblici",
      },
      {
        id: "daytrip",
        title: "Escursione giornaliera",
        org: "Tour locali o self-drive",
        url: links.googleMaps,
        note: "Confronta tour organizzati e spostamenti in autonomia.",
        transport: "Tour / auto / treno",
      },
      {
        id: "food",
        title: "Mercati e cucina locale",
        org: "Ristorazione",
        url: links.googleMaps,
        note: "Segna 2–3 opzioni economiche e 1 speciale.",
        transport: "A piedi",
      },
    ];
  }

  const ACTIVITY_CATALOG = activityCatalog(DEFAULT_PARAMS);
  const ITINERARY_SEED = generateDaySeeds(DEFAULT_PARAMS);

  const DRAFT_KEY = "__draft__";

  let state = {
    open: false,
    section: "overview",
    tripId: "",
    params: structuredClone(DEFAULT_PARAMS),
    scenario: "economico",
    lines: [],
    flightNotes: [],
    stayConfigs: [],
    transport: { strategy: "A", notes: "" },
    sources: [],
    safety: { weather: null, fetchedAt: "" },
    flightFilters: { maxPricePp: "", maxStops: "1", airport: "all", bags: "any" },
    liveFlights: [],
    liveStays: [],
    searchBusy: "",
    searchMeta: { flights: null, stays: null },
    status: "",
  };

  function structuredClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function uid() {
    return crypto.randomUUID();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function fmtMoney(cents, currency = "EUR") {
    const n = (Number(cents) || 0) / 100;
    try {
      return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  }

  function eurosToCents(v) {
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  function tripAuth() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    const id = p.get("trip");
    const key = p.get("key");
    if (!id || !key) return null;
    return { id, key };
  }

  async function loadTripRecord() {
    const auth = tripAuth();
    if (!auth) return null;
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.trip) throw new Error(data.error || "Viaggio non disponibile");
    return { auth, data };
  }

  async function saveTripRecord(auth, trip, revision) {
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

  function looksLikeLegacyIcelandDefault(params) {
    if (!params || typeof params !== "object") return false;
    return (
      /islanda|iceland/i.test(String(params.destination || "")) &&
      String(params.start || "") === "2027-02-15" &&
      String(params.end || "") === "2027-02-22" &&
      Number(params.travelers) === 8
    );
  }

  function readStore() {
    try {
      let raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!raw || typeof raw !== "object") {
        // One-time migrate / drop corrupt v1 drafts that wiped title/destination.
        const legacy = JSON.parse(localStorage.getItem(STORE_KEY_LEGACY) || "null");
        if (legacy && typeof legacy === "object") {
          raw = {};
          for (const [id, slot] of Object.entries(legacy)) {
            if (slot?.params && !paramsLookBroken(slot.params)) raw[id] = slot;
          }
          try {
            localStorage.removeItem(STORE_KEY_LEGACY);
          } catch {
            /* ignore */
          }
        } else {
          raw = {};
        }
      }
      if (!raw || typeof raw !== "object") return {};
      // Old builds auto-saved Islanda as the blank template — drop that orphan draft
      // so «nuovo viaggio» starts empty. Explicit «Esempio Islanda» still available.
      if (raw[DRAFT_KEY]?.params && looksLikeLegacyIcelandDefault(raw[DRAFT_KEY].params)) {
        delete raw[DRAFT_KEY];
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(raw));
        } catch {
          /* ignore */
        }
      }
      return raw;
    } catch {
      return {};
    }
  }

  function writeStore(db) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch {
      /* quota */
    }
  }

  function loadStateForTrip(tripId) {
    const db = readStore();
    const hit = db[tripId];
    if (!hit) return null;
    return hit;
  }

  function persistState() {
    const slot = state.tripId || DRAFT_KEY;
    const db = readStore();
    db[slot] = {
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
      liveFlights: state.liveFlights,
      liveStays: state.liveStays,
      searchMeta: state.searchMeta,
    };
    writeStore(db);
  }

  function defaultBudgetLines(params, scenario) {
    const t = params.travelers || 8;
    // Placeholder STIMA only — user must replace with verified quotes.
    const base = {
      economico: {
        flights: 28000, // €280/pp placeholder STIMA
        bags: 4000,
        stay: 18000,
        airport: 3500,
        car: 0,
        fuel: 0,
        parking: 0,
        transit: 6000,
        tours: 9000,
        tickets: 2000,
        food: 14000,
        insurance: 3500,
        misc: 2500,
        buffer: 5000,
      },
      intermedio: {
        flights: 32000,
        bags: 5000,
        stay: 26000,
        airport: 4000,
        car: 12000,
        fuel: 5000,
        parking: 2000,
        transit: 2000,
        tours: 14000,
        tickets: 4000,
        food: 18000,
        insurance: 4000,
        misc: 3500,
        buffer: 7000,
      },
      comfort: {
        flights: 38000,
        bags: 6000,
        stay: 36000,
        airport: 5000,
        car: 18000,
        fuel: 6000,
        parking: 3000,
        transit: 1000,
        tours: 20000,
        tickets: 6000,
        food: 24000,
        insurance: 5000,
        misc: 5000,
        buffer: 10000,
      },
    }[scenario] || {};

    const labels = [
      ["flights", "Voli (A/R)", "pp"],
      ["bags", "Bagagli", "pp"],
      ["stay", "Alloggi (7 notti)", "pp"],
      ["airport", "Transfer aeroporto", "pp"],
      ["car", "Noleggio auto", "group"],
      ["fuel", "Carburante", "group"],
      ["parking", "Parcheggi", "group"],
      ["transit", "Trasporti pubblici", "pp"],
      ["tours", "Escursioni", "pp"],
      ["tickets", "Ingressi", "pp"],
      ["food", "Alimentazione", "pp"],
      ["insurance", "Assicurazione", "pp"],
      ["misc", "Spese accessorie", "pp"],
      ["buffer", "Fondo imprevisti", "pp"],
    ];

    return labels.map(([key, title, mode]) => {
      const unit = base[key] || 0;
      const qty = mode === "group" ? 1 : t;
      return {
        id: uid(),
        key,
        title,
        mode,
        unitCents: unit,
        qty,
        status: "STIMA",
        source: "Template interno — da sostituire con preventivi ufficiali",
        url: "",
        verifiedAt: "",
      };
    });
  }

  function ensureBudgetLines() {
    if (!state.lines?.length) {
      state.lines = defaultBudgetLines(state.params, state.scenario);
    }
  }

  function lineTotal(line) {
    return Math.round((Number(line.unitCents) || 0) * (Number(line.qty) || 0));
  }

  function budgetTotals() {
    ensureBudgetLines();
    const group = state.lines.reduce((s, l) => s + lineTotal(l), 0);
    const pp = state.params.travelers ? Math.round(group / state.params.travelers) : 0;
    const perDay = state.params.days ? Math.round(pp / state.params.days) : 0;
    const byStatus = { VERIFICATO: 0, STIMA: 0, "DA VERIFICARE": 0, SCADUTO: 0 };
    for (const l of state.lines) {
      const st = byStatus[l.status] != null ? l.status : "STIMA";
      byStatus[st] += lineTotal(l);
    }
    return { group, pp, perDay, byStatus };
  }

  function defaultStayConfigs(params) {
    const t = params.travelers || 2;
    const links = officialLinks(params);
    const half = Math.max(1, Math.ceil(t / 2));
    return [
      {
        id: "A",
        title: `Un alloggio per ${t}`,
        rooms: Math.max(1, Math.ceil(t / 2)),
        baths: Math.max(1, Math.ceil(t / 4)),
        kitchen: true,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Booking / Airbnb — verificare capienza gruppo",
        url: links.airbnb,
        notes: `Conferma letti/bagni per ${t} persone prima di segnare come disponibile.`,
      },
      {
        id: "B",
        title: `Due alloggi da ~${half}`,
        rooms: half,
        baths: 2,
        kitchen: true,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Due annunci separati",
        url: links.booking,
        notes: "Spesso più realistico di un unico alloggio grande.",
      },
      {
        id: "C",
        title: "Hotel / camere private (no ostelli)",
        rooms: Math.max(1, Math.ceil(t / 2)),
        baths: Math.max(1, Math.ceil(t / 2)),
        kitchen: false,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Hotel / guesthouse — NO dormitori",
        url: links.booking,
        notes: "Preferire private room.",
      },
      {
        id: "D",
        title: "Altra combinazione trovata",
        rooms: 0,
        baths: 0,
        kitchen: true,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "",
        url: "",
        notes: "Compila dopo ricerca manuale.",
      },
    ];
  }

  function defaultFlightRows(params) {
    const links = officialLinks(params);
    const airports = params.airportsOut?.length ? params.airportsOut : ["MXP"];
    return airports.map((ap) => ({
      id: uid(),
      from: ap,
      to: params.airportIn || "—",
      depart: params.start,
      returnDate: params.end,
      stops: "0-1",
      airline: "",
      totalGroupCents: 0,
      perPersonCents: 0,
      bags: "Da verificare",
      status: "DA VERIFICARE",
      groupFareConfirmed: false,
      source: "Compagnia / Google Flights",
      url: links.googleFlights,
      notes: `Non moltiplicare un prezzo single×${params.travelers || 2} senza conferma disponibilità gruppo.`,
    }));
  }

  async function apiSearch(action, body) {
    const q = `?action=${encodeURIComponent(action)}`;
    const targets = [
      `/api/search${q}`,
      `https://pronti-via-k7es.netlify.app/api/search${q}`,
    ];
    let lastErr;
    for (const url of targets) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Ricerca ${action} non riuscita`);
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error(`Ricerca ${action} non riuscita`);
  }

  async function searchFlightsLive() {
    state.params = refreshDerivedParams(mergeParams(state.params));
    const p = state.params;
    if (!String(p.destination || p.airportIn || "").trim()) {
      throw new Error("Indica destinazione o aeroporto di arrivo prima di cercare i voli.");
    }
    if (!String(p.start || "").trim()) throw new Error("Indica la data di andata.");
    state.searchBusy = "flights";
    state.status = "Cerco voli live…";
    render();
    // Cap origins to keep Netlify function under timeout (live aggregator is slow).
    const origins =
      Array.isArray(p.airportsOut) && p.airportsOut.length
        ? p.airportsOut.slice(0, 2)
        : [p.departureCity || "Milano"];
    const destination = p.airportIn || p.destination;
    const data = await apiSearch("flights", {
      origins,
      destination,
      departure_date: p.start,
      return_date: p.end,
      adults: Math.min(9, Number(p.travelers) || 1),
      currency: p.currency || "EUR",
      maxStops: state.flightFilters?.maxStops,
    });
    state.liveFlights = Array.isArray(data.flights) ? data.flights : [];
    state.searchMeta.flights = {
      fetchedAt: data.fetchedAt || nowIso(),
      count: data.count || state.liveFlights.length,
      disclaimer: data.disclaimer || "",
      query: data.query || {},
    };
    if (state.liveFlights[0]?.url) {
      addSource("Ricerca voli live", state.liveFlights[0].url, "voli");
    }
    state.searchBusy = "";
    state.status =
      state.liveFlights.length > 0
        ? `Trovati ${state.liveFlights.length} voli live. Seleziona un’offerta per usarla nel preventivo.`
        : "Nessun volo live trovato — prova altre date o aeroporti.";
    persistState();
    render();
  }

  async function searchStaysLive() {
    state.params = refreshDerivedParams(mergeParams(state.params));
    const p = state.params;
    if (!String(p.destination || "").trim()) {
      throw new Error("Indica una destinazione prima di cercare gli alloggi.");
    }
    if (!p.start || !p.end) throw new Error("Indica check-in e check-out.");
    state.searchBusy = "stays";
    state.status = "Cerco hotel e appartamenti live…";
    render();
    const adults = Number(p.travelers) || 2;
    const data = await apiSearch("stays", {
      destination: p.destination,
      startDate: p.start,
      endDate: p.end,
      adults,
      rooms: Math.max(1, Math.ceil(adults / 2)),
      currency: p.currency || "EUR",
      nationality: "IT",
      noHostels: p.prefs?.noHostels !== false,
      limit: 12,
    });
    state.liveStays = Array.isArray(data.stays) ? data.stays : [];
    state.searchMeta.stays = {
      fetchedAt: data.fetchedAt || nowIso(),
      count: data.count || state.liveStays.length,
      disclaimer: data.disclaimer || "",
      query: data.query || {},
    };
    const region = data.query?.regionName || p.destination;
    addSource(`Alloggi live · ${region}`, officialLinks(p).booking, "alloggi");
    state.searchBusy = "";
    state.status =
      state.liveStays.length > 0
        ? `Trovati ${state.liveStays.length} alloggi live a ${region}. Seleziona un’opzione per usarla nel preventivo.`
        : "Nessun alloggio live trovato — prova altre date o destinazione.";
    persistState();
    render();
  }

  function applyLiveFlight(offer) {
    if (!offer) return;
    const travelers = Number(state.params.travelers) || 1;
    // Recompute group total for the trip party (offer price may be for fewer adults).
    const offeredAdults = Math.min(9, travelers);
    const pp = offer.perPersonCents || 0;
    const row = {
      id: uid(),
      from: offer.from,
      to: offer.to,
      depart: offer.depart || state.params.start,
      returnDate: offer.returnDate || state.params.end,
      stops: String(offer.stops ?? ""),
      airline: offer.airline || "",
      totalGroupCents: Math.round(pp * travelers),
      perPersonCents: pp,
      bags: offer.bags || "Da verificare",
      status: "STIMA",
      groupFareConfirmed: false,
      source: offer.source || "Live",
      url: offer.url || "",
      notes: `${offer.airline || ""} ${Array.isArray(offer.flightNumbers) ? offer.flightNumbers.join("/") : ""} · prezzo live per ${offeredAdults} pax, ricalcolato su ${travelers}`.trim(),
      live: true,
    };
    state.flightNotes = [row, ...state.flightNotes.filter((f) => !f.live)].slice(0, 20);
    ensureBudgetLines();
    const flightLine = state.lines.find((l) => l.key === "flights");
    if (flightLine) {
      flightLine.unitCents = pp;
      flightLine.qty = travelers;
      flightLine.status = "STIMA";
      flightLine.source = offer.source || "Live voli";
      flightLine.url = offer.url || "";
      flightLine.verifiedAt = nowIso();
    }
    if (offer.url) addSource(offer.airline || "Volo live", offer.url, "voli");
    state.status = `Volo ${offer.airline || ""} ${fmtMoney(pp)}/pax applicato al preventivo (STIMA live).`;
    persistState();
    render();
  }

  function applyLiveStay(stay) {
    if (!stay) return;
    const travelers = Number(state.params.travelers) || 1;
    const nights = Number(state.params.nights) || stay.nights || 1;
    const total = stay.totalCents || 0;
    const pp = Math.round(total / travelers);
    const card = {
      id: "A",
      title: stay.title,
      rooms: Math.max(1, Math.ceil(travelers / 2)),
      baths: Math.max(1, Math.ceil(travelers / 4)),
      kitchen: /kitchen|cucina|appart/i.test(`${stay.title} ${(stay.amenities || []).join(" ")}`),
      totalCents: total,
      status: "STIMA",
      source: stay.source || "Live alloggi",
      url: stay.bookingUrl || stay.url || "",
      notes: `${stay.address || ""} · ${nights} notti · ${stay.starRating != null ? `${stay.starRating}★` : "classe n/d"}`.trim(),
      live: true,
      hotelId: stay.hotelId,
    };
    const rest = state.stayConfigs.filter((s) => s.id !== "A");
    state.stayConfigs = [card, ...rest];
    ensureBudgetLines();
    const stayLine = state.lines.find((l) => l.key === "stay");
    if (stayLine) {
      stayLine.unitCents = pp;
      stayLine.qty = travelers;
      stayLine.title = `Alloggi (${nights} notti)`;
      stayLine.status = "STIMA";
      stayLine.source = stay.source || "Live alloggi";
      stayLine.url = card.url;
      stayLine.verifiedAt = nowIso();
    }
    if (card.url) addSource(stay.title, card.url, "alloggi");
    state.status = `Alloggio «${stay.title}» ${fmtMoney(total)} totale applicato al preventivo (STIMA live).`;
    persistState();
    render();
  }

  function defaultSources(params = state.params) {
    const links = officialLinks(params);
    const base = [
      { id: uid(), title: "Google Flights", url: links.googleFlights, kind: "voli" },
      { id: uid(), title: "Kayak", url: links.kayak, kind: "voli" },
      { id: uid(), title: "easyJet", url: links.easyjet, kind: "voli" },
      { id: uid(), title: "Ryanair", url: links.ryanair, kind: "voli" },
      { id: uid(), title: "Wizz Air", url: links.wizz, kind: "voli" },
      { id: uid(), title: "Booking.com", url: links.booking, kind: "alloggi" },
      { id: uid(), title: "Airbnb", url: links.airbnb, kind: "alloggi" },
      { id: uid(), title: "Google Maps", url: links.googleMaps, kind: "info" },
    ];
    if (isIcelandTrip(params)) {
      base.push(
        { id: uid(), title: "Icelandair", url: links.icelandair, kind: "voli" },
        { id: uid(), title: "Visit Iceland", url: links.visiticeland, kind: "info" },
        { id: uid(), title: "SafeTravel.is", url: links.safetravel, kind: "sicurezza" },
        { id: uid(), title: "Vedur.is", url: links.vedur, kind: "meteo" },
        { id: uid(), title: "Umferdin (strade)", url: links.roads, kind: "strade" }
      );
    }
    return base;
  }

  function mergeParams(savedParams) {
    const base = structuredClone(DEFAULT_PARAMS);
    if (!savedParams || typeof savedParams !== "object") return base;
    for (const [key, val] of Object.entries(savedParams)) {
      if (key === "prefs" && val && typeof val === "object") {
        base.prefs = { ...base.prefs, ...val };
        continue;
      }
      if (val == null) continue;
      if (typeof val === "string" && !val.trim()) continue; // never wipe defaults with ""
      if (Array.isArray(val) && val.length === 0) continue;
      base[key] = val;
    }
    // Critical fields must never stay blank in the UI.
    for (const key of ["title", "destination", "departureCity", "airportIn", "start", "end", "currency"]) {
      if (!String(base[key] || "").trim()) base[key] = DEFAULT_PARAMS[key];
    }
    if (!Array.isArray(base.airportsOut) || !base.airportsOut.length) {
      base.airportsOut = [...DEFAULT_PARAMS.airportsOut];
    }
    const travelers = Number(base.travelers);
    base.travelers = Number.isFinite(travelers) && travelers > 0 ? travelers : DEFAULT_PARAMS.travelers;
    return base;
  }

  function paramsLookBroken(params) {
    if (!params) return true;
    const title = String(params.title || "").trim();
    const dest = String(params.destination || "").trim();
    // Empty draft is valid (any new trip). Partial wipe is broken.
    if (!title && !dest) return false;
    if (!title || !dest) return true;
    return false;
  }

  function refreshDerivedParams(params) {
    const p = { ...params };
    if (p.start && p.end) {
      const a = new Date(`${p.start}T12:00:00`);
      const b = new Date(`${p.end}T12:00:00`);
      const nights = Math.max(1, Math.round((b - a) / 86400000));
      p.nights = nights;
      p.days = nights + 1;
    }
    return p;
  }

  function initWorkingState(tripId, saved) {
    state.tripId = tripId;
    const useSaved = saved?.params && !paramsLookBroken(saved.params);
    state.params = mergeParams(useSaved ? saved.params : null);
    state.scenario = saved?.scenario || "economico";
    state.lines = useSaved && saved?.lines?.length ? saved.lines : defaultBudgetLines(state.params, state.scenario);
    state.flightNotes = useSaved && saved?.flightNotes?.length ? saved.flightNotes : defaultFlightRows(state.params);
    state.stayConfigs = useSaved && saved?.stayConfigs?.length ? saved.stayConfigs : defaultStayConfigs(state.params);
    state.transport = saved?.transport || { strategy: "A", notes: "" };
    state.params = refreshDerivedParams(state.params);
    state.sources = saved?.sources?.length ? saved.sources : defaultSources(state.params);
    state.safety = saved?.safety || { weather: null, fetchedAt: "" };
    state.flightFilters = saved?.flightFilters || { maxPricePp: "", maxStops: "1", airport: "all", bags: "any" };
    state.liveFlights = saved?.liveFlights || [];
    state.liveStays = saved?.liveStays || [];
    state.searchMeta = saved?.searchMeta || { flights: null, stays: null };
    state.searchBusy = "";
    state.section = "overview";
  }

  async function createTripFromPreventivo() {
    state.params = refreshDerivedParams(mergeParams(state.params));
    const p = state.params;
    if (!String(p.destination || "").trim()) {
      throw new Error("Indica una destinazione prima di creare il viaggio.");
    }
    if (!String(p.title || "").trim()) {
      p.title = `${p.destination} — viaggio`;
      state.params = p;
    }
    const links = officialLinks(p);
    const seeds = generateDaySeeds(p);
    const members = Array.from({ length: p.travelers }, (_, i) => ({
      id: uid(),
      name: i === 0 ? accountName() : `Viaggiatore ${i + 1}`,
    }));
    const stops = seeds.map((s) => ({
      id: uid(),
      title: s.title,
      day: s.day,
      time: "",
      category: s.category,
      address: s.address,
      notes: s.notes,
      lat: s.lat,
      lng: s.lng,
    }));
    const checklist = [
      {
        id: uid(),
        title: `Verificare voli per ${p.travelers} su sito compagnia (non solo prezzo single)`,
        done: false,
      },
      { id: uid(), title: "Escludere ostelli / dormitori nella ricerca alloggi", done: false },
      { id: uid(), title: "Controllare meteo e spostamenti locali prima delle uscite", done: false },
      { id: uid(), title: "Assicurazione viaggio (+ auto se prevista)", done: false },
    ];
    if (isIcelandTrip(p)) {
      checklist.push({
        id: uid(),
        title: "Aurora: nessuna garanzia — pianificare alternative indoor",
        done: false,
      });
    }
    const bookings = [
      {
        id: uid(),
        title: `Voli → ${p.airportIn || p.destination} (da confermare)`,
        type: "Volo",
        date: p.start,
        reference: "",
        notes: `Verificare tariffa gruppo ${p.travelers} pax su compagnie / aggregatori.`,
        url: links.googleFlights,
      },
      {
        id: uid(),
        title: `Alloggio ${p.destination} (no ostelli)`,
        type: "Alloggio",
        date: p.start,
        reference: "",
        notes: "Confrontare opzioni con cucina se preferita.",
        url: links.booking,
      },
    ];
    const notes = [
      "Preventivo intelligente — bozza automatica.",
      "Tutti i prezzi nel modulo partono come STIMA o DA VERIFICARE.",
      `Destinazione: ${p.destination}. Preferenze: no ostelli; max ${p.prefs.maxStops} scali.`,
      `Apri «Preventivo intelligente» (v${VERSION}) per voli, alloggi, trasporti, budget e fonti.`,
    ].join("\n");

    const trip = {
      title: p.title,
      destination: p.destination,
      start: p.start,
      end: p.end,
      budget: 0,
      members,
      stops,
      bookings,
      expenses: [],
      transfers: [],
      checklist,
      notes: stampPreventivoNotes(notes),
      meta: { preventivo: buildPreventivoMeta() },
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
      initWorkingState(data.id, draft);
      const db = readStore();
      delete db[DRAFT_KEY];
      writeStore(db);
    } else {
      initWorkingState(data.id, null);
    }
    persistState();

    // Prefetch share blob for quick sharing
    try {
      if (typeof window.__pvPrepareShare === "function") {
        await window.__pvPrepareShare(data.id, data.key);
      }
    } catch {
      /* ignore */
    }

    setOpen(false);
    const url = new URL(location.href);
    if (url.pathname.endsWith("/index.html")) url.pathname = url.pathname.slice(0, -10) || "/";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.searchParams.set("v", VERSION);
    url.searchParams.set("t", String(Date.now()));
    const params = new URLSearchParams({ trip: data.id, key: data.key });
    const ref = typeof window.__pvGetShareRef === "function" ? window.__pvGetShareRef(data.id, data.key) : "";
    if (ref) params.set("s", ref);
    url.hash = params.toString();
    // Full navigation (not hash-only) so the overlay cannot stay stuck open.
    location.href = url.toString();
    return data;
  }

  function accountName() {
    try {
      const s = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
      return (s?.user?.displayName || s?.user?.username || "Viaggiatore").trim() || "Viaggiatore";
    } catch {
      return "Viaggiatore";
    }
  }

  function currentItinerarySeed() {
    return generateDaySeeds(state.params);
  }

  function currentActivities() {
    return activityCatalog(state.params);
  }

  function currentOfficial() {
    return officialLinks(state.params);
  }

  function buildPreventivoMeta() {
    ensureBudgetLines();
    const tot = budgetTotals();
    return {
      version: VERSION,
      updated: nowIso(),
      scenario: state.scenario,
      params: {
        title: state.params.title,
        destination: state.params.destination,
        start: state.params.start,
        end: state.params.end,
        travelers: state.params.travelers,
        currency: state.params.currency || "EUR",
        airportIn: state.params.airportIn,
        departureCity: state.params.departureCity,
      },
      totals: {
        groupCents: tot.group,
        perPersonCents: tot.pp,
        perDayPpCents: tot.perDay,
        byStatus: tot.byStatus,
      },
      lines: (state.lines || []).map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        unitCents: Number(l.unitCents) || 0,
        qty: Number(l.qty) || 0,
        totalCents: lineTotal(l),
        source: l.source || "",
        key: l.key || "",
        mode: l.mode || "",
      })),
      transport: state.transport || { strategy: "A", notes: "" },
      flightNotes: (state.flightNotes || []).slice(0, 12).map((f) => ({
        from: f.from,
        to: f.to,
        airline: f.airline || "",
        stops: f.stops || "",
        perPersonCents: f.perPersonCents || 0,
        status: f.status || "DA VERIFICARE",
        url: f.url || "",
      })),
      stayConfigs: (state.stayConfigs || []).map((s) => ({
        id: s.id,
        title: s.title,
        totalCents: s.totalCents || 0,
        status: s.status || "DA VERIFICARE",
        notes: s.notes || "",
      })),
      sources: (state.sources || []).slice(0, 20).map((s) => ({
        title: s.title,
        url: s.url,
        kind: s.kind || "altro",
      })),
    };
  }

  function applyPreventivoMeta(meta) {
    if (!meta || typeof meta !== "object") return false;
    if (meta.params) state.params = mergeParams(meta.params);
    if (meta.scenario) state.scenario = meta.scenario;
    if (Array.isArray(meta.lines) && meta.lines.length) {
      state.lines = meta.lines.map((l) => {
        const qty = Number(l.qty);
        const unit = Number(l.unitCents);
        const total = Number(l.totalCents);
        // Prefer original unit×qty when present; otherwise flatten total into unit×1.
        const hasUnitQty = Number.isFinite(unit) && Number.isFinite(qty) && qty > 0;
        return {
          id: l.id || uid(),
          title: l.title || "Voce",
          unitCents: hasUnitQty ? unit : Number.isFinite(total) ? total : 0,
          qty: hasUnitQty ? qty : 1,
          status: l.status || "STIMA",
          source: l.source || "",
          url: l.url || "",
          verifiedAt: l.verifiedAt || "",
          key: l.key || "",
          mode: l.mode || "",
        };
      });
    }
    if (meta.transport) state.transport = { strategy: "A", notes: "", ...meta.transport };
    if (Array.isArray(meta.flightNotes) && meta.flightNotes.length) state.flightNotes = meta.flightNotes;
    if (Array.isArray(meta.stayConfigs) && meta.stayConfigs.length) state.stayConfigs = meta.stayConfigs;
    if (Array.isArray(meta.sources) && meta.sources.length) {
      state.sources = meta.sources.map((s) => ({
        id: uid(),
        title: s.title || "Fonte",
        url: s.url || "",
        kind: s.kind || "altro",
      }));
    }
    return true;
  }

  async function refreshShareAfterSave(auth) {
    try {
      if (auth?.id && auth?.key && typeof window.__pvPrepareShare === "function") {
        await window.__pvPrepareShare(auth.id, auth.key);
      }
    } catch {
      /* share refresh best-effort */
    }
  }

  function stampPreventivoNotes(notes, extra) {
    const tot = budgetTotals();
    const stamp = `\n\n[Preventivo ${state.scenario} ${nowIso()}] Totale gruppo ${fmtMoney(tot.group)} · ${fmtMoney(tot.pp)}/pp (include STIMA/DA VERIFICARE).${extra ? " " + extra : ""}`;
    const cleaned = String(notes || "").replace(/\n\n\[Preventivo [^\]]*\][^\n]*/g, "");
    return (cleaned + stamp).slice(0, 4000);
  }

  async function syncPreventivoIntoTrip() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio per sincronizzare il preventivo");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
    meta.preventivo = buildPreventivoMeta();
    trip.meta = meta;
    trip.notes = stampPreventivoNotes(trip.notes);
    persistState();
    let saved;
    try {
      saved = await saveTripRecord(auth, trip, data.revision);
    } catch (err) {
      // One retry after fresh GET (stale revision / concurrent SPA poll).
      const again = await loadTripRecord();
      if (!again) throw err;
      const trip2 = { ...again.data.trip };
      const meta2 = { ...(trip2.meta && typeof trip2.meta === "object" ? trip2.meta : {}) };
      meta2.preventivo = buildPreventivoMeta();
      trip2.meta = meta2;
      trip2.notes = stampPreventivoNotes(trip2.notes);
      saved = await saveTripRecord(again.auth, trip2, again.data.revision);
    }
    // Keep local trip cache (banner) in sync even if share refresh fails.
    try {
      const db = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
      const slot = db[auth.id] || { id: auth.id, key: auth.key };
      slot.trip = saved.trip || trip;
      slot.revision = saved.revision || (Number(data.revision) || 1) + 1;
      slot.key = auth.key;
      slot.updated = new Date().toISOString();
      db[auth.id] = slot;
      localStorage.setItem("viavia-local-trips-v1", JSON.stringify(db));
    } catch {
      /* ignore */
    }
    await refreshShareAfterSave(auth);
    try {
      window.dispatchEvent(new CustomEvent("pv-preventivo-synced", { detail: { tripId: auth.id } }));
    } catch {
      /* ignore */
    }
    state.status = "Preventivo salvato nel viaggio. Il banner in alto è aggiornato.";
    return saved;
  }

  async function syncItineraryToTrip() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio per sincronizzare");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const existingDays = new Set((trip.stops || []).map((s) => s.day + "|" + s.title));
    const add = [];
    for (const seed of currentItinerarySeed()) {
      const key = seed.day + "|" + seed.title;
      if (existingDays.has(key)) continue;
      add.push({
        id: uid(),
        title: seed.title,
        day: seed.day,
        time: "",
        category: seed.category,
        address: seed.address,
        notes: seed.notes,
        lat: seed.lat,
        lng: seed.lng,
      });
    }
    trip.stops = [...(trip.stops || []), ...add].slice(0, 500);
    const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
    meta.preventivo = buildPreventivoMeta();
    trip.meta = meta;
    trip.notes = stampPreventivoNotes(trip.notes, `Itinerario +${add.length} tappe.`);
    const saved = await saveTripRecord(auth, trip, data.revision);
    await refreshShareAfterSave(auth);
    state.status = `Itinerario sincronizzato (+${add.length} tappe). Preventivo nel payload.`;
    return saved;
  }

  async function syncBudgetEstimatesToExpenses() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const members = trip.members || [];
    if (!members.length) throw new Error("Aggiungi almeno un membro");
    const payer = members[0].name;
    ensureBudgetLines();
    const stamp = nowIso().slice(0, 10);
    const newExpenses = state.lines
      .filter((l) => lineTotal(l) > 0)
      .map((l) => {
        const amount = lineTotal(l);
        const shareEach = Math.floor(amount / members.length);
        let rem = amount - shareEach * members.length;
        const shares = members.map((m, i) => ({
          member: m.name,
          amount: shareEach + (i < rem ? 1 : 0),
        }));
        return {
          id: uid(),
          title: `[${l.status}] ${l.title}`,
          amount,
          payer,
          date: stamp,
          category: "Altro",
          shares,
        };
      });
    trip.expenses = [...(trip.expenses || []), ...newExpenses].slice(0, 1000);
    const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
    meta.preventivo = buildPreventivoMeta();
    trip.meta = meta;
    trip.notes = stampPreventivoNotes(trip.notes, "Spese STIMA aggiunte. Verificare e correggere.");
    await saveTripRecord(auth, trip, data.revision);
    await refreshShareAfterSave(auth);
    state.status = `Aggiunte ${newExpenses.length} spese stimate alle Spese di gruppo.`;
  }

  async function resolveDestinationCoords(params) {
    if (isIcelandTrip(params)) {
      return { lat: 64.15, lon: -21.94, label: "Reykjavík" };
    }
    const q = String(params.destination || "").trim();
    if (!q) return null;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=it&format=json`;
    const res = await fetch(geoUrl);
    const data = await res.json();
    const hit = Array.isArray(data?.results) ? data.results[0] : null;
    if (!hit || hit.latitude == null || hit.longitude == null) return null;
    const label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
    return { lat: hit.latitude, lon: hit.longitude, label: label || q };
  }

  async function fetchWinterSafety() {
    // Climate normals — not a forecast for the trip dates.
    try {
      const place = await resolveDestinationCoords(state.params);
      if (!place) {
        state.safety = {
          weather: {
            place: state.params.destination || "—",
            note: "Indica una destinazione riconosciuta, oppure consulta meteo e avvisi ufficiali locali.",
            sample: "",
          },
          fetchedAt: nowIso(),
        };
        state.status = "Destinazione non geolocalizzata — usa fonti ufficiali.";
        persistState();
        render();
        return;
      }
      const url =
        `https://climate-api.open-meteo.com/v1/climate?latitude=${place.lat}&longitude=${place.lon}` +
        `&start_date=1991-01-01&end_date=2020-12-31&models=EC_Earth3P_HR&daily=temperature_2m_mean`;
      const res = await fetch(url);
      const data = await res.json();
      const icelandNote = isIcelandTrip(state.params)
        ? " Non è una previsione. Usa vedur.is a ridosso del viaggio."
        : " Non è una previsione del tuo viaggio: verifica meteo locale a ridosso delle date.";
      state.safety = {
        weather: {
          place: `${place.label} (clima 1991–2020, Open-Meteo)`,
          note: icelandNote.trim(),
          sample: Array.isArray(data?.daily?.temperature_2m_mean)
            ? `Serie climatica disponibile (${data.daily.temperature_2m_mean.length} punti).`
            : "Dati climatici non disponibili al momento.",
        },
        fetchedAt: nowIso(),
      };
      addSource("Open-Meteo Climate API", url, "meteo");
      persistState();
      state.status = "Dati climatici caricati (non previsione).";
    } catch {
      state.safety = {
        weather: {
          place: state.params.destination || "destinazione",
          note: isIcelandTrip(state.params)
            ? "API clima non raggiungibile. Consulta https://en.vedur.is/ e https://safetravel.is/"
            : "API clima non raggiungibile. Consulta meteo e avvisi ufficiali della destinazione.",
          sample: "",
        },
        fetchedAt: nowIso(),
      };
      state.status = "Clima non scaricato — usa fonti ufficiali.";
    }
    render();
  }

  function addSource(title, url, kind) {
    if (state.sources.some((s) => s.url === url)) return;
    state.sources.push({ id: uid(), title, url, kind: kind || "altro" });
  }

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (style && style.dataset.pvReady === VERSION) return;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:0;z-index:90;display:none;font-family:inherit;pointer-events:none}
      #${ROOT_ID}.open{display:block}
      #${ROOT_ID} .pv-prev-scrim{position:fixed;inset:0;background:rgba(12,32,36,.22);pointer-events:auto}
      #${ROOT_ID} .pv-prev-shell{
        position:fixed;right:16px;bottom:calc(${FAB_SAFE} + ${FAB_SIZE * 2 + 28}px);z-index:2;pointer-events:auto;
        width:min(420px,calc(100vw - 24px));height:min(78vh,700px);
        display:flex;flex-direction:column;background:#f4fafb;
        border:1px solid #d0e0e0;border-radius:22px;
        box-shadow:0 22px 60px rgba(12,40,48,.28);overflow:hidden;
      }
      #${ROOT_ID} .pv-prev-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#124048;color:#fff;cursor:grab;touch-action:none}
      #${ROOT_ID} .pv-prev-top:active{cursor:grabbing}
      #${ROOT_ID} .pv-prev-top h1{margin:0;font-size:1rem;font-weight:700}
      #${ROOT_ID} .pv-prev-top .pv-prev-sub{display:block;font-size:.72rem;font-weight:600;opacity:.8;margin-top:2px}
      #${ROOT_ID} .pv-prev-top button{appearance:none;border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:8px 12px;font:600 13px inherit;cursor:pointer}
      #${ROOT_ID} .pv-prev-tabs{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:10px 12px;background:#e7f2f2;-webkit-overflow-scrolling:touch}
      #${ROOT_ID} .pv-prev-tabs button{flex:0 0 auto;appearance:none;border:1px solid #b7d0d0;background:#fff;color:#184047;border-radius:999px;padding:8px 12px;font:600 12px inherit;cursor:pointer;white-space:nowrap}
      #${ROOT_ID} .pv-prev-tabs button.active{background:#007d82;border-color:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-body{flex:1 1 auto;overflow:auto;padding:14px;width:100%;margin:0;box-sizing:border-box}
      #${ROOT_ID} .pv-prev-card{background:#fff;border:1px solid #d9e7e7;border-radius:16px;padding:14px;margin:0 0 12px}
      #${ROOT_ID} .pv-prev-card h2{margin:0 0 8px;font-size:1.05rem;color:#0f2c31}
      #${ROOT_ID} .pv-prev-card p,#${ROOT_ID} .pv-prev-muted{margin:0 0 10px;color:#3d5960;font-size:.9rem;line-height:1.45}
      #${ROOT_ID} .pv-prev-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
      #${ROOT_ID} label.pv-field{display:grid;gap:4px;font-size:.75rem;font-weight:700;color:#5b7076;letter-spacing:.04em;text-transform:uppercase}
      #${ROOT_ID} label.pv-field input,#${ROOT_ID} label.pv-field select,#${ROOT_ID} label.pv-field textarea{font:600 .95rem inherit;text-transform:none;letter-spacing:normal;color:#122f34;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;background:#f7fbfb}
      #${ROOT_ID} .pv-prev-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      #${ROOT_ID} .pv-prev-actions button{appearance:none;border:0;border-radius:12px;padding:11px 14px;font:600 13px inherit;cursor:pointer;min-height:42px}
      #${ROOT_ID} .pv-prev-actions .primary{background:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-actions .ghost{background:#eef5f5;color:#1d3338}
      #${ROOT_ID} .pv-badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
      #${ROOT_ID} .pv-badge.STIMA{background:#fff3cd;color:#7a5b00}
      #${ROOT_ID} .pv-badge.DA\\ VERIFICARE,#${ROOT_ID} .pv-badge.WARN{background:#fde8e8;color:#8a1f1f}
      #${ROOT_ID} .pv-badge.VERIFICATO{background:#e3f6ea;color:#0f5a30}
      #${ROOT_ID} .pv-badge.SCADUTO{background:#eee;color:#555}
      #${ROOT_ID} table{width:100%;border-collapse:collapse;font-size:.86rem}
      #${ROOT_ID} th,#${ROOT_ID} td{border-bottom:1px solid #eef3f3;padding:8px 6px;text-align:left;vertical-align:top}
      #${ROOT_ID} .pv-status{margin:8px 0 0;font-size:.82rem;color:#5b7076;min-height:1.2em}
      #${ROOT_ID} .pv-callout{padding:10px 12px;border-radius:12px;background:#eaf5f5;border:1px solid #d5e8e8;color:#0f2c31;font-size:.88rem;margin:0 0 12px}
      #${ROOT_ID} a{color:#007d82;font-weight:600}
      .pv-prev-launch{
        appearance:none;border:0;position:fixed;right:${FAB_DOCK_RIGHT}px;bottom:${PREV_FAB_BOTTOM};z-index:85;
        width:${FAB_SIZE}px;height:${FAB_SIZE}px;border-radius:50%;padding:0;display:none;
        background:radial-gradient(circle at 30% 28%,#3a6b72 0%,#124048 58%,#0a2c32 100%);
        color:#fff;box-shadow:0 14px 32px rgba(0,40,50,.38),inset 0 1px 0 rgba(255,255,255,.2);
        cursor:grab;align-items:center;justify-content:center;touch-action:none;user-select:none;
        animation:pv-fab-float 3.6s ease-in-out infinite;
        animation-delay:.4s;
      }
      .pv-prev-launch:active,.pv-prev-launch.pv-dragging{cursor:grabbing;animation:none;transform:scale(1.04)}
      .pv-prev-launch svg{width:30px;height:30px;display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18))}
      .pv-prev-launch .pv-prev-fab-label{
        position:absolute;right:68px;bottom:14px;white-space:nowrap;
        background:#0f2c31;color:#fff;font:700 11px/1 inherit;padding:6px 10px;border-radius:999px;
        box-shadow:0 6px 16px rgba(0,0,0,.18);opacity:0;transform:translateX(6px);pointer-events:none;transition:opacity .15s,transform .15s;
      }
      .pv-prev-launch:hover .pv-prev-fab-label,.pv-prev-launch:focus-visible .pv-prev-fab-label{opacity:1;transform:none}
      body.pv-account-ready .pv-prev-launch{display:inline-flex}
      @media (max-width:640px){
        .pv-prev-launch{
          right:16px;width:58px;height:58px;
          bottom:calc(max(52px, env(safe-area-inset-bottom, 0px) + 28px));
        }
        .pv-prev-launch .pv-prev-fab-label{display:none}
        #${ROOT_ID} .pv-prev-shell{
          left:0!important;right:0!important;bottom:0!important;top:auto!important;
          /* Leave room above for the two floating FABs (screenshot layout). */
          width:100%;height:min(72dvh,72vh);border-radius:18px 18px 0 0;
        }
      }
    `;
    style.dataset.pvReady = VERSION;
  }

  function preventivoIcon() {
    const gid = `pvPrev${Math.random().toString(36).slice(2, 7)}`;
    return `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}Paper" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#d7ecee"/>
        </linearGradient>
        <linearGradient id="${gid}Badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#4fd0d4"/>
          <stop offset="100%" stop-color="#007d82"/>
        </linearGradient>
      </defs>
      <!-- soft shadow -->
      <rect x="7.5" y="5.5" width="17" height="21" rx="3.5" fill="rgba(0,0,0,.12)"/>
      <!-- paper -->
      <rect x="6.5" y="4" width="17" height="21" rx="3.5" fill="url(#${gid}Paper)" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
      <!-- folded corner -->
      <path d="M18.5 4h5v5h-2.2c-1.55 0-2.8-1.25-2.8-2.8V4z" fill="#9fc9cd" opacity=".9"/>
      <path d="M18.5 4v2.2c0 1.55 1.25 2.8 2.8 2.8H24" fill="none" stroke="rgba(15,44,49,.18)" stroke-width=".8"/>
      <!-- lines -->
      <path d="M10.2 11.2h9.6M10.2 15h9.6M10.2 18.8h6.4" stroke="#124048" stroke-width="1.7" stroke-linecap="round" opacity=".88"/>
      <!-- euro badge -->
      <circle cx="22.2" cy="22.2" r="5.1" fill="url(#${gid}Badge)" stroke="#fff" stroke-width="1.4"/>
      <path d="M20.5 22.2h3.4M23.2 20.2c-.45-.7-1.2-1.1-2.05-1.1-1.45 0-2.45 1.1-2.45 3.1s1 3.1 2.45 3.1c.9 0 1.65-.4 2.1-1.15" stroke="#fff" stroke-width="1.35" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  function launchBtn() {
    if (!document.body) return;
    let btn = document.querySelector(".pv-prev-launch");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-prev-launch";
      btn.setAttribute("aria-label", "Preventivo intelligente");
      btn.title = "Preventivo intelligente";
      btn.innerHTML = `${preventivoIcon()}<span class="pv-prev-fab-label">Preventivo intelligente</span>`;
      document.body.appendChild(btn);
      const open = () => openPreventivo();
      if (typeof window.__pvMakeDraggable === "function") {
        window.__pvMakeDraggable(btn, { storageKey: FAB_POS_KEY, onTap: open });
      } else {
        btn.addEventListener("click", open);
      }
    }
  }

  function rootEl() {
    if (!document.body) return null;
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
    // Floating panel: lock scroll only on small screens.
    if (window.matchMedia && window.matchMedia("(max-width:640px)").matches) {
      document.documentElement.style.overflow = open ? "hidden" : "";
    } else {
      document.documentElement.style.overflow = "";
    }
    if (open) {
      render();
      const park = () => {
        if (typeof window.__pvParkFabsAboveSheet === "function") {
          window.__pvParkFabsAboveSheet();
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(park));
      setTimeout(park, 120);
      setTimeout(park, 400);
    } else {
      const magicOpen = document.getElementById("pv-magic-root")?.classList.contains("pv-open");
      if (!magicOpen && typeof window.__pvRestoreFabsFromPark === "function") {
        window.__pvRestoreFabsFromPark();
      }
    }
  }

  async function hydrateParamsFromOpenTrip() {
    try {
      const packed = await loadTripRecord();
      if (!packed?.data?.trip) return { ok: false, fromMeta: false };
      const trip = packed.data.trip;
      const fromMeta = applyPreventivoMeta(trip.meta?.preventivo);
      if (!fromMeta) {
        const next = mergeParams({
          title: trip.title,
          destination: trip.destination,
          start: trip.start,
          end: trip.end,
          travelers: Array.isArray(trip.members) && trip.members.length ? trip.members.length : state.params.travelers,
        });
        state.params = next;
      } else {
        // Keep trip title/dates as source of truth when present.
        state.params = mergeParams({
          ...state.params,
          title: trip.title || state.params.title,
          destination: trip.destination || state.params.destination,
          start: trip.start || state.params.start,
          end: trip.end || state.params.end,
          travelers:
            Array.isArray(trip.members) && trip.members.length
              ? trip.members.length
              : state.params.travelers,
        });
      }
      persistState();
      return { ok: true, fromMeta };
    } catch {
      return { ok: false, fromMeta: false };
    }
  }

  async function openPreventivo() {
    ensureStyles();
    const auth = tripAuth();
    if (auth) {
      const saved = loadStateForTrip(auth.id);
      const usable = saved && !paramsLookBroken(saved.params);
      initWorkingState(auth.id, usable ? saved : null);
      if (!usable) {
        const fromTrip = await hydrateParamsFromOpenTrip();
        if (fromTrip.fromMeta) {
          state.status = "Preventivo recuperato dal viaggio condiviso.";
        } else if (fromTrip.ok) {
          state.status = "Parametri presi dal viaggio aperto.";
        } else {
          state.status = "Preventivo vuoto pronto: indica destinazione, date e compagni.";
        }
      } else {
        state.status = "Preventivo caricato dal dispositivo.";
      }
    } else {
      const draft = loadStateForTrip(DRAFT_KEY);
      const usable = draft && !paramsLookBroken(draft.params);
      initWorkingState("", usable ? draft : null);
      state.status = usable
        ? "Bozza locale caricata. Puoi creare il viaggio in Pronti? VIA!."
        : "Nuovo preventivo: scegli destinazione, date e compagni, poi crea il viaggio. Puoi anche caricare l’esempio Islanda.";
    }
    setOpen(true);
    if (state.section === "itinerary") setTimeout(() => pushMapPoints(), 400);
  }

  function pushMapPoints() {
    const iframe = document.getElementById("pv-prev-map");
    if (!iframe?.contentWindow) return;
    const points = [];
    if (isIcelandTrip(state.params)) {
      points.push({
        id: "kef",
        title: "KEF Aeroporto",
        day: state.params.start,
        lat: 63.985,
        lng: -22.6056,
        color: "#124048",
      });
    }
    for (const [i, s] of currentItinerarySeed().entries()) {
      if (s.lat == null || s.lng == null) continue;
      points.push({
        id: `d${i}`,
        title: s.title,
        day: s.day,
        lat: s.lat,
        lng: s.lng,
      });
    }
    iframe.contentWindow.postMessage(
      { type: "viavia-map", points, destination: state.params.destination || "" },
      location.origin
    );
  }

  function sectionHtml() {
    switch (state.section) {
      case "overview":
        return overviewHtml();
      case "flights":
        return flightsHtml();
      case "stays":
        return staysHtml();
      case "transport":
        return transportHtml();
      case "itinerary":
        return itineraryHtml();
      case "activities":
        return activitiesHtml();
      case "budget":
        return budgetHtml();
      case "sources":
        return sourcesHtml();
      case "safety":
        return safetyHtml();
      case "export":
        return exportHtml();
      default:
        return "";
    }
  }

  function overviewHtml() {
    const p = state.params;
    return `
      <div class="pv-prev-card">
        <h2>Panoramica</h2>
        <p class="pv-callout">Modulo integrato in Pronti? VIA!. I prezzi partono come <span class="pv-badge STIMA">STIMA</span> o <span class="pv-badge WARN">DA VERIFICARE</span> — nessun importo è dichiarato VERIFICATO senza tua conferma da fonte ufficiale.</p>
        <div class="pv-prev-grid">
          ${field("title", "Nome viaggio", p.title)}
          ${field("destination", "Destinazione", p.destination)}
          ${field("departureCity", "Partenza", p.departureCity)}
          ${field("airportIn", "Aeroporto arrivo", p.airportIn)}
          ${field("start", "Andata", p.start, "date")}
          ${field("end", "Ritorno", p.end, "date")}
          ${field("travelers", "Adulti", p.travelers, "number")}
          ${field("currency", "Valuta", p.currency)}
        </div>
        <div class="pv-prev-grid" style="margin-top:10px">
          <label class="pv-field">Aeroporti partenza
            <input data-param="airportsOut" value="${escapeAttr((p.airportsOut || []).join(", "))}" />
          </label>
          <label class="pv-field">Max scali
            <input data-param="maxStops" type="number" min="0" max="2" value="${p.prefs.maxStops}" />
          </label>
        </div>
        <div class="pv-prev-actions">
          ${
            state.tripId
              ? `<button type="button" class="primary" data-act="sync-preventivo">Salva preventivo nel viaggio</button>
          <button type="button" class="ghost" data-act="save-local">Salva (anche nel viaggio)</button>`
              : `<button type="button" class="primary" data-act="create-trip">Crea viaggio in Pronti? VIA!</button>
          <button type="button" class="ghost" data-act="save-local">Salva parametri</button>`
          }
          <button type="button" class="ghost" data-act="reset-blank">Nuovo preventivo vuoto</button>
          <button type="button" class="ghost" data-act="load-iceland-example">Esempio Islanda</button>
          <button type="button" class="ghost" data-act="clear-draft">Pulisci bozza salvata</button>
        </div>
        <p class="pv-prev-muted">Per qualsiasi destinazione: compilare destinazione/date/adulti, poi creare o sincronizzare il viaggio.${
          state.tripId
            ? " Le stime nel viaggio viaggiano con il link di condivisione (meta.preventivo)."
            : ""
        }</p>
      </div>`;
  }

  function field(key, label, value, type = "text") {
    return `<label class="pv-field">${label}<input data-param="${key}" type="${type}" value="${escapeAttr(value)}" /></label>`;
  }

  function flightsHtml() {
    const ff = state.flightFilters || {};
    const maxPrice = ff.maxPricePp === "" || ff.maxPricePp == null ? null : Number(ff.maxPricePp);
    const maxStops = ff.maxStops === "" || ff.maxStops == null ? null : Number(ff.maxStops);
    const airport = ff.airport || "all";
    const bags = ff.bags || "any";
    const busy = state.searchBusy === "flights";
    const liveFiltered = (state.liveFlights || []).filter((f) => {
      if (airport !== "all" && f.from !== airport) return false;
      if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice > 0 && (f.perPersonCents || 0) / 100 > maxPrice)
        return false;
      if (maxStops != null && Number.isFinite(maxStops) && Number(f.stops) > maxStops) return false;
      if (bags === "included" && !/cabin|bag|inclus|piece/i.test(String(f.bags || ""))) return false;
      return true;
    });
    const liveRows = liveFiltered
      .map(
        (f) => `<tr>
        <td><strong>${escapeHtml(f.airline || "—")}</strong><br/><span class="pv-prev-muted">${escapeHtml(f.from)}→${escapeHtml(f.to)} · ${escapeHtml(f.departTime || "")}</span></td>
        <td>${f.isDirect || Number(f.stops) === 0 ? "Diretto" : `${escapeHtml(String(f.stops))} scalo/i`}</td>
        <td>${escapeHtml(f.bags || "—")}</td>
        <td><strong>${fmtMoney(f.perPersonCents)}</strong></td>
        <td>${fmtMoney(f.totalGroupCents)}</td>
        <td><span class="pv-badge STIMA">LIVE</span></td>
        <td>
          <button type="button" class="primary" data-apply-flight="${escapeAttr(f.id)}" style="padding:6px 10px;font-size:12px">Usa</button>
          ${f.url ? `<a href="${escapeAttr(f.url)}" target="_blank" rel="noopener">Apri</a>` : ""}
        </td>
      </tr>`
      )
      .join("");
    const filtered = state.flightNotes.filter((f) => {
      if (airport !== "all" && f.from !== airport) return false;
      if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice > 0 && (f.perPersonCents || 0) > 0 && f.perPersonCents / 100 > maxPrice)
        return false;
      if (maxStops != null && Number.isFinite(maxStops)) {
        const declared = String(f.stops || "");
        if (declared.includes("-")) {
          const hi = Number(declared.split("-").pop());
          if (Number.isFinite(hi) && hi > maxStops) return false;
        } else {
          const stopsNum = Number(String(f.stops).replace(/[^0-9]/g, "") || 99);
          if (Number.isFinite(stopsNum) && stopsNum > maxStops) return false;
        }
      }
      if (bags === "included" && !/inclus|incl|si|sì|yes|cabin|bag/i.test(String(f.bags || ""))) return false;
      return true;
    });
    const rows = filtered
      .map(
        (f) => `<tr>
        <td>${escapeHtml(f.from)}→${escapeHtml(f.to)}${f.airline ? `<br/><span class="pv-prev-muted">${escapeHtml(f.airline)}</span>` : ""}</td>
        <td>${escapeHtml(f.stops)}</td>
        <td>${escapeHtml(f.bags || "—")}</td>
        <td><input data-flight="${f.id}" data-k="perPersonCents" type="number" step="1" min="0" value="${Math.round((f.perPersonCents || 0) / 100)}" style="width:90px" /> €/pax</td>
        <td><input data-flight="${f.id}" data-k="totalGroupCents" type="number" step="1" min="0" value="${Math.round((f.totalGroupCents || 0) / 100)}" style="width:100px" /> € gruppo</td>
        <td><span class="pv-badge ${f.groupFareConfirmed ? "VERIFICATO" : f.live ? "STIMA" : "WARN"}">${f.groupFareConfirmed ? "gruppo ok" : f.live ? "live" : "gruppo non confermato"}</span></td>
        <td>${f.url ? `<a href="${escapeAttr(f.url)}" target="_blank" rel="noopener">Apri</a>` : "—"}</td>
      </tr>`
      )
      .join("");
    const airportOpts = ["all", ...(state.params.airportsOut || [])]
      .map((a) => `<option value="${escapeAttr(a)}" ${airport === a ? "selected" : ""}>${a === "all" ? "Tutti" : a}</option>`)
      .join("");
    const meta = state.searchMeta?.flights;
    return `
      <div class="pv-prev-card">
        <h2>Voli per ${state.params.travelers} adulti</h2>
        <p>Ricerca A/R reale ${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)} da ${(state.params.airportsOut || []).join(", ") || "—"} verso ${escapeHtml(state.params.airportIn || state.params.destination || "—")}.</p>
        <p class="pv-callout">La ricerca live interroga aggregatori in tempo reale. I prezzi scadono in pochi minuti: conferma sempre sul link di prenotazione, soprattutto per gruppi.</p>
        <div class="pv-prev-grid">
          <label class="pv-field">Max €/pax (filtro)
            <input data-ff="maxPricePp" type="number" min="0" step="1" value="${escapeAttr(ff.maxPricePp ?? "")}" placeholder="es. 350" />
          </label>
          <label class="pv-field">Max scali
            <select data-ff="maxStops">
              <option value="0" ${String(ff.maxStops) === "0" ? "selected" : ""}>Diretto</option>
              <option value="1" ${String(ff.maxStops) !== "0" && String(ff.maxStops) !== "2" ? "selected" : ""}>Max 1</option>
              <option value="2" ${String(ff.maxStops) === "2" ? "selected" : ""}>Max 2</option>
            </select>
          </label>
          <label class="pv-field">Aeroporto partenza
            <select data-ff="airport">${airportOpts}</select>
          </label>
          <label class="pv-field">Bagagli
            <select data-ff="bags">
              <option value="any" ${bags === "any" ? "selected" : ""}>Qualsiasi</option>
              <option value="included" ${bags === "included" ? "selected" : ""}>Con bagaglio (testo)</option>
            </select>
          </label>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="search-flights" ${busy ? "disabled" : ""}>${busy ? "Ricerca in corso…" : "Cerca voli live"}</button>
          <a class="ghost" style="display:inline-flex;align-items:center;padding:8px 12px;border-radius:10px;border:1px solid #b7d0d0;text-decoration:none;color:#184047;font:600 12px inherit" href="${escapeAttr(currentOfficial().googleFlights)}" target="_blank" rel="noopener">Google Flights</a>
          <a class="ghost" style="display:inline-flex;align-items:center;padding:8px 12px;border-radius:10px;border:1px solid #b7d0d0;text-decoration:none;color:#184047;font:600 12px inherit" href="${escapeAttr(currentOfficial().kayak)}" target="_blank" rel="noopener">Kayak</a>
        </div>
        ${meta?.fetchedAt ? `<p class="pv-prev-muted">Ultima ricerca live: ${escapeHtml(meta.fetchedAt)} · ${meta.count || 0} risultati</p>` : ""}
        <h2 style="margin-top:16px;font-size:1rem">Risultati live</h2>
        <div style="overflow:auto;margin-top:8px">
          <table>
            <thead><tr><th>Volo</th><th>Scali</th><th>Bagagli</th><th>€/pax</th><th>Totale offerta</th><th>Stato</th><th></th></tr></thead>
            <tbody>${liveRows || `<tr><td colspan="7">${busy ? "Ricerca in corso…" : "Premi «Cerca voli live» per prezzi reali."}</td></tr>`}</tbody>
          </table>
        </div>
        <h2 style="margin-top:16px;font-size:1rem">Selezione / note nel preventivo</h2>
        <div style="overflow:auto;margin-top:8px">
          <table>
            <thead><tr><th>Rotta</th><th>Scali</th><th>Bagagli</th><th>Rif. /pax</th><th>Totale gruppo</th><th>Stato</th><th>Link</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7">Nessuna offerta ancora applicata.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="save-local">Salva voli</button>
        </div>
        <p class="pv-prev-muted">«Usa» copia il prezzo live nel budget come STIMA. Per gruppi grandi verifica disponibilità sul sito di prenotazione.</p>
      </div>`;
  }

  function staysHtml() {
    const busy = state.searchBusy === "stays";
    const nights = state.params.nights || 7;
    const liveCards = (state.liveStays || [])
      .map(
        (s) => `<div class="pv-prev-card" style="display:grid;gap:8px;grid-template-columns:96px 1fr">
        <div style="width:96px;height:72px;border-radius:10px;overflow:hidden;background:#e7f2f2">
          ${s.image ? `<img src="${escapeAttr(s.image)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy" />` : ""}
        </div>
        <div>
          <h2 style="font-size:1rem;margin:0 0 4px">${escapeHtml(s.title)} <span class="pv-badge STIMA">LIVE</span></h2>
          <p class="pv-prev-muted" style="margin:0 0 6px">${escapeHtml(s.address || "")}${s.starRating != null ? ` · ${s.starRating}★` : ""}${s.distanceKm != null ? ` · ${Number(s.distanceKm).toFixed(1)} km` : ""}</p>
          <p style="margin:0 0 8px"><strong>${fmtMoney(s.totalCents)}</strong> / ${nights} notti · ${fmtMoney(s.nightlyCents)}/notte · ${fmtMoney(state.params.travelers ? Math.round(s.totalCents / state.params.travelers) : 0)}/pax</p>
          <div class="pv-prev-actions" style="margin:0">
            <button type="button" class="primary" data-apply-stay="${escapeAttr(s.id)}">Usa nel preventivo</button>
            ${s.url || s.bookingUrl ? `<a href="${escapeAttr(s.bookingUrl || s.url)}" target="_blank" rel="noopener">Apri scheda</a>` : ""}
          </div>
        </div>
      </div>`
      )
      .join("");
    const cards = state.stayConfigs
      .map(
        (s) => `<div class="pv-prev-card">
        <h2>${escapeHtml(s.title)} <span class="pv-badge ${escapeAttr(s.status)}">${escapeHtml(s.status)}</span></h2>
        <div class="pv-prev-grid">
          <label class="pv-field">Totale ${nights} notti (€)<input data-stay="${s.id}" data-k="totalEuros" type="number" min="0" step="1" value="${Math.round((s.totalCents || 0) / 100)}" /></label>
          <label class="pv-field">Camere<input data-stay="${s.id}" data-k="rooms" type="number" min="0" value="${s.rooms || 0}" /></label>
          <label class="pv-field">Bagni<input data-stay="${s.id}" data-k="baths" type="number" min="0" value="${s.baths || 0}" /></label>
          <label class="pv-field">Cucina
            <select data-stay="${s.id}" data-k="kitchen"><option value="1" ${s.kitchen ? "selected" : ""}>Sì</option><option value="0" ${!s.kitchen ? "selected" : ""}>No</option></select>
          </label>
        </div>
        <p class="pv-prev-muted">${escapeHtml(s.notes || "")}</p>
        <p>${s.url ? `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">Apri scheda / ricerca</a>` : "Aggiungi URL fonte"} · Per persona: <strong>${fmtMoney(state.params.travelers ? Math.round((s.totalCents || 0) / state.params.travelers) : 0)}</strong></p>
      </div>`
      )
      .join("");
    const meta = state.searchMeta?.stays;
    const region = meta?.query?.regionName || state.params.destination || "destinazione";
    return `
      <div class="pv-prev-card">
        <h2>Alloggi live — hotel e case</h2>
        <p>Ricerca reale su ${escapeHtml(region)} per ${state.params.travelers} adulti, ${nights} notti (${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)}). ${state.params.prefs?.noHostels !== false ? "Ostelli esclusi." : ""}</p>
        <p class="pv-callout">Oltre ai risultati live puoi aprire
          <a href="${escapeAttr(currentOfficial().booking)}" target="_blank" rel="noopener">Booking</a> e
          <a href="${escapeAttr(currentOfficial().airbnb)}" target="_blank" rel="noopener">Airbnb</a>
          con le stesse date/ospiti.</p>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="search-stays" ${busy ? "disabled" : ""}>${busy ? "Ricerca in corso…" : "Cerca hotel e case live"}</button>
          <button type="button" class="ghost" data-act="save-local">Salva alloggi</button>
        </div>
        ${meta?.fetchedAt ? `<p class="pv-prev-muted">Ultima ricerca: ${escapeHtml(meta.fetchedAt)} · ${meta.count || 0} risultati</p>` : ""}
      </div>
      ${liveCards || `<div class="pv-prev-card"><p class="pv-prev-muted">${busy ? "Ricerca in corso…" : "Premi «Cerca hotel e case live» per prezzi e disponibilità reali."}</p></div>`}
      <div class="pv-prev-card"><h2>Selezione nel preventivo</h2><p class="pv-prev-muted">Le opzioni sotto restano modificabili a mano dopo aver applicato un risultato live.</p></div>
      ${cards}`;
  }

  function transportHtml() {
    const strat = state.transport.strategy || "A";
    const links = currentOfficial();
    const iceland = isIcelandTrip(state.params);
    return `
      <div class="pv-prev-card">
        <h2>Trasporti — 3 strategie</h2>
        <label class="pv-field">Strategia attiva
          <select data-transport="strategy">
            <option value="A" ${strat === "A" ? "selected" : ""}>A — Nessuna auto (mezzi + tour)</option>
            <option value="B" ${strat === "B" ? "selected" : ""}>B — Due auto / veicoli</option>
            <option value="C" ${strat === "C" ? "selected" : ""}>C — Un veicolo capiente (verificare bagagli)</option>
          </select>
        </label>
        <div class="pv-callout">
          <strong>A:</strong> Transfer + mezzi pubblici + tour con transfer. Evita doppi conteggi.<br/>
          <strong>B:</strong> 2 veicoli: noleggio, assicurazione, carburante, parcheggi, depositi.<br/>
          <strong>C:</strong> Un veicolo grande non implica bagagli comodi per tutti — verifica capacità reale.
        </div>
        <label class="pv-field">Note / preventivi inseriti
          <textarea data-transport="notes" rows="5">${escapeHtml(state.transport.notes || "")}</textarea>
        </label>
        <p><a href="${escapeAttr(links.googleMaps)}" target="_blank" rel="noopener">Mappe / spostamenti</a>
        ${
          iceland
            ? ` · <a href="${escapeAttr(links.citybus)}" target="_blank" rel="noopener">Strætó</a> ·
        <a href="${escapeAttr(links.re)}" target="_blank" rel="noopener">Flybus</a> ·
        <a href="${escapeAttr(links.roads)}" target="_blank" rel="noopener">Strade</a>`
            : ""
        }</p>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva trasporti</button></div>
      </div>`;
  }

  function itineraryHtml() {
    const seeds = currentItinerarySeed();
    const days = seeds
      .map(
        (d) =>
          `<tr><td>${escapeHtml(d.day)}</td><td><strong>${escapeHtml(d.title)}</strong><br/><span class="pv-prev-muted">${escapeHtml(d.notes)}</span></td><td>${escapeHtml(d.address)}</td></tr>`
      )
      .join("");
    const mapSrc = (() => {
      try {
        return new URL("map.html", location.href).pathname;
      } catch {
        return "/map.html";
      }
    })();
    const dest = state.params.destination || "destinazione";
    return `
      <div class="pv-prev-card">
        <h2>Itinerario — ${escapeHtml(dest)}</h2>
        <p>${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)} · ${state.params.days} giorni. Lascia buffer per imprevisti.</p>
        <div style="overflow:auto"><table><thead><tr><th>Data</th><th>Programma</th><th>Luogo</th></tr></thead><tbody>${days}</tbody></table></div>
        <div class="pv-prev-card" style="padding:0;overflow:hidden;margin-top:12px">
          <iframe id="pv-prev-map" title="Mappa itinerario" src="${escapeAttr(mapSrc)}" style="width:100%;height:280px;border:0;display:block"></iframe>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="sync-itinerary">Scrivi tappe nel viaggio</button>
          <button type="button" class="ghost" data-act="push-map">Aggiorna mappa</button>
          <button type="button" class="ghost" data-act="save-local">Salva</button>
        </div>
      </div>`;
  }

  function activitiesHtml() {
    const cards = currentActivities()
      .map(
        (a) => `<div class="pv-prev-card">
        <h2>${escapeHtml(a.title)}</h2>
        <p>${escapeHtml(a.note)}</p>
        <p class="pv-prev-muted">Organizzatore: ${escapeHtml(a.org)} · Trasporto: ${escapeHtml(a.transport)}</p>
        <p><span class="pv-badge WARN">DA VERIFICARE</span> prezzo persona / gruppo ${state.params.travelers} — solo da fonti ufficiali.</p>
        <p><a href="${escapeAttr(a.url)}" target="_blank" rel="noopener">Apri ricerca / fonte</a></p>
      </div>`
      )
      .join("");
    const tip = isIcelandTrip(state.params)
      ? "L’aurora non è garantita. Distingui tour organizzati e osservazione autonoma."
      : "Parti da 2–3 idee concrete e verifica orari/prezzi sulle fonti ufficiali.";
    return `<div class="pv-prev-card"><h2>Attività</h2><p>${tip}</p></div>${cards}`;
  }

  function budgetHtml() {
    ensureBudgetLines();
    const tot = budgetTotals();
    const rows = state.lines
      .map(
        (l) => `<tr>
        <td>${escapeHtml(l.title)}<br/><span class="pv-badge ${escapeAttr(l.status)}">${escapeHtml(l.status)}</span></td>
        <td><input data-line="${l.id}" data-k="unitEuros" type="number" min="0" step="1" value="${(l.unitCents / 100).toFixed(0)}" style="width:90px"/></td>
        <td><input data-line="${l.id}" data-k="qty" type="number" min="0" step="1" value="${l.qty}" style="width:70px"/></td>
        <td>${fmtMoney(lineTotal(l))}</td>
        <td>
          <select data-line="${l.id}" data-k="status">
            ${["STIMA", "DA VERIFICARE", "VERIFICATO", "SCADUTO"]
              .map((s) => `<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
      </tr>`
      )
      .join("");
    return `
      <div class="pv-prev-card">
        <h2>Budget — scenario
          <select data-scenario="1">
            <option value="economico" ${state.scenario === "economico" ? "selected" : ""}>Economico</option>
            <option value="intermedio" ${state.scenario === "intermedio" ? "selected" : ""}>Intermedio</option>
            <option value="comfort" ${state.scenario === "comfort" ? "selected" : ""}>Comfort</option>
          </select>
        </h2>
        <p class="pv-callout">I totali sotto includono voci <strong>STIMA</strong>. Non sono un preventivo esaustivo di mercato. Scenario iniziale: Economico (no ostelli).</p>
        <p><strong>Gruppo:</strong> ${fmtMoney(tot.group)} · <strong>/persona:</strong> ${fmtMoney(tot.pp)} · <strong>/giorno pp:</strong> ${fmtMoney(tot.perDay)}</p>
        <p class="pv-prev-muted">VERIFICATO ${fmtMoney(tot.byStatus.VERIFICATO)} · STIMA ${fmtMoney(tot.byStatus.STIMA)} · DA VERIFICARE ${fmtMoney(tot.byStatus["DA VERIFICARE"])}</p>
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Voce</th><th>€ unit</th><th>Qty</th><th>Totale</th><th>Stato</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="save-local">Salva budget</button>
          <button type="button" class="ghost" data-act="reset-budget">Ricarica template scenario</button>
          <button type="button" class="ghost" data-act="sync-expenses">Copia stime in Spese di gruppo</button>
          ${
            state.tripId
              ? `<button type="button" class="ghost" data-act="sync-preventivo">Scrivi preventivo nel viaggio</button>`
              : ""
          }
        </div>
      </div>`;
  }

  function sourcesHtml() {
    const rows = state.sources
      .map((s) => `<tr><td>${escapeHtml(s.kind)}</td><td>${escapeHtml(s.title)}</td><td><a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a></td></tr>`)
      .join("");
    return `
      <div class="pv-prev-card">
        <h2>Fonti</h2>
        <p>Registra URL e stato. Non inventare fonti. Aggiorna dopo ogni verifica.</p>
        <div style="overflow:auto"><table><thead><tr><th>Tipo</th><th>Nome</th><th>URL</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva fonti</button></div>
      </div>`;
  }

  function safetyHtml() {
    const w = state.safety?.weather;
    const links = currentOfficial();
    const iceland = isIcelandTrip(state.params);
    return `
      <div class="pv-prev-card">
        <h2>Sicurezza e condizioni</h2>
        <p class="pv-callout">${
          iceland
            ? "Inverno islandese: ghiaccio, vento, strade chiuse, poche ore di luce. Non forzare spostamenti rischiosi."
            : "Controlla meteo, trasporti locali e avvisi ufficiali prima di ogni giornata impegnativa."
        }</p>
        <ul>
          ${
            iceland
              ? `<li><a href="${escapeAttr(links.safetravel)}" target="_blank" rel="noopener">SafeTravel.is</a></li>
          <li><a href="${escapeAttr(links.vedur)}" target="_blank" rel="noopener">Vedur.is (meteo)</a></li>
          <li><a href="${escapeAttr(links.roads)}" target="_blank" rel="noopener">Umferdin.is (strade)</a></li>`
              : `<li><a href="${escapeAttr(links.googleMaps)}" target="_blank" rel="noopener">Mappe / percorsi</a></li>
          <li>Consulta siti ufficiali di turismo e trasporti della destinazione</li>`
          }
        </ul>
        <p>${w ? escapeHtml(w.note) + " " + escapeHtml(w.sample || "") : "Puoi caricare indici climatici di riferimento (non sono una previsione del tuo viaggio)."}</p>
        <p class="pv-prev-muted">Ultimo aggiornamento modulo: ${escapeHtml(state.safety?.fetchedAt || "—")}</p>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="fetch-safety">Aggiorna clima (Open-Meteo)</button>
          <button type="button" class="ghost" data-act="save-local">Salva</button>
        </div>
      </div>`;
  }

  function exportHtml() {
    const tot = budgetTotals();
    return `
      <div class="pv-prev-card">
        <h2>Esportazione</h2>
        <p>PDF via stampa browser. CSV spese del modulo. Il viaggio resta salvato e condividibile con i link Pronti? VIA!.</p>
        <p><strong>${escapeHtml(state.params.title)}</strong><br/>
        ${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)} · ${state.params.travelers} adulti<br/>
        Totale scenario ${escapeHtml(state.scenario)}: ${fmtMoney(tot.group)} (${fmtMoney(tot.pp)}/persona)</p>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="export-print">Stampa / Salva PDF</button>
          <button type="button" class="ghost" data-act="export-csv">Scarica CSV budget</button>
          <button type="button" class="ghost" data-act="export-summary">Copia riepilogo</button>
          ${
            state.tripId
              ? `<button type="button" class="ghost" data-act="sync-preventivo">Scrivi preventivo nel viaggio</button>`
              : ""
          }
        </div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function render() {
    ensureStyles();
    const root = rootEl();
    if (!root) return;
    const tabs = SECTIONS.map(
      ([id, label]) =>
        `<button type="button" data-section="${id}" class="${state.section === id ? "active" : ""}">${label}</button>`
    ).join("");
    root.innerHTML = `
      <div class="pv-prev-scrim" data-act="close" aria-hidden="true"></div>
      <div class="pv-prev-shell" id="pv-prev-shell">
        <div class="pv-prev-top" id="pv-prev-drag">
          <div>
            <h1>Preventivo intelligente</h1>
            <span class="pv-prev-sub">Floating · trascina per spostare</span>
          </div>
          <button type="button" data-act="close">Chiudi</button>
        </div>
        <div class="pv-prev-tabs">${tabs}</div>
        <div class="pv-prev-body">${sectionHtml()}<p class="pv-status">${escapeHtml(state.status)}</p></div>
      </div>
    `;
    bind(root);
    const shell = root.querySelector("#pv-prev-shell");
    const handle = root.querySelector("#pv-prev-drag");
    if (
      shell &&
      handle &&
      typeof window.__pvMakeDraggable === "function" &&
      !(window.matchMedia && window.matchMedia("(max-width:640px)").matches)
    ) {
      window.__pvMakeDraggable(shell, { storageKey: PANEL_POS_KEY, handle });
    }
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
    root.querySelectorAll("[data-apply-flight]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-apply-flight");
        const offer = (state.liveFlights || []).find((f) => f.id === id);
        applyLiveFlight(offer);
      });
    });
    root.querySelectorAll("[data-apply-stay]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-apply-stay");
        const stay = (state.liveStays || []).find((s) => s.id === id);
        applyLiveStay(stay);
      });
    });
    root.querySelectorAll("[data-param]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-param");
        let val = el.value;
        if (key === "travelers" || key === "maxStops") val = Number(val) || 0;
        if (key === "airportsOut") {
          state.params.airportsOut = String(val)
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        } else if (key === "maxStops") {
          state.params.prefs.maxStops = Number(val) || 0;
        } else {
          state.params[key] = val;
        }
        if (key === "start" || key === "end") {
          state.params = refreshDerivedParams(state.params);
        }
        if (["destination", "airportIn", "start", "end", "travelers", "airportsOut"].includes(key)) {
          state.flightNotes = defaultFlightRows(state.params);
          state.sources = defaultSources(state.params);
          if (key === "destination" || key === "start" || key === "end" || key === "travelers") {
            state.stayConfigs = defaultStayConfigs(state.params);
          }
        }
        persistState();
        if (key === "start" || key === "end" || key === "destination" || key === "travelers") {
          render();
        }
      });
    });
    root.querySelectorAll("[data-flight]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-flight");
        const k = el.getAttribute("data-k");
        const row = state.flightNotes.find((f) => f.id === id);
        if (!row) return;
        if (k === "perPersonCents" || k === "totalGroupCents") row[k] = eurosToCents(el.value);
        persistState();
      });
    });
    root.querySelectorAll("[data-stay]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-stay");
        const k = el.getAttribute("data-k");
        const row = state.stayConfigs.find((s) => s.id === id);
        if (!row) return;
        if (k === "totalEuros") row.totalCents = eurosToCents(el.value);
        else if (k === "kitchen") row.kitchen = el.value === "1";
        else row[k] = Number(el.value) || 0;
        persistState();
        if (k === "totalEuros") render();
      });
    });
    root.querySelectorAll("[data-line]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-line");
        const k = el.getAttribute("data-k");
        const row = state.lines.find((l) => l.id === id);
        if (!row) return;
        if (k === "unitEuros") row.unitCents = eurosToCents(el.value);
        else if (k === "qty") row.qty = Number(el.value) || 0;
        else if (k === "status") row.status = el.value;
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
    root.querySelectorAll("[data-ff]").forEach((el) => {
      el.addEventListener("change", () => {
        state.flightFilters = state.flightFilters || {};
        state.flightFilters[el.getAttribute("data-ff")] = el.value;
        persistState();
        render();
      });
    });
    const mapFrame = root.querySelector("#pv-prev-map");
    if (mapFrame) {
      mapFrame.addEventListener("load", () => setTimeout(pushMapPoints, 200));
      setTimeout(pushMapPoints, 600);
    }
    const scen = root.querySelector("[data-scenario]");
    if (scen) {
      scen.addEventListener("change", () => {
        state.scenario = scen.value;
        state.lines = defaultBudgetLines(state.params, state.scenario);
        persistState();
        render();
      });
    }
  }

  async function onAction(act) {
    try {
      if (act === "close") {
        setOpen(false);
        return;
      }
      if (act === "save-local") {
        state.params = mergeParams(state.params);
        persistState();
        // If a trip is open, "Salva" must also write into the shared trip payload.
        if (state.tripId && tripAuth()) {
          state.status = "Salvataggio nel viaggio…";
          render();
          await syncPreventivoIntoTrip();
          render();
          return;
        }
        state.status = "Salvato su questo dispositivo.";
        render();
        return;
      }
      if (act === "reset-blank") {
        initWorkingState(state.tripId || "", null);
        persistState();
        state.status = "Preventivo vuoto pronto per qualsiasi destinazione.";
        render();
        return;
      }
      if (act === "load-iceland-example") {
        state.params = mergeParams(ICELAND_PRESET);
        state.lines = defaultBudgetLines(state.params, state.scenario);
        state.flightNotes = defaultFlightRows(state.params);
        state.stayConfigs = defaultStayConfigs(state.params);
        state.sources = defaultSources(state.params);
        state.transport = { strategy: "A", notes: "" };
        state.liveFlights = [];
        state.liveStays = [];
        state.searchMeta = { flights: null, stays: null };
        persistState();
        state.status = "Caricato esempio Islanda (opzionale). Puoi modificarlo o tornare al vuoto.";
        render();
        return;
      }
      if (act === "clear-draft") {
        try {
          const db = readStore();
          if (state.tripId) delete db[state.tripId];
          delete db[DRAFT_KEY];
          writeStore(db);
          localStorage.removeItem(STORE_KEY_LEGACY);
        } catch {
          /* ignore */
        }
        initWorkingState(state.tripId || "", null);
        state.status = "Bozza cancellata. Preventivo vuoto ricaricato.";
        render();
        return;
      }
      if (act === "create-trip") {
        state.params = refreshDerivedParams(mergeParams(state.params));
        persistState();
        state.status = "Creazione viaggio…";
        render();
        await createTripFromPreventivo();
        state.status = "Viaggio creato. Continua dal preventivo.";
        render();
        return;
      }
      if (act === "sync-itinerary") {
        await syncItineraryToTrip();
        render();
        return;
      }
      if (act === "sync-preventivo") {
        await syncPreventivoIntoTrip();
        render();
        return;
      }
      if (act === "sync-expenses") {
        await syncBudgetEstimatesToExpenses();
        render();
        return;
      }
      if (act === "reset-budget") {
        state.lines = defaultBudgetLines(state.params, state.scenario);
        persistState();
        state.status = "Template budget ricaricato.";
        render();
        return;
      }
      if (act === "search-flights") {
        await searchFlightsLive();
        return;
      }
      if (act === "search-stays") {
        await searchStaysLive();
        return;
      }
      if (act === "fetch-safety") {
        state.status = "Scarico clima…";
        render();
        await fetchWinterSafety();
        return;
      }
      if (act === "push-map") {
        pushMapPoints();
        state.status = "Mappa aggiornata con tappe itinerario.";
        render();
        return;
      }
      if (act === "export-print") {
        exportPrint();
        return;
      }
      if (act === "export-csv") {
        exportCsv();
        return;
      }
      if (act === "export-summary") {
        await exportSummary();
        return;
      }
    } catch (err) {
      state.searchBusy = "";
      state.status = err?.message || "Operazione non riuscita";
      render();
    }
  }

  function exportPrint() {
    const tot = budgetTotals();
    const w = window.open("", "_blank");
    if (!w) {
      state.status = "Popup bloccato: consenti finestre per il PDF.";
      render();
      return;
    }
    const lines = state.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.title)}</td><td>${escapeHtml(l.status)}</td><td>${fmtMoney(lineTotal(l))}</td><td>${escapeHtml(l.source || "")}</td></tr>`
      )
      .join("");
    const days = currentItinerarySeed()
      .map((d) => `<li><strong>${escapeHtml(d.day)}</strong> — ${escapeHtml(d.title)}: ${escapeHtml(d.notes)}</li>`)
      .join("");
    w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Preventivo — ${escapeHtml(state.params.title)}</title>
      <style>body{font:14px/1.45 system-ui,sans-serif;padding:24px;color:#122} h1{color:#007d82} table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left} .warn{background:#fff3cd;padding:8px;border-radius:8px}</style></head><body>
      <h1>Pronti? VIA! — Preventivo intelligente</h1>
      <p><strong>${escapeHtml(state.params.title)}</strong><br/>
      ${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)} · ${state.params.travelers} adulti · scenario ${escapeHtml(state.scenario)}</p>
      <p class="warn">Molti importi sono STIMA o DA VERIFICARE. Non trattarli come prezzi confermati. Verifica su fonti ufficiali prima di prenotare. Condizioni invernali: safetravel.is / vedur.is / umferdin.is.</p>
      <h2>Budget</h2>
      <p>Totale gruppo ${fmtMoney(tot.group)} · per persona ${fmtMoney(tot.pp)} · aggiornato ${escapeHtml(nowIso())}</p>
      <table><thead><tr><th>Voce</th><th>Stato</th><th>Importo</th><th>Fonte</th></tr></thead><tbody>${lines}</tbody></table>
      <h2>Itinerario</h2><ol>${days}</ol>
      <h2>Fonti</h2><ul>${state.sources.map((s) => `<li><a href="${escapeAttr(s.url)}">${escapeHtml(s.title)}</a></li>`).join("")}</ul>
      <script>onload=()=>print()</script></body></html>`);
    w.document.close();
  }

  function exportCsv() {
    ensureBudgetLines();
    const rows = [["title", "status", "unit_eur", "qty", "total_eur", "source"]];
    for (const l of state.lines) {
      rows.push([
        l.title,
        l.status,
        (l.unitCents / 100).toFixed(2),
        String(l.qty),
        (lineTotal(l) / 100).toFixed(2),
        l.source || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const slug = String(state.params.destination || state.params.title || "viaggio")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "viaggio";
    a.download = `pronti-via-preventivo-${slug}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exportSummary() {
    const tot = budgetTotals();
    const sourceTitles = (state.sources || []).map((s) => s.title).filter(Boolean).slice(0, 8);
    const text = [
      state.params.title || state.params.destination || "Preventivo",
      `Destinazione: ${state.params.destination || "—"}`,
      `${state.params.start} → ${state.params.end} · ${state.params.travelers} adulti`,
      `Scenario ${state.scenario}: ${fmtMoney(tot.group)} gruppo / ${fmtMoney(tot.pp)} a persona`,
      "Stati: molti valori STIMA/DA VERIFICARE",
      sourceTitles.length ? `Fonti: ${sourceTitles.join(", ")}` : "Fonti: vedi scheda Fonti nel modulo",
      `Generato ${nowIso()} · Pronti? VIA! Preventivo intelligente ${VERSION}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      state.status = "Riepilogo copiato.";
    } catch {
      state.status = "Copia non riuscita.";
    }
    render();
  }

  function tick() {
    if (!document.body) return;
    ensureStyles();
    launchBtn();
  }

  // Boot after body exists (script may load in <head>)
  function boot() {
    try {
      ensureStyles();
      // Close any leftover overlay from a previous soft navigation.
      const stale = document.getElementById(ROOT_ID);
      if (stale) stale.classList.remove("open");
      document.documentElement.style.overflow = "";

      tick();
      window.__pvOpenPreventivo = openPreventivo;

      // Avoid subtree MutationObserver + style rewrites (can freeze the page white).
      let scheduled = false;
      const scheduleTick = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          tick();
        });
      };
      if (document.body) {
        const obs = new MutationObserver(scheduleTick);
        obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      }
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") scheduleTick();
      });
      window.addEventListener("hashchange", () => {
        // Never keep the full-screen overlay open across trip hash changes.
        if (state.open && /(?:^|[&#])trip=/.test(location.hash)) setOpen(false);
        maybeAutoOpen();
      });

      function maybeAutoOpen() {
        const hash = location.hash.replace(/^#/, "");
        const qs = new URLSearchParams(location.search);
        if (qs.get("preventivo") === "1" || /(^|&)preventivo(=|&|$)/.test(hash) || hash === "preventivo") {
          setTimeout(() => openPreventivo(), 400);
        }
      }
      maybeAutoOpen();

      window.addEventListener("message", (e) => {
        if (e.origin !== location.origin) return;
        if (e.data?.type === "viavia-ready" && state.open && state.section === "itinerary") {
          pushMapPoints();
        }
      });
    } catch (err) {
      console.error("[preventivo]", err);
    }
  }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
