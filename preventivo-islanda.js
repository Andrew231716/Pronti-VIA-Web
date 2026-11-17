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
  const VERSION = "20261117e";
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
    ["esim", "eSIM"],
    ["itinerary", "Itinerario"],
    ["activities", "Attività"],
    ["budget", "Budget"],
    ["sources", "Fonti"],
    ["safety", "Sicurezza"],
    ["export", "Esporta"],
  ];

  // Primary chrome: 4 areas instead of 11 equal pills.
  const NAV_GROUPS = [
    { id: "riepilogo", label: "Riepilogo", section: "overview" },
    { id: "budget", label: "Budget", section: "budget" },
    {
      id: "organizza",
      label: "Organizza",
      sections: [
        ["flights", "Voli"],
        ["stays", "Alloggi"],
        ["transport", "Mezzi"],
        ["itinerary", "Tappe"],
        ["activities", "Attività"],
        ["esim", "eSIM"],
      ],
    },
    {
      id: "altro",
      label: "Altro",
      sections: [
        ["sources", "Fonti"],
        ["safety", "Sicurezza"],
        ["export", "Esporta"],
      ],
    },
  ];

  function navGroupForSection(section) {
    for (const g of NAV_GROUPS) {
      if (g.section === section) return g.id;
      if (g.sections?.some(([id]) => id === section)) return g.id;
    }
    return "riepilogo";
  }

  function sectionLabel(section) {
    const hit = SECTIONS.find(([id]) => id === section);
    return hit ? hit[1] : section;
  }

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
    state.esim =
      saved?.esim ||
      buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
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
      "Il dettaglio costi è nella sezione Preventivo del viaggio (non nelle note).",
      "Tutti i prezzi partono come STIMA o DA VERIFICARE.",
      `Destinazione: ${p.destination}. Preferenze: no ostelli; max ${p.prefs.maxStops} scali.`,
    ].join("\n");

    state.esim = buildEsimCatalog(p.destination, p.start, p.end);
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
      notes,
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
      esim: state.esim || buildEsimCatalog(state.params.destination, state.params.start, state.params.end),
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
    if (meta.esim && typeof meta.esim === "object") {
      state.esim = meta.esim;
    } else {
      state.esim = buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
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

  /** Keep notes clean: preventivo lives in trip.meta.preventivo, not in notes. */
  function stripPreventivoNotes(notes) {
    return String(notes || "")
      .replace(/\n\n\[Preventivo [^\]]*\][^\n]*/g, "")
      .replace(/\[Preventivo [^\]]*\][^\n]*/g, "")
      .trim()
      .slice(0, 4000);
  }

  function stampPreventivoNotes(notes) {
    // Back-compat alias: no longer appends to notes.
    return stripPreventivoNotes(notes);
  }

  function resolveEsimCountry(destination) {
    const q = String(destination || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const rules = [
      { re: /ghana|accra|kumasi/, country: "Ghana", code: "gh", slug: "ghana" },
      { re: /islanda|iceland|reykjav/, country: "Islanda", code: "is", slug: "iceland" },
      { re: /italia|italy|roma|milan/, country: "Italia", code: "it", slug: "italy" },
      { re: /spagna|spain|barcellona|madrid/, country: "Spagna", code: "es", slug: "spain" },
      { re: /francia|france|parigi|paris/, country: "Francia", code: "fr", slug: "france" },
      { re: /germania|germany|berlino|berlin/, country: "Germania", code: "de", slug: "germany" },
      { re: /portogallo|portugal|lisbon/, country: "Portogallo", code: "pt", slug: "portugal" },
      { re: /grecia|greece|atene|athens/, country: "Grecia", code: "gr", slug: "greece" },
      { re: /turchia|turkey|istanbul/, country: "Turchia", code: "tr", slug: "turkey" },
      { re: /giappone|japan|tokyo/, country: "Giappone", code: "jp", slug: "japan" },
      { re: /thailand|bangkok/, country: "Thailandia", code: "th", slug: "thailand" },
      { re: /usa|stati uniti|new york|miami/, country: "Stati Uniti", code: "us", slug: "united-states" },
      { re: /uk|regno unito|londra|london/, country: "Regno Unito", code: "gb", slug: "united-kingdom" },
      { re: /marocco|morocco|marrakech/, country: "Marocco", code: "ma", slug: "morocco" },
      { re: /egitto|egypt|cairo/, country: "Egitto", code: "eg", slug: "egypt" },
      { re: /kenya|nairobi/, country: "Kenya", code: "ke", slug: "kenya" },
      { re: /tanzania|zanzibar/, country: "Tanzania", code: "tz", slug: "tanzania" },
      { re: /sudafrica|south africa|citt[aà] del capo/, country: "Sudafrica", code: "za", slug: "south-africa" },
    ];
    for (const rule of rules) {
      if (rule.re.test(q)) return rule;
    }
    const fallback = String(destination || "destinazione").trim() || "destinazione";
    return {
      country: fallback,
      code: "",
      slug: fallback.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "travel",
    };
  }

  function stayDaysBetween(start, end) {
    if (!start || !end) return Math.max(1, Number(state.params?.days) || 7);
    const a = new Date(`${start}T12:00:00`);
    const b = new Date(`${end}T12:00:00`);
    if (Number.isNaN(+a) || Number.isNaN(+b) || b < a) return Math.max(1, Number(state.params?.days) || 7);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  function buildEsimCatalog(destination, start, end) {
    const info = resolveEsimCountry(destination);
    const days = stayDaysBetween(start, end);
    const q = encodeURIComponent(info.country);
    const slug = info.slug;
    // Indicative STIMA bands for traveler eSIM (EUR) — always DA VERIFICARE on vendor sites.
    const light = days <= 7 ? { gb: 3, from: 8, to: 15 } : days <= 15 ? { gb: 5, from: 12, to: 22 } : { gb: 10, from: 18, to: 35 };
    const mid = days <= 7 ? { gb: 5, from: 14, to: 25 } : days <= 15 ? { gb: 10, from: 20, to: 38 } : { gb: 20, from: 30, to: 55 };
    const heavy = days <= 7 ? { gb: 10, from: 22, to: 40 } : days <= 15 ? { gb: 20, from: 35, to: 60 } : { gb: 50, from: 50, to: 90 };
    const providers = [
      {
        id: "airalo",
        name: "Airalo",
        trust: "Marketplace eSIM molto usato · prezzi trasparenti",
        url: `https://www.airalo.com/search?q=${q}`,
        plans: [
          { label: `Light ~${light.gb} GB / ${days} gg`, price: `~€${light.from}–${light.to}`, note: "STIMA" },
          { label: `Media ~${mid.gb} GB / ${days} gg`, price: `~€${mid.from}–${mid.to}`, note: "STIMA" },
        ],
      },
      {
        id: "holafly",
        name: "Holafly",
        trust: "Piani spesso illimitati per paese · costo più alto",
        url: `https://esim.holafly.com/esim-${slug}/`,
        plans: [
          { label: `Illimitato ~${days} giorni`, price: days <= 7 ? "~€19–29" : days <= 15 ? "~€34–47" : "~€47–69", note: "STIMA" },
        ],
      },
      {
        id: "nomad",
        name: "Nomad",
        trust: "Buono per confronti GB/giorno",
        url: `https://www.getnomad.app/en/search?q=${q}`,
        plans: [
          { label: `Media ~${mid.gb} GB`, price: `~€${mid.from}–${mid.to}`, note: "STIMA" },
          { label: `Heavy ~${heavy.gb} GB`, price: `~€${heavy.from}–${heavy.to}`, note: "STIMA" },
        ],
      },
      {
        id: "saily",
        name: "Saily (NordVPN)",
        trust: "App chiara · checkout in-app",
        url: `https://saily.com/destinations/${slug}/`,
        plans: [{ label: `Light/Media ${days} gg`, price: `~€${light.from}–${mid.to}`, note: "STIMA" }],
      },
      {
        id: "gigsky",
        name: "GigSky",
        trust: "Operatore eSIM globale",
        url: `https://www.gigsky.com/destinations`,
        plans: [{ label: `Pay-as-you-go / pacchetti`, price: "varia", note: "DA VERIFICARE" }],
      },
    ];
    const searchLinks = [
      {
        title: `Confronta eSIM ${info.country} su Google`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`best esim ${info.country} ${days} days price comparison`)}`,
      },
      {
        title: "Airalo store",
        url: `https://www.airalo.com/search?q=${q}`,
      },
      {
        title: "Holafly destinazione",
        url: `https://esim.holafly.com/esim-${slug}/`,
      },
    ];
    return {
      country: info.country,
      countryCode: info.code,
      days,
      start: start || "",
      end: end || "",
      providers,
      searchLinks,
      disclaimer:
        "Prezzi e GB sono STIMA indicative: verifica sempre tariffe aggiornate sui siti ufficiali prima dell’acquisto. Serve uno smartphone eSIM-compatible.",
    };
  }

  function esimBlockHtml(catalog, { compact = false } = {}) {
    const c = catalog || buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
    const providers = (c.providers || [])
      .map(
        (p) => `<article class="pv-esim-card">
        <header>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="pv-prev-muted">${escapeHtml(p.trust || "")}</span>
        </header>
        <ul>${(p.plans || [])
          .map(
            (plan) =>
              `<li><span>${escapeHtml(plan.label)}</span> <em>${escapeHtml(plan.price)}</em> <span class="pv-badge ${plan.note === "STIMA" ? "STIMA" : "WARN"}">${escapeHtml(plan.note || "STIMA")}</span></li>`
          )
          .join("")}</ul>
        <a class="pv-esim-link" href="${escapeAttr(p.url)}" target="_blank" rel="noopener noreferrer">Apri ${escapeHtml(p.name)}</a>
      </article>`
      )
      .join("");
    const searches = (c.searchLinks || [])
      .map((s) => `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>`)
      .join(" · ");
    return `
      <div class="pv-esim-block" data-esim-root="1">
        <p class="pv-callout">eSIM per <strong>${escapeHtml(c.country)}</strong> · permanenza <strong>${c.days} giorni</strong>${
          c.start && c.end ? ` (${escapeHtml(c.start)} → ${escapeHtml(c.end)})` : ""
        }. Solo operatori/app attendibili; i costi sotto sono <span class="pv-badge STIMA">STIMA</span>.</p>
        ${compact ? "" : `<p class="pv-prev-muted">${escapeHtml(c.disclaimer)}</p>`}
        <div class="pv-esim-grid">${providers}</div>
        <p class="pv-esim-search">Ricerca diretta: ${searches}</p>
      </div>`;
  }

  async function syncPreventivoIntoTrip() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio per sincronizzare il preventivo");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
    state.esim = buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
    meta.preventivo = buildPreventivoMeta();
    trip.meta = meta;
    // Preventivo stays in meta — strip legacy stamps from notes.
    trip.notes = stripPreventivoNotes(trip.notes);
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
      trip2.notes = stripPreventivoNotes(trip2.notes);
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
    trip.notes = stripPreventivoNotes(trip.notes);
    const saved = await saveTripRecord(auth, trip, data.revision);
    await refreshShareAfterSave(auth);
    state.status = `Itinerario sincronizzato (+${add.length} tappe). Preventivo nella sezione dedicata.`;
    return saved;
  }

  async function syncBudgetEstimatesToExpenses() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const members = trip.members || [];
    if (!members.length) throw new Error("Aggiungi almeno un membro");
    // React schema expects member ids (not display names) for payer/shares.
    const payer = members[0].id;
    ensureBudgetLines();
    const stamp = nowIso().slice(0, 10);
    const newExpenses = state.lines
      .filter((l) => lineTotal(l) > 0)
      .map((l) => {
        const amount = lineTotal(l);
        const shareEach = Math.floor(amount / members.length);
        let rem = amount - shareEach * members.length;
        const shares = members.map((m, i) => ({
          member: m.id,
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
    trip.notes = stripPreventivoNotes(trip.notes);
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
      #${ROOT_ID} .pv-prev-scrim{position:fixed;inset:0;background:rgba(8,24,28,.34);backdrop-filter:blur(2px);pointer-events:auto}
      #${ROOT_ID} .pv-prev-shell{
        position:fixed;right:16px;bottom:calc(${FAB_SAFE} + ${FAB_SIZE * 2 + 28}px);z-index:2;pointer-events:auto;
        width:min(430px,calc(100vw - 24px));height:min(80vh,720px);
        display:flex;flex-direction:column;
        background:linear-gradient(180deg,#f7fbfb 0%,#eef6f6 100%);
        border:1px solid rgba(18,64,72,.12);border-radius:24px;
        box-shadow:0 28px 70px rgba(8,30,36,.28);overflow:hidden;
      }
      #${ROOT_ID} .pv-prev-top{
        flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding:14px 16px 12px;background:linear-gradient(135deg,#0f3a40 0%,#176068 55%,#0f8a8f 140%);
        color:#fff;cursor:grab;touch-action:none
      }
      #${ROOT_ID} .pv-prev-top:active{cursor:grabbing}
      #${ROOT_ID} .pv-prev-top h1{margin:0;font-size:1.05rem;font-weight:800;letter-spacing:-.01em}
      #${ROOT_ID} .pv-prev-top .pv-prev-sub{display:block;font-size:.72rem;font-weight:600;opacity:.78;margin-top:3px}
      #${ROOT_ID} .pv-prev-top button{
        appearance:none;border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:12px;
        padding:9px 12px;font:700 13px inherit;cursor:pointer
      }
      #${ROOT_ID} .pv-prev-nav{
        flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;
        padding:10px 12px 8px;background:rgba(255,255,255,.72);border-bottom:1px solid rgba(18,64,72,.08)
      }
      #${ROOT_ID} .pv-prev-nav button{
        appearance:none;border:0;border-radius:14px;padding:10px 6px;min-height:44px;
        background:transparent;color:#3d5960;font:750 .78rem/1.1 inherit;cursor:pointer
      }
      #${ROOT_ID} .pv-prev-nav button.active{background:#124048;color:#fff;box-shadow:0 8px 18px rgba(18,64,72,.2)}
      #${ROOT_ID} .pv-prev-subnav{
        flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:8px 12px;
        background:transparent;-webkit-overflow-scrolling:touch
      }
      #${ROOT_ID} .pv-prev-subnav button{
        flex:0 0 auto;appearance:none;border:1px solid rgba(18,64,72,.12);background:#fff;
        color:#184047;border-radius:999px;padding:7px 12px;font:700 .75rem inherit;cursor:pointer;white-space:nowrap
      }
      #${ROOT_ID} .pv-prev-subnav button.active{background:#007d82;border-color:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-body{flex:1 1 auto;overflow:auto;padding:12px 14px 18px;width:100%;margin:0;box-sizing:border-box}
      #${ROOT_ID} .pv-prev-card{
        background:#fff;border:1px solid rgba(18,64,72,.08);border-radius:18px;padding:14px;margin:0 0 12px;
        box-shadow:0 1px 0 rgba(255,255,255,.8)
      }
      #${ROOT_ID} .pv-prev-card h2{margin:0 0 8px;font-size:1.02rem;font-weight:800;color:#0f2c31;letter-spacing:-.01em}
      #${ROOT_ID} .pv-prev-card p,#${ROOT_ID} .pv-prev-muted{margin:0 0 10px;color:#4a646b;font-size:.9rem;line-height:1.45}
      #${ROOT_ID} .pv-prev-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
      #${ROOT_ID} label.pv-field{display:grid;gap:5px;font-size:.72rem;font-weight:750;color:#5b7076;letter-spacing:.03em;text-transform:uppercase}
      #${ROOT_ID} label.pv-field input,#${ROOT_ID} label.pv-field select,#${ROOT_ID} label.pv-field textarea{
        font:600 .95rem inherit;text-transform:none;letter-spacing:normal;color:#122f34;
        border:1px solid #d0e0e0;border-radius:12px;padding:11px 12px;background:#f7fbfb
      }
      #${ROOT_ID} .pv-prev-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      #${ROOT_ID} .pv-prev-actions button,#${ROOT_ID} .pv-prev-actions a.ghost{
        appearance:none;border:0;border-radius:12px;padding:11px 14px;font:700 13px inherit;cursor:pointer;min-height:42px
      }
      #${ROOT_ID} .pv-prev-actions .primary{background:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-actions .ghost,#${ROOT_ID} .pv-prev-actions a.ghost{
        background:#eef5f5;color:#1d3338;text-decoration:none;display:inline-flex;align-items:center
      }
      #${ROOT_ID} .pv-prev-more{margin-top:8px}
      #${ROOT_ID} .pv-prev-more > summary{
        list-style:none;cursor:pointer;font:700 .82rem inherit;color:#0f5a5e;padding:6px 0
      }
      #${ROOT_ID} .pv-prev-more > summary::-webkit-details-marker{display:none}
      #${ROOT_ID} .pv-badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:750;letter-spacing:.03em;text-transform:uppercase}
      #${ROOT_ID} .pv-badge.STIMA{background:#fff3cd;color:#7a5b00}
      #${ROOT_ID} .pv-badge.DA\\ VERIFICARE,#${ROOT_ID} .pv-badge.WARN{background:#fde8e8;color:#8a1f1f}
      #${ROOT_ID} .pv-badge.VERIFICATO{background:#e3f6ea;color:#0f5a30}
      #${ROOT_ID} .pv-badge.SCADUTO{background:#eee;color:#555}
      #${ROOT_ID} table{width:100%;border-collapse:collapse;font-size:.86rem}
      #${ROOT_ID} th,#${ROOT_ID} td{border-bottom:1px solid #eef3f3;padding:8px 6px;text-align:left;vertical-align:top}
      #${ROOT_ID} .pv-status{margin:4px 0 0;font-size:.8rem;color:#5b7076;min-height:1.1em}
      #${ROOT_ID} .pv-callout{padding:10px 12px;border-radius:14px;background:#eaf5f5;border:1px solid #d5e8e8;color:#0f2c31;font-size:.86rem;margin:0 0 12px;line-height:1.4}
      #${ROOT_ID} a{color:#007d82;font-weight:700}
      #${ROOT_ID} .pv-hero{
        position:relative;overflow:hidden;border-radius:20px;padding:16px;margin:0 0 12px;
        background:linear-gradient(145deg,#0f3a40 0%,#147078 48%,#1aa0a6 120%);color:#fff;
        box-shadow:0 16px 36px rgba(15,58,64,.28)
      }
      #${ROOT_ID} .pv-hero::after{
        content:"";position:absolute;right:-30px;top:-40px;width:140px;height:140px;border-radius:50%;
        background:rgba(255,255,255,.08);pointer-events:none
      }
      #${ROOT_ID} .pv-hero .eyebrow{margin:0;font:750 .68rem/1 inherit;letter-spacing:.06em;text-transform:uppercase;opacity:.78}
      #${ROOT_ID} .pv-hero .amount{margin:6px 0 2px;font:800 1.85rem/1.05 inherit;letter-spacing:-.03em}
      #${ROOT_ID} .pv-hero .sub{margin:0;font:600 .82rem/1.35 inherit;opacity:.88}
      #${ROOT_ID} .pv-hero-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
      #${ROOT_ID} .pv-chip{
        display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;
        background:rgba(255,255,255,.14);font:700 .72rem/1 inherit
      }
      #${ROOT_ID} .pv-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}
      #${ROOT_ID} .pv-stat{
        background:#fff;border:1px solid rgba(18,64,72,.08);border-radius:16px;padding:12px
      }
      #${ROOT_ID} .pv-stat span{display:block;font:700 .68rem/1 inherit;letter-spacing:.04em;text-transform:uppercase;color:#5b7380}
      #${ROOT_ID} .pv-stat strong{display:block;margin-top:6px;font:800 1.05rem/1.1 inherit;color:#0f2c31}
      #${ROOT_ID} .pv-quick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}
      #${ROOT_ID} .pv-quick button{
        appearance:none;border:1px solid rgba(18,64,72,.1);background:#fff;border-radius:16px;
        padding:14px 12px;text-align:left;cursor:pointer;min-height:72px
      }
      #${ROOT_ID} .pv-quick button strong{display:block;font:800 .92rem/1.2 inherit;color:#0f2c31}
      #${ROOT_ID} .pv-quick button span{display:block;margin-top:4px;font:600 .75rem/1.3 inherit;color:#5b7380}
      #${ROOT_ID} .pv-budget-hero{
        display:grid;gap:10px;grid-template-columns:1.3fr .9fr;margin:0 0 12px
      }
      #${ROOT_ID} .pv-budget-hero .main,#${ROOT_ID} .pv-budget-hero .side{
        border-radius:18px;padding:14px;border:1px solid rgba(18,64,72,.08);background:#fff
      }
      #${ROOT_ID} .pv-budget-hero .main{
        background:linear-gradient(160deg,#f4fbfb,#e7f5f5);border-color:rgba(0,125,130,.16)
      }
      #${ROOT_ID} .pv-budget-hero .label{margin:0;font:750 .68rem/1 inherit;letter-spacing:.04em;text-transform:uppercase;color:#5b7380}
      #${ROOT_ID} .pv-budget-hero .amount{margin:6px 0 0;font:800 1.55rem/1 inherit;color:#0f2c31;letter-spacing:-.02em}
      #${ROOT_ID} .pv-budget-hero .side .row{display:flex;justify-content:space-between;gap:8px;margin:0 0 8px;font:650 .82rem inherit;color:#3d5960}
      #${ROOT_ID} .pv-budget-bar{height:8px;border-radius:999px;background:#e3eeee;overflow:hidden}
      #${ROOT_ID} .pv-budget-bar > i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#007d82,#2bb7bc)}
      #${ROOT_ID} .pv-budget-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 10px}
      #${ROOT_ID} .pv-budget-toolbar select{border:1px solid #d0e0e0;border-radius:12px;padding:9px 12px;font:700 .85rem inherit;background:#fff;color:#122f34}
      #${ROOT_ID} .pv-budget-list{display:grid;gap:8px}
      #${ROOT_ID} .pv-budget-line{
        display:grid;gap:8px;padding:12px;border-radius:16px;background:#fff;
        border:1px solid rgba(18,64,72,.08)
      }
      #${ROOT_ID} .pv-budget-line-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
      #${ROOT_ID} .pv-budget-line-top strong{font:800 .95rem/1.25 inherit;color:#0f2c31}
      #${ROOT_ID} .pv-budget-line-top .tot{font:800 .95rem/1 inherit;color:#0f5a5e;white-space:nowrap}
      #${ROOT_ID} .pv-budget-line-edit{display:grid;grid-template-columns:1fr 70px 1fr auto;gap:8px;align-items:end}
      #${ROOT_ID} .pv-budget-line-edit label{display:grid;gap:4px;font:700 .68rem/1 inherit;color:#5b7380;text-transform:uppercase}
      #${ROOT_ID} .pv-budget-line-edit input,#${ROOT_ID} .pv-budget-line-edit select{
        width:100%;box-sizing:border-box;min-height:40px;border:1px solid #d5e3e5;border-radius:10px;
        padding:8px 10px;font:700 .88rem inherit;background:#f7fbfb;color:#122f34
      }
      #${ROOT_ID} .pv-budget-line-edit .del{
        appearance:none;border:0;background:#fde8e8;color:#8a1f1f;border-radius:10px;
        min-height:40px;min-width:40px;font:800 .9rem inherit;cursor:pointer
      }
      #${ROOT_ID} .pv-esim-grid{display:grid;gap:10px;grid-template-columns:1fr}
      #${ROOT_ID} .pv-esim-card{border:1px solid #d9e7e7;border-radius:14px;padding:12px;background:#f7fbfb}
      #${ROOT_ID} .pv-esim-card header{display:grid;gap:2px;margin-bottom:8px}
      #${ROOT_ID} .pv-esim-card ul{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}
      #${ROOT_ID} .pv-esim-card li{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:.88rem}
      #${ROOT_ID} .pv-esim-card li em{font-style:normal;font-weight:700;color:#0f2c31}
      #${ROOT_ID} .pv-esim-link{display:inline-flex;align-items:center;min-height:36px;padding:8px 12px;border-radius:999px;background:#007d82;color:#fff!important;text-decoration:none;font-size:.85rem}
      #${ROOT_ID} .pv-esim-search{font-size:.85rem;line-height:1.5}
      .pv-prev-launch{
        appearance:none;border:0;position:fixed;right:${FAB_DOCK_RIGHT}px;bottom:${PREV_FAB_BOTTOM};z-index:85;
        width:${FAB_SIZE}px;height:${FAB_SIZE}px;border-radius:50%;padding:0;display:none;
        background:radial-gradient(circle at 30% 28%,#3a6b72 0%,#124048 58%,#0a2c32 100%);
        color:#fff;box-shadow:0 14px 32px rgba(0,40,50,.38),inset 0 1px 0 rgba(255,255,255,.2);
        cursor:grab;align-items:center;justify-content:center;touch-action:none;user-select:none;
        animation:pv-fab-float 3.6s ease-in-out infinite;animation-delay:.4s
      }
      .pv-prev-launch:active,.pv-prev-launch.pv-dragging{cursor:grabbing;animation:none;transform:scale(1.04)}
      .pv-prev-launch svg{width:28px;height:28px;display:block}
      .pv-prev-launch .pv-prev-fab-label{
        position:absolute;right:68px;bottom:14px;white-space:nowrap;
        background:#0f2c31;color:#fff;font:700 11px/1 inherit;padding:6px 10px;border-radius:999px;
        box-shadow:0 6px 16px rgba(0,0,0,.18);opacity:0;transform:translateX(6px);pointer-events:none;transition:opacity .15s,transform .15s
      }
      .pv-prev-launch:hover .pv-prev-fab-label,.pv-prev-launch:focus-visible .pv-prev-fab-label{opacity:1;transform:none}
      body.pv-account-ready.pv-trip-open .pv-prev-launch{display:inline-flex}
      @media (max-width:640px){
        .pv-prev-launch{
          right:16px;width:58px;height:58px;
          bottom:calc(max(52px, env(safe-area-inset-bottom, 0px) + 28px))
        }
        .pv-prev-launch .pv-prev-fab-label{display:none}
        #${ROOT_ID} .pv-prev-shell{
          left:0!important;right:0!important;bottom:0!important;top:auto!important;
          width:100%;height:min(78dvh,78vh);border-radius:22px 22px 0 0
        }
        #${ROOT_ID} .pv-budget-hero{grid-template-columns:1fr}
        #${ROOT_ID} .pv-budget-line-edit{grid-template-columns:1fr 1fr; }
        #${ROOT_ID} .pv-budget-line-edit .del{grid-column:1 / -1}
      }
    `;
    style.dataset.pvReady = VERSION;
  }

  function preventivoIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/>
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="17" cy="17" r="3.2" fill="#2bb7bc" stroke="#fff" stroke-width="1.2"/>
    </svg>`;
  }

  function syncTripOpenClass() {
    try {
      const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      document.body.classList.toggle("pv-trip-open", Boolean(p.get("trip") && p.get("key")));
    } catch {
      document.body.classList.remove("pv-trip-open");
    }
  }

  function launchBtn() {
    if (!document.body) return;
    syncTripOpenClass();
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
      addEventListener("hashchange", syncTripOpenClass);
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
    document.getElementById("pv-nav-budget")?.setAttribute("aria-expanded", String(open));
    window.__pvSetPrimaryNav?.(open ? "budget" : tripAuth() ? "trips" : "home");
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
      document.getElementById("pv-prev-import")?.classList.remove("open");
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
      case "esim":
        return esimHtml();
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

  function spentFromTrip() {
    try {
      const cached = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}")[tripAuth()?.id]?.trip;
      if (!Array.isArray(cached?.expenses)) return null;
      const count = cached.members?.length || Number(state.params.travelers) || 1;
      const sum = cached.expenses.reduce((total, expense) => total + (Number(expense.amountCents ?? expense.amount) || 0), 0);
      return { group: sum, pp: Math.round(sum / count), count };
    } catch {
      return null;
    }
  }

  function overviewHtml() {
    ensureBudgetLines();
    const p = state.params;
    const tot = budgetTotals();
    const actual = spentFromTrip();
    const dest = p.destination || p.title || "Nuovo viaggio";
    const when =
      p.start && p.end
        ? `${p.start} → ${p.end}`
        : "Date da impostare";
    return `
      <div class="pv-hero">
        <p class="eyebrow">Preventivo · ${escapeHtml(state.scenario)}</p>
        <p class="amount">${fmtMoney(tot.group)}</p>
        <p class="sub">${fmtMoney(tot.pp)} a persona · ${escapeHtml(String(p.travelers || 1))} adulti</p>
        <div class="pv-hero-meta">
          <span class="pv-chip">${escapeHtml(dest)}</span>
          <span class="pv-chip">${escapeHtml(when)}</span>
          ${actual ? `<span class="pv-chip">Speso ${fmtMoney(actual.group)}</span>` : ""}
        </div>
      </div>
      <div class="pv-stat-grid">
        <div class="pv-stat"><span>Verificato</span><strong>${fmtMoney(tot.byStatus.VERIFICATO || 0)}</strong></div>
        <div class="pv-stat"><span>Da verificare</span><strong>${fmtMoney((tot.byStatus["DA VERIFICARE"] || 0) + (tot.byStatus.STIMA || 0))}</strong></div>
      </div>
      <div class="pv-quick">
        <button type="button" data-section="budget"><strong>Apri budget</strong><span>Voci, import e scenari</span></button>
        <button type="button" data-act="import-budget"><strong>Importa foglio</strong><span>CSV, Excel, PDF o foto</span></button>
        <button type="button" data-section="flights"><strong>Voli</strong><span>Cerca e applica prezzi</span></button>
        <button type="button" data-section="stays"><strong>Alloggi</strong><span>Hotel e case</span></button>
      </div>
      <div class="pv-prev-card">
        <h2>Dati del viaggio</h2>
        <p class="pv-prev-muted">I prezzi partono come stima: confermali tu dalle fonti ufficiali.</p>
        <div class="pv-prev-grid">
          ${field("title", "Nome viaggio", p.title)}
          ${field("destination", "Destinazione", p.destination)}
          ${field("start", "Andata", p.start, "date")}
          ${field("end", "Ritorno", p.end, "date")}
          ${field("travelers", "Adulti", p.travelers, "number")}
          ${field("departureCity", "Partenza", p.departureCity)}
        </div>
        <details class="pv-prev-more">
          <summary>Dettagli extra</summary>
          <div class="pv-prev-grid" style="margin-top:10px">
            ${field("airportIn", "Aeroporto arrivo", p.airportIn)}
            ${field("currency", "Valuta", p.currency)}
            <label class="pv-field">Aeroporti partenza
              <input data-param="airportsOut" value="${escapeAttr((p.airportsOut || []).join(", "))}" />
            </label>
            <label class="pv-field">Max scali
              <input data-param="maxStops" type="number" min="0" max="2" value="${p.prefs.maxStops}" />
            </label>
          </div>
        </details>
        <div class="pv-prev-actions">
          ${
            state.tripId
              ? `<button type="button" class="primary" data-act="sync-preventivo">Salva nel viaggio</button>`
              : `<button type="button" class="primary" data-act="create-trip">Crea viaggio</button>`
          }
          <button type="button" class="ghost" data-act="save-local">Salva qui</button>
        </div>
        <details class="pv-prev-more">
          <summary>Altre azioni</summary>
          <div class="pv-prev-actions">
            <button type="button" class="ghost" data-act="reset-blank">Nuovo vuoto</button>
            <button type="button" class="ghost" data-act="load-iceland-example">Esempio Islanda</button>
            <button type="button" class="ghost" data-act="clear-draft">Pulisci bozza</button>
          </div>
        </details>
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

  function esimHtml() {
    state.esim = buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
    return `
      <div class="pv-prev-card">
        <h2>eSIM dati per il viaggio</h2>
        <p>Cerca tariffe su siti e app attendibili in base a destinazione e giorni di permanenza. I prezzi sono <span class="pv-badge STIMA">STIMA</span> — conferma sul sito prima di comprare.</p>
        <div class="pv-prev-grid">
          ${field("destination", "Paese / destinazione", state.params.destination)}
          ${field("start", "Dal", state.params.start, "date")}
          ${field("end", "Al", state.params.end, "date")}
        </div>
        <div class="pv-prev-actions" style="margin:10px 0 14px">
          <button type="button" class="primary" data-act="refresh-esim">Aggiorna ricerca eSIM</button>
          <button type="button" class="ghost" data-act="save-local">Salva nel preventivo</button>
          ${
            state.tripId
              ? `<button type="button" class="ghost" data-act="sync-preventivo">Salva nel viaggio</button>`
              : ""
          }
        </div>
        ${esimBlockHtml(state.esim)}
      </div>`;
  }

  function refreshBudgetHeroDom(root) {
    if (!root) return;
    const tot = budgetTotals();
    const actual = spentFromTrip();
    const spentPct =
      actual && tot.group > 0 ? Math.max(0, Math.min(100, Math.round((actual.group / tot.group) * 100))) : 0;
    const amount = root.querySelector(".pv-budget-hero .amount");
    if (amount) amount.textContent = fmtMoney(tot.group);
    const pp = root.querySelector(".pv-budget-hero .main .pv-prev-muted");
    if (pp) pp.textContent = `${fmtMoney(tot.pp)} a persona`;
    const rows = root.querySelectorAll(".pv-budget-hero .side .row strong");
    if (rows[0]) rows[0].textContent = actual ? fmtMoney(actual.group) : "—";
    if (rows[1]) rows[1].textContent = fmtMoney(tot.byStatus.VERIFICATO || 0);
    if (rows[2])
      rows[2].textContent = fmtMoney((tot.byStatus.STIMA || 0) + (tot.byStatus["DA VERIFICARE"] || 0));
    const bar = root.querySelector(".pv-budget-bar > i");
    if (bar) bar.style.width = `${spentPct}%`;
    const status = root.querySelector(".pv-status");
    if (status && !state.status) status.textContent = "";
  }

  function budgetHtml() {
    ensureBudgetLines();
    const tot = budgetTotals();
    const actual = spentFromTrip();
    const spentPct =
      actual && tot.group > 0 ? Math.max(0, Math.min(100, Math.round((actual.group / tot.group) * 100))) : 0;
    const lines = state.lines
      .map(
        (l) => `<article class="pv-budget-line" data-line-card="${escapeAttr(l.id)}">
        <div class="pv-budget-line-top">
          <div>
            <strong>${escapeHtml(l.title)}</strong>
            <div style="margin-top:4px"><span class="pv-badge ${escapeAttr(l.status)}">${escapeHtml(l.status)}</span></div>
          </div>
          <div class="tot">${fmtMoney(lineTotal(l))}</div>
        </div>
        <div class="pv-budget-line-edit">
          <label>€ unit
            <input data-line="${l.id}" data-k="unitEuros" type="number" min="0" step="1" value="${(l.unitCents / 100).toFixed(0)}" />
          </label>
          <label>Qty
            <input data-line="${l.id}" data-k="qty" type="number" min="0" step="1" value="${l.qty}" />
          </label>
          <label>Stato
            <select data-line="${l.id}" data-k="status">
              ${["STIMA", "DA VERIFICARE", "VERIFICATO", "SCADUTO"]
                .map((s) => `<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </label>
          <button type="button" class="del" data-del-line="${escapeAttr(l.id)}" aria-label="Elimina voce">×</button>
        </div>
      </article>`
      )
      .join("");
    return `
      <div class="pv-budget-hero">
        <div class="main">
          <p class="label">Totale stimato</p>
          <p class="amount">${fmtMoney(tot.group)}</p>
          <p class="pv-prev-muted" style="margin:6px 0 0">${fmtMoney(tot.pp)} a persona</p>
        </div>
        <div class="side">
          <div class="row"><span>Speso</span><strong>${actual ? fmtMoney(actual.group) : "—"}</strong></div>
          <div class="pv-budget-bar" aria-hidden="true"><i style="width:${spentPct}%"></i></div>
          <div class="row" style="margin:8px 0 0"><span>Verificato</span><strong>${fmtMoney(tot.byStatus.VERIFICATO || 0)}</strong></div>
          <div class="row"><span>Stima / check</span><strong>${fmtMoney((tot.byStatus.STIMA || 0) + (tot.byStatus["DA VERIFICARE"] || 0))}</strong></div>
        </div>
      </div>
      <div class="pv-budget-toolbar">
        <label class="pv-field" style="margin:0">Scenario
          <select data-scenario="1">
            <option value="economico" ${state.scenario === "economico" ? "selected" : ""}>Economico</option>
            <option value="intermedio" ${state.scenario === "intermedio" ? "selected" : ""}>Intermedio</option>
            <option value="comfort" ${state.scenario === "comfort" ? "selected" : ""}>Comfort</option>
          </select>
        </label>
        <div class="pv-prev-actions" style="margin:0">
          <button type="button" class="primary" data-act="import-budget">Importa</button>
          <button type="button" class="ghost" data-act="add-budget-line">+ Voce</button>
        </div>
      </div>
      <p class="pv-callout">Le voci in <strong>STIMA</strong> non sono prezzi confermati. Tocca lo stato per marcarle verificate.</p>
      <div class="pv-budget-list">${lines || `<div class="pv-prev-card"><p class="pv-prev-muted">Nessuna voce. Importa un foglio o aggiungine una.</p></div>`}</div>
      <div class="pv-prev-actions">
        <button type="button" class="primary" data-act="save-local">Salva budget</button>
        ${
          state.tripId
            ? `<button type="button" class="ghost" data-act="sync-preventivo">Salva nel viaggio</button>`
            : ""
        }
      </div>
      <details class="pv-prev-more">
        <summary>Altre azioni budget</summary>
        <div class="pv-prev-actions">
          <button type="button" class="ghost" data-act="reset-budget">Ricarica template</button>
          <button type="button" class="ghost" data-act="sync-expenses">Copia in Spese di gruppo</button>
        </div>
      </details>`;
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
      <div class="pv-hero">
        <p class="eyebrow">Esporta · ${escapeHtml(state.scenario)}</p>
        <p class="amount">${fmtMoney(tot.group)}</p>
        <p class="sub">${fmtMoney(tot.pp)} a persona · ${escapeHtml(String(state.params.travelers || 1))} adulti</p>
        <div class="pv-hero-meta">
          <span class="pv-chip">${escapeHtml(state.params.title || "Preventivo")}</span>
          <span class="pv-chip">${escapeHtml(state.params.start || "—")} → ${escapeHtml(state.params.end || "—")}</span>
        </div>
      </div>
      <div class="pv-prev-card">
        <h2>Condividi e scarica</h2>
        <p class="pv-prev-muted">PDF dalla stampa del browser, CSV del budget, o copia testo. Il viaggio resta con i link Pronti? VIA!.</p>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="export-print">Stampa / PDF</button>
          <button type="button" class="ghost" data-act="export-csv">CSV budget</button>
          <button type="button" class="ghost" data-act="export-summary">Copia riepilogo</button>
          ${
            state.tripId
              ? `<button type="button" class="ghost" data-act="sync-preventivo">Salva nel viaggio</button>`
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
    const activeGroup = navGroupForSection(state.section);
    const tabs = NAV_GROUPS.map((g) => {
      const target = g.section || g.sections?.[0]?.[0] || "overview";
      return `<button type="button" data-nav-group="${g.id}" data-section="${target}" class="${activeGroup === g.id ? "active" : ""}">${g.label}</button>`;
    }).join("");
    const group = NAV_GROUPS.find((g) => g.id === activeGroup);
    const subnav =
      group?.sections?.length
        ? `<div class="pv-prev-subnav">${group.sections
            .map(
              ([id, label]) =>
                `<button type="button" data-section="${id}" class="${state.section === id ? "active" : ""}">${label}</button>`
            )
            .join("")}</div>`
        : "";
    const title =
      activeGroup === "riepilogo"
        ? "Preventivo"
        : activeGroup === "budget"
          ? "Budget"
          : sectionLabel(state.section);
    root.innerHTML = `
      <div class="pv-prev-scrim" data-act="close" aria-hidden="true"></div>
      <div class="pv-prev-shell" id="pv-prev-shell">
        <div class="pv-prev-top" id="pv-prev-drag">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <span class="pv-prev-sub">${escapeHtml(state.params?.destination || state.params?.title || "Trascina per spostare")}</span>
          </div>
          <button type="button" data-act="close">Chiudi</button>
        </div>
        <div class="pv-prev-nav">${tabs}</div>
        ${subnav}
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
        const groupId = btn.getAttribute("data-nav-group");
        const next = btn.getAttribute("data-section");
        if (groupId) {
          const group = NAV_GROUPS.find((g) => g.id === groupId);
          if (group?.sections?.length) {
            const stillInGroup = group.sections.some(([id]) => id === state.section);
            state.section = stillInGroup ? state.section : next;
          } else {
            state.section = group?.section || next;
          }
        } else {
          state.section = next;
        }
        render();
      });
    });
    root.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => void onAction(btn.getAttribute("data-act")));
    });
    root.querySelectorAll("[data-del-line]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-line");
        state.lines = (state.lines || []).filter((l) => l.id !== id);
        persistState();
        state.status = "Voce rimossa.";
        render();
      });
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
      const applyLineEdit = () => {
        const id = el.getAttribute("data-line");
        const k = el.getAttribute("data-k");
        const row = state.lines.find((l) => l.id === id);
        if (!row) return;
        if (k === "unitEuros") row.unitCents = eurosToCents(el.value);
        else if (k === "qty") row.qty = Number(el.value) || 0;
        else if (k === "status") row.status = el.value;
        persistState();
        const card = root.querySelector(`[data-line-card="${CSS.escape(id)}"]`);
        if (card) {
          const totEl = card.querySelector(".tot");
          if (totEl) totEl.textContent = fmtMoney(lineTotal(row));
          if (k === "status") {
            const badge = card.querySelector(".pv-badge");
            if (badge) {
              badge.className = `pv-badge ${row.status}`;
              badge.textContent = row.status;
            }
          }
        }
        refreshBudgetHeroDom(root);
      };
      el.addEventListener("change", applyLineEdit);
      if (el.matches('input[type="number"]')) el.addEventListener("input", applyLineEdit);
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
      if (act === "refresh-esim") {
        state.params = refreshDerivedParams(mergeParams(state.params));
        state.esim = buildEsimCatalog(state.params.destination, state.params.start, state.params.end);
        state.section = "esim";
        persistState();
        state.status = `eSIM aggiornate per ${state.esim.country} · ${state.esim.days} giorni.`;
        render();
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
      if (act === "import-budget") {
        void openPreventivoImportWizard();
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
      if (act === "add-budget-line") {
        ensureBudgetLines();
        const title = window.prompt("Nome della voce di budget", "Nuova voce");
        if (title == null) return;
        const clean = String(title).trim() || "Nuova voce";
        state.lines.push({
          id: uid(),
          key: `custom-${Date.now()}`,
          title: clean,
          mode: "group",
          unitCents: 0,
          qty: 1,
          status: "STIMA",
          source: "Voce aggiunta manualmente",
          url: "",
          verifiedAt: "",
        });
        persistState();
        state.status = `Aggiunta voce «${clean}».`;
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

  /* ---------- Import foglio / PDF / Word / Excel / foto → budget lines ---------- */

  function guessPreventivoKey(title) {
    const t = String(title || "").toLowerCase();
    if (/volo|flight|aereo|bigliett/.test(t)) return "flights";
    if (/allogg|hotel|airbnb|appart|ostello|bnb/.test(t)) return "stay";
    if (/cibo|food|mangiar|ristor|aliment/.test(t)) return "food";
    if (/assicur/.test(t)) return "insurance";
    if (/bagagl|luggage/.test(t)) return "bags";
    if (/noleggio|auto|macchina|car\b/.test(t)) return "car";
    if (/carbur|fuel|benzina/.test(t)) return "fuel";
    if (/parcheg/.test(t)) return "parking";
    if (/trasport|transit|metro|bus/.test(t)) return "transit";
    if (/escursion|tour|attivit|parch/.test(t)) return "tours";
    if (/ingress|ticket|bigliett/.test(t)) return "tickets";
    if (/imprevist|buffer|fondo/.test(t)) return "buffer";
    if (/internet|esim|hotspot|sim|vaccin|visto|visa|passaport/.test(t)) return "misc";
    return "";
  }

  function parseEuroLoose(raw) {
    const s = String(raw ?? "").trim();
    if (!s || /^x$/i.test(s) || s === "-" || s === "—" || s === "–" || /^n\/?a$/i.test(s)) return null;
    let t = s.replace(/[€£]/g, "").replace(/^E(?=\d)/i, "").replace(/\s/g, "");
    if (!t) return null;
    if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(t)) t = t.replace(/,/g, "");
    else t = t.replace(/[^\d.-]/g, "");
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function parseConfirmedCell(raw) {
    const s = String(raw ?? "").trim().toLowerCase();
    if (!s || s === "-" || s === "—" || s === "–" || s === "no" || s === "false" || s === "0") return false;
    return /✓|✔|☑|✅|true|si|sì|yes|ok|conferm|verificat|check/.test(s);
  }

  function isPreventivoHeaderRow(cols) {
    const joined = cols.map((c) => String(c || "").toLowerCase()).join(" ");
    return /tipolog|voce|categori/.test(joined) && /costo|importo|euro|€|prezzo/.test(joined);
  }

  function isTotalRow(title) {
    const s = String(title || "").trim();
    if (/^(totale|total|tote|tot\.?|sum|subtotale|grand total)\b/i.test(s)) return true;
    // OCR often prefixes totals: "i Totale", "3 Totale"
    if (/^(?:[^\s]{1,2}\s+)?tot(?:ale|al|e)?\b/i.test(s) && s.length <= 18) return true;
    return false;
  }

  function splitTableLine(line) {
    const raw = String(line || "").replace(/\r$/, "");
    if (!raw.trim()) return [];
    if (raw.includes("\t")) return raw.split("\t").map((c) => c.trim());
    if (/;/.test(raw) && raw.split(";").length >= 2) {
      return raw.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    }
    if (/,/.test(raw)) {
      const cols = [];
      let cur = "";
      let q = false;
      for (const ch of raw) {
        if (ch === '"') {
          q = !q;
          continue;
        }
        if (ch === "," && !q) {
          cols.push(cur.trim());
          cur = "";
          continue;
        }
        cur += ch;
      }
      cols.push(cur.trim());
      return cols;
    }
    return [raw.trim()];
  }

  function mapHeaderIndexes(headerCols) {
    const norm = headerCols.map((c) => String(c || "").trim().toLowerCase());
    const find = (...preds) => norm.findIndex((c) => preds.some((p) => p.test(c)));
    const titleIdx = find(/tipolog|voce|categori|descr|item|voce/);
    const costIdxs = [];
    norm.forEach((c, i) => {
      if (/costo|importo|euro|€|prezzo|price|amount/.test(c)) costIdxs.push(i);
    });
    const noteIdx = find(/^note/, /note/, /comment/, /dettagl/);
    const confIdx = find(/conferm/, /verificat/, /status|stato|check/);
    return {
      titleIdx: titleIdx >= 0 ? titleIdx : 0,
      costIdxs: costIdxs.length ? costIdxs : [1],
      noteIdx: noteIdx >= 0 ? noteIdx : -1,
      confIdx: confIdx >= 0 ? confIdx : -1,
    };
  }

  function rowToPreventivoLine(cols, map, sourceName = "") {
    const title = String(cols[map.titleIdx] || "").trim();
    if (!title || isTotalRow(title) || isPreventivoHeaderRow(cols)) return null;
    const costs = map.costIdxs
      .map((i) => parseEuroLoose(cols[i]))
      .filter((n) => n != null);
    const note = map.noteIdx >= 0 ? String(cols[map.noteIdx] || "").trim() : "";
    const confirmed = map.confIdx >= 0 ? parseConfirmedCell(cols[map.confIdx]) : false;
    // Skip empty placeholder rows like "Alloggio istanbul | x | x"
    if (!costs.length && !note && !confirmed) {
      const rawCosts = map.costIdxs.map((i) => String(cols[i] || "").trim());
      if (rawCosts.every((c) => !c || /^x$/i.test(c) || c === "-")) return null;
    }
    const unitCents = costs[0] != null ? costs[0] : 0;
    const alt = costs[1] != null && costs[1] !== unitCents ? costs[1] : null;
    const sourceParts = [];
    if (note) sourceParts.push(note);
    if (alt != null) sourceParts.push(`Costo alt: ${fmtMoney(alt)}`);
    if (sourceName) sourceParts.push(`Import: ${sourceName}`);
    return {
      id: uid(),
      key: guessPreventivoKey(title),
      title: title.slice(0, 120),
      mode: "group",
      unitCents,
      qty: 1,
      status: confirmed ? "VERIFICATO" : unitCents > 0 ? "DA VERIFICARE" : "STIMA",
      source: sourceParts.join(" · ").slice(0, 400),
      url: "",
      verifiedAt: confirmed ? nowIso() : "",
    };
  }

  // € and common OCR misreads (£ / E) before Italian money amounts.
  const OCR_COST_TOKEN_RE =
    /[€£E]\s*\d{1,3}(?:\.\d{3})+,\d{2}|[€£E]\s*\d+,\d{2}|[€£E]\s*\d{1,3}(?:\.\d{3})+(?!,)|[€£E]\s*\d+(?:[.,]\d{1,2})?|\b[xX]\b/g;

  function isOcrHeaderLine(line) {
    const s = String(line || "").toLowerCase();
    return /tipolog|categori|voce/.test(s) && /costo|importo|prezzo|€|£/.test(s);
  }

  function isOcrNoiseLine(line) {
    const s = String(line || "").trim();
    if (!s) return true;
    if (/^[A-E](?:\s*[|.]?\s*[A-E]){1,6}$/i.test(s)) return true;
    if (/^[|.\-_—=]+$/u.test(s)) return true;
    if (s.length <= 2 && !/[€£\d]/u.test(s)) return true;
    return false;
  }

  function cleanOcrTitle(title) {
    let t = String(title || "")
      .replace(/^[^A-Za-zÀ-ÿ]+/u, "")
      .replace(/\s*[|_—\-.=]{2,}.*$/u, "")
      .replace(/\s+[€£E]\s*\d.*$/u, "")
      .replace(/\s+/g, " ")
      .trim();
    // Drop OCR glyph/letter prefixes: "È Volo", "i Assicurazione", ") parchi"
    t = t.replace(/^[^\s]{1,2}\s+(?=[A-Za-zÀ-ÿ]{3,})/u, "");
    return t.trim();
  }

  function scorePreventivoImportLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return -1;
    let score = 0;
    for (const l of lines) {
      const title = String(l?.title || "");
      if (!title || title.length < 2) continue;
      if (/[|_—]{2,}/.test(title)) score -= 2;
      if (isTotalRow(title)) {
        score -= 5;
        continue;
      }
      score += 2;
      if (Number(l.unitCents) > 0) score += 3;
      if (l.status === "VERIFICATO") score += 1;
      if (/Import:|OCR foto:|Costo alt:/.test(String(l.source || ""))) score += 0;
    }
    return score;
  }

  function parseSpreadsheetOcrText(text, { sourceName = "" } = {}) {
    const rawLines = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((l) =>
        String(l || "")
          .replace(/[|\[\]]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
    const pendingNotes = [];
    const out = [];
    for (const line of rawLines) {
      if (isOcrNoiseLine(line)) continue;
      if (isOcrHeaderLine(line)) {
        pendingNotes.length = 0;
        continue;
      }
      if (/^totale\b/i.test(line) || isTotalRow(line.split(/\s+/)[0] || "")) continue;

      const matches = [...line.matchAll(new RegExp(OCR_COST_TOKEN_RE.source, "g"))];
      if (!matches.length) {
        if (/^(cibo|food|mangiare)$/i.test(line)) continue;
        // Note cells often wrap onto lines above the next title (Sheets screenshots).
        if (!isOcrNoiseLine(line)) pendingNotes.push(line);
        continue;
      }

      let title = cleanOcrTitle(line.slice(0, matches[0].index));
      if (!title || isTotalRow(title) || isOcrHeaderLine(title)) {
        pendingNotes.length = 0;
        continue;
      }

      const costTokens = [];
      for (let i = 0; i < matches.length && costTokens.length < 2; i++) {
        if (i > 0) {
          const gap = matches[i].index - (matches[i - 1].index + matches[i - 1][0].length);
          if (gap > 10) break;
        }
        costTokens.push(matches[i]);
      }
      const parsedCosts = costTokens.map((m) => (/^x$/i.test(String(m[0]).trim()) ? null : parseEuroLoose(m[0])));
      if (parsedCosts.every((c) => c == null) && costTokens.every((m) => /^x$/i.test(String(m[0]).trim()))) {
        pendingNotes.length = 0;
        continue;
      }
      const unitCents = parsedCosts.find((c) => c != null) ?? 0;
      const alt =
        parsedCosts.length > 1 && parsedCosts[1] != null && parsedCosts[1] !== unitCents ? parsedCosts[1] : null;

      const last = costTokens[costTokens.length - 1];
      let rest = line.slice(last.index + last[0].length).trim();
      let confirmed = false;
      if (/(✓|✔|☑|✅)\s*$/.test(rest)) {
        confirmed = true;
        rest = rest.replace(/(✓|✔|☑|✅)\s*$/u, "").trim();
      } else if (/\s*[=\-—–]\s*$/u.test(rest)) {
        rest = rest.replace(/\s*[=\-—–]\s*$/u, "").trim();
      }

      const noteParts = pendingNotes.splice(0, pendingNotes.length).filter((n) => !isOcrNoiseLine(n));
      if (rest && !isOcrNoiseLine(rest)) noteParts.push(rest);
      const note = noteParts.join(" ").replace(/\s+/g, " ").trim();
      const sourceParts = [];
      if (note) sourceParts.push(note);
      if (alt != null) sourceParts.push(`Costo alt: ${fmtMoney(alt)}`);
      if (sourceName) sourceParts.push(`Import: ${sourceName}`);

      out.push({
        id: uid(),
        key: guessPreventivoKey(title),
        title: title.slice(0, 120),
        mode: "group",
        unitCents,
        qty: 1,
        status: confirmed ? "VERIFICATO" : unitCents > 0 ? "DA VERIFICARE" : "STIMA",
        source: sourceParts.join(" · ").slice(0, 400),
        url: "",
        verifiedAt: confirmed ? nowIso() : "",
      });
    }
    return out.slice(0, 80);
  }

  function parsePreventivoTableText(text, { sourceName = "" } = {}) {
    const lines = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim());
    if (!lines.length) return [];

    // OCR / space-separated spreadsheet rows (common for Sheets screenshots).
    const ocrParsed = parseSpreadsheetOcrText(lines.join("\n"), { sourceName });
    const ocrScore = scorePreventivoImportLines(ocrParsed);

    let map = { titleIdx: 0, costIdxs: [1], noteIdx: -1, confIdx: -1 };
    let start = 0;
    const firstCols = splitTableLine(lines[0]);
    const headerFromSpaces = isOcrHeaderLine(lines[0]);
    if (firstCols.length >= 2 && isPreventivoHeaderRow(firstCols)) {
      map = mapHeaderIndexes(firstCols);
      start = 1;
    } else if (headerFromSpaces || firstCols.length === 1) {
      // Prefer structured OCR parse over naive "first number wins" freeform,
      // which misreads notes like "15 giorni" as costs.
      if (ocrScore >= 8) return ocrParsed;
      const out = [];
      for (const line of lines) {
        if (isOcrHeaderLine(line)) continue;
        const m = line.match(/^(.+?)\s+(€\s*[\d.,]+|\d+[.,]\d{2})\s*(.*)$/);
        if (!m) continue;
        const title = m[1].trim();
        if (isTotalRow(title) || isOcrHeaderLine(title)) continue;
        const cents = parseEuroLoose(m[2]);
        if (cents == null) continue;
        out.push({
          id: uid(),
          key: guessPreventivoKey(title),
          title: title.slice(0, 120),
          mode: "group",
          unitCents: cents,
          qty: 1,
          status: "DA VERIFICARE",
          source: [m[3].trim(), sourceName ? `Import: ${sourceName}` : ""].filter(Boolean).join(" · ").slice(0, 400),
          url: "",
          verifiedAt: "",
        });
      }
      const freeScore = scorePreventivoImportLines(out);
      return freeScore >= ocrScore ? out.slice(0, 80) : ocrParsed;
    }
    const out = [];
    for (const line of lines.slice(start)) {
      const cols = splitTableLine(line);
      if (cols.length < 1) continue;
      const row = rowToPreventivoLine(cols, map, sourceName);
      if (row) out.push(row);
    }
    const tabScore = scorePreventivoImportLines(out);
    return tabScore >= ocrScore ? out.slice(0, 80) : ocrParsed;
  }

  function parsePreventivoJsonPayload(text) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : Array.isArray(data?.lines) ? data.lines : null;
      if (!arr) return [];
      return arr
        .map((l) => {
          const title = String(l.title || l.tipologia || l.name || "").trim();
          if (!title || isTotalRow(title)) return null;
          const unit =
            parseEuroLoose(l.unitCents != null ? Number(l.unitCents) / 100 : l.costo ?? l.amount ?? l.euros) ??
            (Number.isFinite(Number(l.unitCents)) ? Math.round(Number(l.unitCents)) : 0);
          const confirmed = Boolean(l.confirmed || l.confermati || /VERIFICATO/i.test(String(l.status || "")));
          return {
            id: l.id || uid(),
            key: l.key || guessPreventivoKey(title),
            title: title.slice(0, 120),
            mode: l.mode || "group",
            unitCents: unit,
            qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
            status: confirmed ? "VERIFICATO" : l.status || (unit > 0 ? "DA VERIFICARE" : "STIMA"),
            source: String(l.source || l.note || l.notes || "").slice(0, 400),
            url: l.url || "",
            verifiedAt: confirmed ? nowIso() : "",
          };
        })
        .filter(Boolean)
        .slice(0, 80);
    } catch {
      return [];
    }
  }

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    const existing = document.querySelector(`script[data-pv-lib="${src}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true));
        existing.addEventListener("error", () => reject(new Error(`Lib non caricata: ${src}`)));
      });
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.pvLib = src;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => reject(new Error(`Lib non caricata: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function extractTextFromDocx(file) {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "JSZip");
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("Documento Word non leggibile.");
    return xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n");
  }

  async function extractTextFromPdf(file) {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", "pdfjsLib");
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const parts = [];
    for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str).join(" "));
    }
    return parts.join("\n");
  }

  async function extractSheetMatrix(file) {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "XLSX");
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  }

  function matrixToPreventivoLines(matrix, sourceName) {
    const rows = (matrix || []).filter((r) => Array.isArray(r) && r.some((c) => String(c || "").trim()));
    if (!rows.length) return [];
    const text = rows.map((r) => r.map((c) => String(c ?? "").trim()).join("\t")).join("\n");
    return parsePreventivoTableText(text, { sourceName });
  }

  function normalizeOcrTableText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((line) =>
        String(line || "")
          .replace(/\s{2,}/g, "\t")
          .replace(/\t{2,}/g, "\t")
          .trim()
      )
      .filter(Boolean)
      .join("\n");
  }

  async function prepareImageBlobForOcr(file) {
    try {
      if (typeof createImageBitmap !== "function") return file;
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      const n = img.data.length / 4;
      for (let i = 0; i < img.data.length; i += 4) {
        sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
      }
      // Dark Sheets screenshots OCR much better when inverted to light text-on-paper.
      if (sum / n < 120) {
        for (let i = 0; i < img.data.length; i += 4) {
          img.data[i] = 255 - img.data[i];
          img.data[i + 1] = 255 - img.data[i + 1];
          img.data[i + 2] = 255 - img.data[i + 2];
        }
        ctx.putImageData(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) return blob;
      }
      return file;
    } catch {
      return file;
    }
  }

  async function extractTextFromImageOcr(file) {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js", "Tesseract");
    if (!window.Tesseract?.createWorker && !window.Tesseract?.recognize) {
      throw new Error("OCR non disponibile.");
    }
    const image = await prepareImageBlobForOcr(file);
    // Prefer createWorker so we can force table-friendly page segmentation (PSM 4/6).
    if (typeof window.Tesseract.createWorker === "function") {
      const worker = await window.Tesseract.createWorker("ita+eng");
      try {
        let bestText = "";
        let bestScore = -1;
        for (const psm of ["4", "6"]) {
          try {
            await worker.setParameters({ tessedit_pageseg_mode: psm });
            const result = await worker.recognize(image);
            const text = String(result?.data?.text || "").trim();
            if (!text) continue;
            const scored = scorePreventivoImportLines(parseSpreadsheetOcrText(text, { sourceName: "ocr" }));
            if (scored > bestScore) {
              bestScore = scored;
              bestText = text;
            }
          } catch {
            /* try next psm */
          }
        }
        return bestText;
      } finally {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
    }
    const result = await window.Tesseract.recognize(image, "ita+eng", { logger: () => {} });
    return String(result?.data?.text || "").trim();
  }

  async function extractPreventivoFromImage(file) {
    const name = String(file?.name || "immagine");
    const lower = name.toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    if (/\.heic$/i.test(lower) || type.includes("heic") || type.includes("heif")) {
      throw new Error("Formato HEIC non supportato nel browser. Salva in JPG/PNG oppure usa CSV/Excel.");
    }

    // Client-side OCR tuned for spreadsheet screenshots (tipologia / costo / note / confermati).
    let ocrText = "";
    try {
      ocrText = await extractTextFromImageOcr(file);
    } catch (err) {
      throw new Error(
        err?.message?.includes("OCR")
          ? err.message
          : "Lettura foto non riuscita. Prova CSV/Excel o incolla la tabella."
      );
    }
    if (!ocrText) {
      throw new Error("Foto senza testo leggibile. Prova un’immagine più nitida, CSV/Excel o incolla.");
    }
    const candidates = [
      parseSpreadsheetOcrText(ocrText, { sourceName: name }),
      parsePreventivoTableText(normalizeOcrTableText(ocrText), { sourceName: name }),
      parsePreventivoTableText(ocrText, { sourceName: name }),
    ];
    candidates.sort((a, b) => scorePreventivoImportLines(b) - scorePreventivoImportLines(a));
    const lines = candidates[0] || [];
    if (!lines.length || scorePreventivoImportLines(lines) < 5) {
      throw new Error(
        "Ho letto la foto ma non riconosco bene le voci/costi. Esporta CSV/Excel o incolla le righe."
      );
    }
    return lines.map((l) => ({
      ...l,
      source: [l.source, `OCR foto: ${name}`].filter(Boolean).join(" · ").slice(0, 400),
    }));
  }

  async function readPreventivoImportFile(file) {
    const name = String(file?.name || "file");
    const lower = name.toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    if (/\.(png|jpe?g|webp|gif|heic)$/i.test(lower) || type.startsWith("image/")) {
      return extractPreventivoFromImage(file);
    }
    if (/\.pdf$/i.test(lower) || type === "application/pdf") {
      const text = await extractTextFromPdf(file);
      const lines = parsePreventivoTableText(text, { sourceName: name });
      if (lines.length) return lines;
      throw new Error("PDF letto, ma senza tabella riconoscibile. Esporta in CSV/Excel o incolla le righe.");
    }
    if (/\.docx$/i.test(lower)) {
      const text = await extractTextFromDocx(file);
      return parsePreventivoTableText(text, { sourceName: name });
    }
    if (/\.xlsx?$/i.test(lower) || /spreadsheet|excel/.test(type)) {
      const matrix = await extractSheetMatrix(file);
      return matrixToPreventivoLines(matrix, name);
    }
    if (/\.json$/i.test(lower) || type.includes("json")) {
      const text = await file.text();
      const fromJson = parsePreventivoJsonPayload(text);
      return fromJson.length ? fromJson : parsePreventivoTableText(text, { sourceName: name });
    }
    const text = await file.text();
    return parsePreventivoTableText(text, { sourceName: name });
  }

  function applyImportedPreventivoLines(lines, { mode = "merge" } = {}) {
    const incoming = Array.isArray(lines) ? lines.filter((l) => l?.title) : [];
    if (!incoming.length) throw new Error("Nessuna voce da importare.");
    ensureBudgetLines();
    if (mode === "replace") {
      state.lines = incoming.map((l) => ({ ...l, id: l.id || uid() }));
    } else {
      const byTitle = new Map(state.lines.map((l) => [String(l.title || "").toLowerCase(), l]));
      for (const row of incoming) {
        const key = String(row.title || "").toLowerCase();
        const existing = byTitle.get(key);
        if (existing) {
          existing.unitCents = row.unitCents;
          existing.qty = row.qty || 1;
          existing.status = row.status || existing.status;
          existing.source = row.source || existing.source;
          if (row.key) existing.key = row.key;
          if (row.verifiedAt) existing.verifiedAt = row.verifiedAt;
        } else {
          const next = { ...row, id: row.id || uid() };
          state.lines.push(next);
          byTitle.set(key, next);
        }
      }
    }
    persistState();
    return state.lines.length;
  }

  function ensureImportWizardHost() {
    let host = document.getElementById("pv-prev-import");
    // Legacy mounts lived inside #pv-preventivo-root and were wiped by render().
    if (host && host.parentElement !== document.body) {
      host.remove();
      host = null;
    }
    if (host) return host;
    host = document.createElement("div");
    host.id = "pv-prev-import";
    host.innerHTML = `
      <div class="pv-prev-import-scrim" data-imp-close></div>
      <div class="pv-prev-import-sheet" role="dialog" aria-modal="true" aria-labelledby="pv-prev-imp-title">
        <header>
          <div>
            <p class="pv-prev-eyebrow">Budget</p>
            <h3 id="pv-prev-imp-title">Importa nel Preventivo</h3>
          </div>
          <button type="button" class="ghost" data-imp-close aria-label="Chiudi">×</button>
        </header>
        <p class="pv-prev-muted">Carica una foto del foglio, PDF, Word, Excel/CSV oppure incolla la tabella (tipologia, costo, note, confermati).</p>
        <div class="pv-prev-import-row">
          <input id="pv-prev-imp-file" type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.docx,.pdf,image/*,.png,.jpg,.jpeg,.webp" multiple />
          <select id="pv-prev-imp-mode">
            <option value="merge">Unisci alle voci esistenti</option>
            <option value="replace">Sostituisci tutto il budget</option>
          </select>
        </div>
        <label class="pv-prev-muted" for="pv-prev-imp-paste">Incolla tabella</label>
        <textarea id="pv-prev-imp-paste" rows="6" placeholder="tipologia\tcosto\tcosto\tnote\tconfermati&#10;Alloggio\t915\t915\tInclusa tassa\t✓"></textarea>
        <div class="pv-prev-actions">
          <button type="button" class="primary" id="pv-prev-imp-run">Analizza</button>
          <button type="button" class="ghost" data-imp-close>Annulla</button>
        </div>
        <p class="pv-prev-import-status" id="pv-prev-imp-status"></p>
        <div id="pv-prev-imp-preview"></div>
      </div>`;
    if (!document.getElementById("pv-prev-import-css")) {
      const style = document.createElement("style");
      style.id = "pv-prev-import-css";
      style.textContent = `
        #pv-prev-import{position:fixed;inset:0;z-index:130050;display:none;place-items:center;padding:16px;pointer-events:auto}
        #pv-prev-import.open{display:grid}
        #pv-prev-import .pv-prev-import-scrim{position:absolute;inset:0;background:rgba(10,28,34,.45)}
        #pv-prev-import .pv-prev-import-sheet{position:relative;z-index:1;width:min(560px,100%);max-height:min(86vh,760px);overflow:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);color:#123}
        #pv-prev-import header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
        #pv-prev-import h3{margin:0;font-size:1.15rem}
        #pv-prev-import .pv-prev-eyebrow{margin:0;font-size:.72rem;font-weight:700;color:#007d82;text-transform:uppercase;letter-spacing:.04em}
        #pv-prev-import textarea,#pv-prev-import input[type=file],#pv-prev-import select{width:100%;box-sizing:border-box;margin:6px 0 10px;border:1px solid #d5e3e5;border-radius:12px;padding:10px;font:inherit}
        #pv-prev-import .pv-prev-import-row{display:grid;gap:8px}
        #pv-prev-import .pv-prev-import-status{min-height:1.2em;font-size:.86rem;color:#5b7380}
        #pv-prev-import .pv-prev-imp-list{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}
        #pv-prev-import .pv-prev-imp-list li{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start;padding:8px;border:1px solid #e4eeee;border-radius:12px}
        #pv-prev-import .pv-prev-imp-list small{display:block;color:#5b7380}
        #pv-prev-import .pv-prev-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
        #pv-prev-import button.primary{appearance:none;border:0;background:#007d82;color:#fff;border-radius:12px;padding:10px 14px;font:600 14px inherit;cursor:pointer}
        #pv-prev-import button.ghost{appearance:none;border:1px solid #c5d8da;background:#fff;color:#184047;border-radius:12px;padding:10px 14px;font:600 14px inherit;cursor:pointer}
        #pv-prev-import .pv-prev-muted{color:#5b7380;font-size:.9rem}
      `;
      document.head.appendChild(style);
    }
    host.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("[data-imp-close]")) host.classList.remove("open");
    });
    host.querySelector("#pv-prev-imp-run")?.addEventListener("click", () => void runPreventivoImportAnalyze(host));
    document.body.appendChild(host);
    return host;
  }

  async function openPreventivoImportWizard() {
    ensureStyles();
    const auth = tripAuth();
    // Hydrate trip/draft state before showing the wizard so apply writes to the right store.
    if (!state.open || (auth && state.tripId !== auth.id) || (!auth && state.tripId)) {
      await openPreventivo();
    }
    state.section = "budget";
    if (state.open) render();
    const host = ensureImportWizardHost();
    host.classList.add("open");
    const status = host.querySelector("#pv-prev-imp-status");
    const preview = host.querySelector("#pv-prev-imp-preview");
    if (status) status.textContent = "";
    if (preview) preview.innerHTML = "";
    try {
      host.querySelector("#pv-prev-imp-paste")?.focus?.();
    } catch {
      /* ignore */
    }
  }

  async function runPreventivoImportAnalyze(host) {
    const status = host.querySelector("#pv-prev-imp-status");
    const preview = host.querySelector("#pv-prev-imp-preview");
    const fileInput = host.querySelector("#pv-prev-imp-file");
    const paste = host.querySelector("#pv-prev-imp-paste");
    const mode = host.querySelector("#pv-prev-imp-mode")?.value || "merge";
    if (status) status.textContent = "Analisi in corso…";
    if (preview) preview.innerHTML = "";
    try {
      const collected = [];
      const fileErrors = [];
      const files = [...(fileInput?.files || [])];
      for (const f of files) {
        try {
          const rows = await readPreventivoImportFile(f);
          collected.push(...rows);
        } catch (err) {
          fileErrors.push(`${f?.name || "file"}: ${err?.message || "non letto"}`);
        }
      }
      const pasted = String(paste?.value || "").trim();
      if (pasted) collected.push(...parsePreventivoTableText(pasted, { sourceName: "Incolla" }));
      // Deduplicate by title keeping last
      const byTitle = new Map();
      for (const row of collected) byTitle.set(String(row.title || "").toLowerCase(), row);
      const lines = [...byTitle.values()];
      if (!lines.length) {
        throw new Error(
          fileErrors.length
            ? fileErrors.join(" · ")
            : "Nessuna voce riconosciuta. Controlla colonne tipologia/costo/note/confermati."
        );
      }
      if (preview) {
        preview.innerHTML = `
          <p><strong>${lines.length}</strong> voci riconosciute · modalità «${mode === "replace" ? "sostituisci" : "unisci"}»</p>
          <ul class="pv-prev-imp-list">
            ${lines
              .map(
                (l, i) => `<li>
                  <input type="checkbox" data-imp-idx="${i}" checked />
                  <div><strong>${escapeHtml(l.title)}</strong>
                    <small>${escapeHtml(l.status)} · ${fmtMoney(l.unitCents)}${l.source ? ` · ${escapeHtml(l.source)}` : ""}</small>
                  </div>
                </li>`
              )
              .join("")}
          </ul>
          <div class="pv-prev-actions">
            <button type="button" class="primary" id="pv-prev-imp-apply">Importa selezionate</button>
          </div>`;
        preview.querySelector("#pv-prev-imp-apply")?.addEventListener("click", async () => {
          const selected = [...preview.querySelectorAll("input[data-imp-idx]:checked")].map(
            (el) => lines[Number(el.dataset.impIdx)]
          );
          try {
            const n = applyImportedPreventivoLines(selected, { mode });
            host.classList.remove("open");
            state.section = "budget";
            state.status = `Importate ${selected.length} voci nel budget (${n} totali).`;
            render();
            if (state.tripId && tripAuth()) {
              try {
                await syncPreventivoIntoTrip();
                state.status = `Importate ${selected.length} voci e salvate nel viaggio.`;
                render();
              } catch {
                /* local already saved */
              }
            }
          } catch (err) {
            if (status) status.textContent = err?.message || "Import non riuscito";
          }
        });
      }
      if (status) {
        status.textContent = fileErrors.length
          ? `Controlla le voci e conferma l’import. File saltati: ${fileErrors.join(" · ")}`
          : "Controlla le voci e conferma l’import.";
      }
    } catch (err) {
      if (status) status.textContent = err?.message || "Analisi non riuscita";
    }
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
      window.__pvOpenPreventivoSection = async (section) => {
        const want = section ? String(section) : "";
        await openPreventivo();
        if (want) {
          state.section = want;
          render();
        }
      };
      window.__pvOpenPreventivoImport = openPreventivoImportWizard;
      window.__pvParsePreventivoImport = parsePreventivoTableText;
      window.__pvParsePreventivoOcr = parseSpreadsheetOcrText;
      window.__pvReadPreventivoImportFile = readPreventivoImportFile;
      window.__pvApplyPreventivoImport = applyImportedPreventivoLines;
      window.__pvBuildEsimCatalog = buildEsimCatalog;
      window.__pvStripPreventivoNotes = stripPreventivoNotes;
      window.__pvEsimBlockHtml = (destination, start, end, opts) =>
        esimBlockHtml(buildEsimCatalog(destination, start, end), opts);

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
