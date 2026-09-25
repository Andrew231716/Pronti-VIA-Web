/**
 * Preventivo intelligente — Islanda (modulo integrato in Pronti? VIA!)
 * Estende i viaggi esistenti: crea/aggiorna trip via /api/trips, UI overlay,
 * persistenza in localStorage + sync itinerario/checklist/prenotazioni nel trip.
 * Prezzi: solo STIMA / DA VERIFICARE con link ufficiali — mai inventati come VERIFICATO.
 */
(() => {
  const STYLE_ID = "pv-preventivo-css";
  const ROOT_ID = "pv-preventivo-root";
  const STORE_KEY = "viavia-preventivo-v1";
  const VERSION = "20260920g";

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

  const DEFAULT_PARAMS = {
    title: "Islanda — Avventura invernale 2027",
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

  /** Official / reference links — not scraped prices */
  const OFFICIAL = {
    icelandair: "https://www.icelandair.com/",
    easyjet: "https://www.easyjet.com/",
    wizz: "https://www.wizzair.com/",
    visiticeland: "https://www.visiticeland.com/",
    visitreykjavik: "https://visitreykjavik.is/",
    safetravel: "https://safetravel.is/",
    vedur: "https://en.vedur.is/",
    roads: "https://umferdin.is/",
    googleFlights:
      "https://www.google.com/travel/flights?q=Flights%20to%20KEF%20from%20MXP%20on%202027-02-15%20through%20LIN%20or%20BGY%20returning%202027-02-22%208%20adults",
    bookingReykjavik:
      "https://www.booking.com/searchresults.html?ss=Reykjavik&group_adults=8&no_rooms=2&checkin=2027-02-15&checkout=2027-02-22",
    airbnbReykjavik:
      "https://www.airbnb.com/s/Reykjavik--Iceland/homes?checkin=2027-02-15&checkout=2027-02-22&adults=8",
    blueLagoon: "https://www.bluelagoon.com/",
    skyLagoon: "https://www.skylagoon.com/",
    re: "https://www.re.is/",
    citybus: "https://www.straeto.is/",
  };

  const ITINERARY_SEED = [
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

  const ACTIVITY_CATALOG = [
    {
      id: "aurora",
      title: "Tour aurora boreale",
      org: "Operatori locali (es. Reykjavik Excursions)",
      url: "https://www.re.is/",
      note: "Nessuna garanzia di avvistamento. Dipende da meteo e attività geomagnetica.",
      transport: "Spesso incluso nel tour",
    },
    {
      id: "golden",
      title: "Golden Circle day tour",
      org: "Vari operatori / self-drive",
      url: OFFICIAL.visiticeland,
      note: "Compatibile con febbraio se strade aperte.",
      transport: "Incluso nei tour organizzati",
    },
    {
      id: "south",
      title: "South Coast day tour",
      org: "Vari operatori",
      url: OFFICIAL.visiticeland,
      note: "Reynisfjara: restare lontani dall’acqua.",
      transport: "Incluso nei tour",
    },
    {
      id: "blue",
      title: "Blue Lagoon",
      org: "Blue Lagoon",
      url: OFFICIAL.blueLagoon,
      note: "Prezzi e slot solo dal sito ufficiale.",
      transport: "Transfer opzionale a pagamento",
    },
    {
      id: "sky",
      title: "Sky Lagoon",
      org: "Sky Lagoon",
      url: OFFICIAL.skyLagoon,
      note: "Più vicino a Reykjavík rispetto a Blue Lagoon.",
      transport: "Bus / taxi / auto",
    },
    {
      id: "pools",
      title: "Piscine geotermiche pubbliche",
      org: "Reykjavík / comuni",
      url: OFFICIAL.visitreykjavik,
      note: "Opzione economica rispetto alle lagune premium.",
      transport: "Autobus cittadino",
    },
  ];

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

  function readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
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
    const t = params.travelers;
    return [
      {
        id: "A",
        title: "Un appartamento per 8",
        rooms: 3,
        baths: 2,
        kitchen: true,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Booking / Airbnb — verificare capienza 8 adulti",
        url: OFFICIAL.airbnbReykjavik,
        notes: "Non segnare come disponibile finché non confermi letti/bagni per 8.",
      },
      {
        id: "B",
        title: "Due appartamenti da 4",
        rooms: 4,
        baths: 2,
        kitchen: true,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Due annunci separati",
        url: OFFICIAL.bookingReykjavik,
        notes: "Spesso più economico e più realistico di un unico alloggio grande.",
      },
      {
        id: "C",
        title: "Quattro camere doppie (hotel/guesthouse)",
        rooms: 4,
        baths: 4,
        kitchen: false,
        totalCents: 0,
        status: "DA VERIFICARE",
        source: "Hotel economici / guesthouse — NO ostelli",
        url: OFFICIAL.bookingReykjavik,
        notes: "Escludere dormitori. Preferire private room.",
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
    return params.airportsOut.map((ap) => ({
      id: uid(),
      from: ap,
      to: params.airportIn,
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
      url: OFFICIAL.googleFlights,
      notes: "Non moltiplicare un prezzo single×8 senza conferma disponibilità gruppo.",
    }));
  }

  function defaultSources() {
    return [
      { id: uid(), title: "Icelandair", url: OFFICIAL.icelandair, kind: "voli" },
      { id: uid(), title: "easyJet", url: OFFICIAL.easyjet, kind: "voli" },
      { id: uid(), title: "Wizz Air", url: OFFICIAL.wizz, kind: "voli" },
      { id: uid(), title: "Visit Iceland", url: OFFICIAL.visiticeland, kind: "info" },
      { id: uid(), title: "Visit Reykjavík", url: OFFICIAL.visitreykjavik, kind: "info" },
      { id: uid(), title: "SafeTravel.is", url: OFFICIAL.safetravel, kind: "sicurezza" },
      { id: uid(), title: "Icelandic Met Office", url: OFFICIAL.vedur, kind: "meteo" },
      { id: uid(), title: "Road conditions (umferdin)", url: OFFICIAL.roads, kind: "strade" },
      { id: uid(), title: "Strætó (bus)", url: OFFICIAL.citybus, kind: "trasporti" },
    ];
  }

  function initWorkingState(tripId, saved) {
    state.tripId = tripId;
    state.params = saved?.params ? { ...DEFAULT_PARAMS, ...saved.params, prefs: { ...DEFAULT_PARAMS.prefs, ...(saved.params.prefs || {}) } } : structuredClone(DEFAULT_PARAMS);
    state.scenario = saved?.scenario || "economico";
    state.lines = saved?.lines?.length ? saved.lines : defaultBudgetLines(state.params, state.scenario);
    state.flightNotes = saved?.flightNotes?.length ? saved.flightNotes : defaultFlightRows(state.params);
    state.stayConfigs = saved?.stayConfigs?.length ? saved.stayConfigs : defaultStayConfigs(state.params);
    state.transport = saved?.transport || { strategy: "A", notes: "" };
    state.sources = saved?.sources?.length ? saved.sources : defaultSources();
    state.safety = saved?.safety || { weather: null, fetchedAt: "" };
    state.flightFilters = saved?.flightFilters || { maxPricePp: "", maxStops: "1", airport: "all", bags: "any" };
    state.section = "overview";
  }

  async function createIcelandTrip() {
    const p = state.params;
    const members = Array.from({ length: p.travelers }, (_, i) => ({
      id: uid(),
      name: i === 0 ? accountName() : `Viaggiatore ${i + 1}`,
    }));
    const stops = ITINERARY_SEED.map((s) => ({
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
      { id: uid(), title: "Verificare voli per 8 su sito compagnia (non solo prezzo single)", done: false },
      { id: uid(), title: "Escludere ostelli / dormitori nella ricerca alloggi", done: false },
      { id: uid(), title: "Controllare strade e meteo su umferdin.is / vedur.is prima delle uscite", done: false },
      { id: uid(), title: "Assicurazione viaggio + eventuale auto (Kasko / gomme invernali)", done: false },
      { id: uid(), title: "Aurora: nessuna garanzia — pianificare alternative indoor", done: false },
    ];
    const bookings = [
      {
        id: uid(),
        title: "Voli Milano ↔ KEF (da confermare)",
        type: "Volo",
        date: p.start,
        reference: "",
        notes: "Verificare tariffa gruppo 8 pax su Icelandair / easyJet / Wizz / aggregatori.",
        url: OFFICIAL.googleFlights,
      },
      {
        id: uid(),
        title: "Alloggio Reykjavík area (no ostelli)",
        type: "Alloggio",
        date: p.start,
        reference: "",
        notes: "Confrontare 1 apt / 2 apt / 4 doppie. Cucina preferita.",
        url: OFFICIAL.bookingReykjavik,
      },
    ];
    const notes = [
      "Preventivo intelligente — bozza automatica.",
      "Tutti i prezzi nel modulo partono come STIMA o DA VERIFICARE.",
      `Preferenze: no ostelli; max ${p.prefs.maxStops} scalo; cucina preferita; febbraio winter-safe.`,
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
      notes,
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
      return (s?.user?.displayName || s?.user?.username || "Andrea").trim() || "Viaggiatore";
    } catch {
      return "Viaggiatore";
    }
  }

  async function syncItineraryToTrip() {
    const packed = await loadTripRecord();
    if (!packed) throw new Error("Apri un viaggio per sincronizzare");
    const { auth, data } = packed;
    const trip = { ...data.trip };
    const existingDays = new Set((trip.stops || []).map((s) => s.day + "|" + s.title));
    const add = [];
    for (const seed of ITINERARY_SEED) {
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
    const saved = await saveTripRecord(auth, trip, data.revision);
    state.status = `Itinerario sincronizzato (+${add.length} tappe).`;
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
    const noteLine = `\n\n[Preventivo ${state.scenario} — ${nowIso()}] Spese STIMA aggiunte. Verificare e correggere.`;
    trip.notes = ((trip.notes || "") + noteLine).slice(0, 3000);
    await saveTripRecord(auth, trip, data.revision);
    state.status = `Aggiunte ${newExpenses.length} spese stimate alle Spese di gruppo.`;
  }

  async function fetchWinterSafety() {
    // Climate normals for Reykjavik mid-February — not a forecast months ahead.
    const url =
      "https://climate-api.open-meteo.com/v1/climate?latitude=64.15&longitude=-21.94&start_date=1991-01-01&end_date=2020-12-31&models=EC_Earth3P_HR&daily=temperature_2m_mean";
    try {
      const res = await fetch(url);
      const data = await res.json();
      state.safety = {
        weather: {
          place: "Reykjavík (clima 1991–2020, Open-Meteo)",
          note: "Non è una previsione per il 2027. Usa vedur.is a ridosso del viaggio.",
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
          place: "Reykjavík",
          note: "API clima non raggiungibile. Consulta https://en.vedur.is/ e https://safetravel.is/",
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
      #${ROOT_ID}{position:fixed;inset:0;z-index:100000;display:none;font-family:inherit}
      #${ROOT_ID}.open{display:flex;flex-direction:column;background:#f4fafb}
      body:has(#${ROOT_ID}.open) #pv-account-chip{display:none!important}
      #${ROOT_ID} .pv-prev-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-top h1{margin:0;font-size:1.05rem;font-weight:700}
      #${ROOT_ID} .pv-prev-top button{appearance:none;border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:8px 12px;font:600 13px inherit;cursor:pointer}
      #${ROOT_ID} .pv-prev-tabs{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:10px 12px;background:#e7f2f2;-webkit-overflow-scrolling:touch}
      #${ROOT_ID} .pv-prev-tabs button{flex:0 0 auto;appearance:none;border:1px solid #b7d0d0;background:#fff;color:#184047;border-radius:999px;padding:8px 12px;font:600 12px inherit;cursor:pointer;white-space:nowrap}
      #${ROOT_ID} .pv-prev-tabs button.active{background:#007d82;border-color:#007d82;color:#fff}
      #${ROOT_ID} .pv-prev-body{flex:1 1 auto;overflow:auto;padding:14px;max-width:920px;width:100%;margin:0 auto;box-sizing:border-box}
      #${ROOT_ID} .pv-prev-card{background:#fff;border:1px solid #d9e7e7;border-radius:16px;padding:14px;margin:0 0 12px}
      #${ROOT_ID} .pv-prev-card h2{margin:0 0 8px;font-size:1.05rem;color:#0f2c31}
      #${ROOT_ID} .pv-prev-card p,#${ROOT_ID} .pv-prev-muted{margin:0 0 10px;color:#3d5960;font-size:.9rem;line-height:1.45}
      #${ROOT_ID} .pv-prev-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
      #${ROOT_ID} label.pv-field{display:grid;gap:4px;font-size:.75rem;font-weight:700;color:#5b7076;letter-spacing:.04em;text-transform:uppercase}
      #${ROOT_ID} label.pv-field input,#${ROOT_ID} label.pv-field select,#${ROOT_ID} label.pv-field textarea{font:600 .95rem inherit;text-transform:none;letter-spacing:normal;color:#122f34;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;background:#f7fbfb}
      #${ROOT_ID} .pv-prev-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      #${ROOT_ID} .pv-prev-actions button,.pv-prev-launch{appearance:none;border:0;border-radius:12px;padding:11px 14px;font:600 13px inherit;cursor:pointer;min-height:42px}
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
      .pv-prev-launch{position:fixed;left:14px;bottom:14px;z-index:85;background:#124048;color:#fff;box-shadow:0 10px 28px rgba(0,40,50,.28);display:none}
      body.pv-account-ready .pv-prev-launch{display:inline-flex;align-items:center;gap:8px}
      @media (max-width:640px){
        .pv-prev-launch{left:10px;bottom:72px;padding:10px 12px;font-size:12px}
      }
    `;
    style.dataset.pvReady = VERSION;
  }

  function launchBtn() {
    if (!document.body) return;
    let btn = document.querySelector(".pv-prev-launch");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-prev-launch";
      btn.textContent = "Preventivo intelligente";
      btn.addEventListener("click", () => openPreventivo());
      document.body.appendChild(btn);
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
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) render();
  }

  async function openPreventivo() {
    ensureStyles();
    const auth = tripAuth();
    if (auth) {
      const saved = loadStateForTrip(auth.id) || loadStateForTrip(DRAFT_KEY);
      initWorkingState(auth.id, saved);
      state.status = saved ? "Preventivo caricato dal dispositivo." : "Nuovo preventivo sul viaggio aperto.";
    } else {
      const draft = loadStateForTrip(DRAFT_KEY);
      initWorkingState("", draft);
      state.status = draft
        ? "Bozza locale caricata. Crea il viaggio per collegarla a Pronti? VIA!."
        : "Nessun viaggio aperto: puoi creare «Islanda — Avventura invernale 2027».";
    }
    setOpen(true);
    if (state.section === "itinerary") setTimeout(() => pushMapPoints(), 400);
  }

  function pushMapPoints() {
    const iframe = document.getElementById("pv-prev-map");
    if (!iframe?.contentWindow) return;
    const points = [
      { id: "kef", title: "KEF Aeroporto", day: state.params.start, lat: 63.985, lng: -22.6056, color: "#124048" },
      ...ITINERARY_SEED.map((s, i) => ({
        id: `d${i}`,
        title: s.title,
        day: s.day,
        lat: s.lat,
        lng: s.lng,
      })),
    ];
    iframe.contentWindow.postMessage({ type: "viavia-map", points }, location.origin);
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
          <label class="pv-field">Aeroporti Milano
            <input data-param="airportsOut" value="${escapeAttr(p.airportsOut.join(", "))}" />
          </label>
          <label class="pv-field">Max scali
            <input data-param="maxStops" type="number" min="0" max="2" value="${p.prefs.maxStops}" />
          </label>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="create-trip">Crea viaggio Islanda in Pronti? VIA!</button>
          <button type="button" class="ghost" data-act="save-local">Salva parametri</button>
        </div>
        <p class="pv-prev-muted">Preferenze attive: no ostelli · cucina preferita · febbraio winter-safe · confronto trasporti.</p>
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
    const filtered = state.flightNotes.filter((f) => {
      if (airport !== "all" && f.from !== airport) return false;
      if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice > 0 && (f.perPersonCents || 0) > 0 && f.perPersonCents / 100 > maxPrice)
        return false;
      if (maxStops != null && Number.isFinite(maxStops)) {
        const stopsNum = String(f.stops || "").includes("0") && !String(f.stops).includes("1") ? 0 : Number(String(f.stops).replace(/[^0-9]/g, "") || 99);
        // "0-1" means up to 1 — keep if filter allows
        const declared = String(f.stops || "");
        if (declared.includes("-")) {
          const hi = Number(declared.split("-").pop());
          if (Number.isFinite(hi) && hi > maxStops) return false;
        } else if (Number.isFinite(stopsNum) && stopsNum > maxStops) return false;
      }
      if (bags === "included" && !/inclus|incl|si|sì|yes/i.test(String(f.bags || ""))) return false;
      return true;
    });
    const rows = filtered
      .map(
        (f) => `<tr>
        <td>${escapeHtml(f.from)}→${escapeHtml(f.to)}</td>
        <td>${escapeHtml(f.stops)}</td>
        <td>${escapeHtml(f.bags || "—")}</td>
        <td><input data-flight="${f.id}" data-k="perPersonCents" type="number" step="1" min="0" value="${Math.round((f.perPersonCents || 0) / 100)}" style="width:90px" /> €/pax</td>
        <td><input data-flight="${f.id}" data-k="totalGroupCents" type="number" step="1" min="0" value="${Math.round((f.totalGroupCents || 0) / 100)}" style="width:100px" /> € gruppo</td>
        <td><span class="pv-badge ${f.groupFareConfirmed ? "VERIFICATO" : "WARN"}">${f.groupFareConfirmed ? "gruppo ok" : "gruppo non confermato"}</span></td>
        <td><a href="${escapeAttr(f.url)}" target="_blank" rel="noopener">Apri ricerca</a></td>
      </tr>`
      )
      .join("");
    const airportOpts = ["all", ...state.params.airportsOut]
      .map((a) => `<option value="${escapeAttr(a)}" ${airport === a ? "selected" : ""}>${a === "all" ? "Tutti" : a}</option>`)
      .join("");
    return `
      <div class="pv-prev-card">
        <h2>Voli per ${state.params.travelers} adulti</h2>
        <p>Ricerca A/R ${escapeHtml(state.params.start)} → ${escapeHtml(state.params.end)}. Non moltiplicare un prezzo single × 8 senza conferma disponibilità.</p>
        <p class="pv-callout">Fonti consigliate: <a href="${OFFICIAL.icelandair}" target="_blank" rel="noopener">Icelandair</a>,
        <a href="${OFFICIAL.easyjet}" target="_blank" rel="noopener">easyJet</a>,
        <a href="${OFFICIAL.wizz}" target="_blank" rel="noopener">Wizz Air</a>,
        <a href="${OFFICIAL.googleFlights}" target="_blank" rel="noopener">Google Flights (8 adulti)</a>.</p>
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
              <option value="included" ${bags === "included" ? "selected" : ""}>Inclusi (testo)</option>
            </select>
          </label>
        </div>
        <div style="overflow:auto;margin-top:10px">
          <table>
            <thead><tr><th>Rotta</th><th>Scali</th><th>Bagagli</th><th>Rif. /pax</th><th>Totale gruppo</th><th>Stato</th><th>Link</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7">Nessuna riga con i filtri attuali. Inserisci prezzi dopo verifica sulle compagnie.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="save-local">Salva voli</button>
        </div>
        <p class="pv-prev-muted">Se il totale per 8 non è confermato, lascia «gruppo non confermato» e usa il link compagnia. Il prezzo individuale è solo riferimento.</p>
      </div>`;
  }

  function staysHtml() {
    const cards = state.stayConfigs
      .map(
        (s) => `<div class="pv-prev-card">
        <h2>${escapeHtml(s.title)} <span class="pv-badge ${escapeAttr(s.status)}">${escapeHtml(s.status)}</span></h2>
        <div class="pv-prev-grid">
          <label class="pv-field">Totale 7 notti (€)<input data-stay="${s.id}" data-k="totalEuros" type="number" min="0" step="1" value="${Math.round((s.totalCents || 0) / 100)}" /></label>
          <label class="pv-field">Camere<input data-stay="${s.id}" data-k="rooms" type="number" min="0" value="${s.rooms || 0}" /></label>
          <label class="pv-field">Bagni<input data-stay="${s.id}" data-k="baths" type="number" min="0" value="${s.baths || 0}" /></label>
          <label class="pv-field">Cucina
            <select data-stay="${s.id}" data-k="kitchen"><option value="1" ${s.kitchen ? "selected" : ""}>Sì</option><option value="0" ${!s.kitchen ? "selected" : ""}>No</option></select>
          </label>
        </div>
        <p class="pv-prev-muted">${escapeHtml(s.notes || "")}</p>
        <p>${s.url ? `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">Apri ricerca</a>` : "Aggiungi URL fonte"} · Per persona: <strong>${fmtMoney(state.params.travelers ? Math.round((s.totalCents || 0) / state.params.travelers) : 0)}</strong></p>
      </div>`
      )
      .join("");
    return `
      <div class="pv-prev-card">
        <h2>Alloggi — niente ostelli</h2>
        <p>Confronta A/B/C/D. Non segnare disponibile finché non hai verificato capienza reale per 8 adulti.</p>
      </div>
      ${cards}
      <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva alloggi</button></div>`;
  }

  function transportHtml() {
    const strat = state.transport.strategy || "A";
    return `
      <div class="pv-prev-card">
        <h2>Trasporti — 3 strategie</h2>
        <label class="pv-field">Strategia attiva
          <select data-transport="strategy">
            <option value="A" ${strat === "A" ? "selected" : ""}>A — Nessuna auto (bus + tour)</option>
            <option value="B" ${strat === "B" ? "selected" : ""}>B — Due auto economiche</option>
            <option value="C" ${strat === "C" ? "selected" : ""}>C — Un veicolo capiente (da verificare bagagli)</option>
          </select>
        </label>
        <div class="pv-callout">
          <strong>A:</strong> Flybus/taxi + Strætó + tour con transfer. Evita doppi conteggi.<br/>
          <strong>B:</strong> 2 auto: noleggio, Kasko, gomme invernali, carburante, parcheggi, depositi.<br/>
          <strong>C:</strong> Un 8/9 posti non implica bagagli comodi per 8 — verifica capacità reale.
        </div>
        <label class="pv-field">Note / preventivi inseriti
          <textarea data-transport="notes" rows="5">${escapeHtml(state.transport.notes || "")}</textarea>
        </label>
        <p><a href="${OFFICIAL.citybus}" target="_blank" rel="noopener">Strætó</a> ·
        <a href="${OFFICIAL.re}" target="_blank" rel="noopener">Reykjavik Excursions / Flybus</a> ·
        <a href="${OFFICIAL.roads}" target="_blank" rel="noopener">Condizioni stradali</a></p>
        <div class="pv-prev-actions"><button type="button" class="primary" data-act="save-local">Salva trasporti</button></div>
      </div>`;
  }

  function itineraryHtml() {
    const days = ITINERARY_SEED.map(
      (d) => `<tr><td>${escapeHtml(d.day)}</td><td><strong>${escapeHtml(d.title)}</strong><br/><span class="pv-prev-muted">${escapeHtml(d.notes)}</span></td><td>${escapeHtml(d.address)}</td></tr>`
    ).join("");
    const mapSrc = (() => {
      try {
        return new URL("map.html", location.href).pathname;
      } catch {
        return "/map.html";
      }
    })();
    return `
      <div class="pv-prev-card">
        <h2>Itinerario 15–22 feb (realistico)</h2>
        <p>Base Reykjavík. Giornate flessibili per maltempo. Non massimizzare le attrazioni a scapito della sicurezza.</p>
        <div style="overflow:auto"><table><thead><tr><th>Data</th><th>Programma</th><th>Luogo</th></tr></thead><tbody>${days}</tbody></table></div>
        <div class="pv-prev-card" style="padding:0;overflow:hidden;margin-top:12px">
          <iframe id="pv-prev-map" title="Mappa itinerario Islanda" src="${escapeAttr(mapSrc)}" style="width:100%;height:280px;border:0;display:block"></iframe>
        </div>
        <div class="pv-prev-actions">
          <button type="button" class="primary" data-act="sync-itinerary">Scrivi tappe nel viaggio</button>
          <button type="button" class="ghost" data-act="push-map">Aggiorna mappa</button>
          <button type="button" class="ghost" data-act="save-local">Salva</button>
        </div>
      </div>`;
  }

  function activitiesHtml() {
    const cards = ACTIVITY_CATALOG.map(
      (a) => `<div class="pv-prev-card">
        <h2>${escapeHtml(a.title)}</h2>
        <p>${escapeHtml(a.note)}</p>
        <p class="pv-prev-muted">Organizzatore: ${escapeHtml(a.org)} · Trasporto: ${escapeHtml(a.transport)}</p>
        <p><span class="pv-badge WARN">DA VERIFICARE</span> prezzo persona / gruppo 8 — solo dal sito ufficiale.</p>
        <p><a href="${escapeAttr(a.url)}" target="_blank" rel="noopener">Fonte ufficiale</a></p>
      </div>`
    ).join("");
    return `<div class="pv-prev-card"><h2>Attività e aurora</h2><p>L’aurora non è garantita. Distingui tour organizzati e osservazione autonoma.</p></div>${cards}`;
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
    return `
      <div class="pv-prev-card">
        <h2>Sicurezza invernale</h2>
        <p class="pv-callout">Febbraio: ghiaccio, vento, strade chiuse, ore di luce limitate. Non pianificare spostamenti rischiosi automaticamente.</p>
        <ul>
          <li><a href="${OFFICIAL.safetravel}" target="_blank" rel="noopener">SafeTravel.is</a></li>
          <li><a href="${OFFICIAL.vedur}" target="_blank" rel="noopener">Vedur.is (meteo)</a></li>
          <li><a href="${OFFICIAL.roads}" target="_blank" rel="noopener">Umferdin.is (strade)</a></li>
        </ul>
        <p>${w ? escapeHtml(w.note) + " " + escapeHtml(w.sample || "") : "Carica indici climatici (non previsione 2027)."}</p>
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
      <div class="pv-prev-top">
        <h1>Preventivo intelligente</h1>
        <button type="button" data-act="close">Chiudi</button>
      </div>
      <div class="pv-prev-tabs">${tabs}</div>
      <div class="pv-prev-body">${sectionHtml()}<p class="pv-status">${escapeHtml(state.status)}</p></div>
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
        persistState();
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
        persistState();
        state.status = "Salvato su questo dispositivo.";
        render();
        return;
      }
      if (act === "create-trip") {
        state.status = "Creazione viaggio…";
        render();
        await createIcelandTrip();
        state.status = "Viaggio creato. Continua dal preventivo.";
        render();
        return;
      }
      if (act === "sync-itinerary") {
        await syncItineraryToTrip();
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
    const days = ITINERARY_SEED.map((d) => `<li><strong>${escapeHtml(d.day)}</strong> — ${escapeHtml(d.title)}: ${escapeHtml(d.notes)}</li>`).join("");
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
    a.download = "pronti-via-preventivo-islanda.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exportSummary() {
    const tot = budgetTotals();
    const text = [
      state.params.title,
      `${state.params.start} → ${state.params.end} · ${state.params.travelers} adulti`,
      `Scenario ${state.scenario}: ${fmtMoney(tot.group)} gruppo / ${fmtMoney(tot.pp)} a persona`,
      "Stati: molti valori STIMA/DA VERIFICARE",
      "Fonti: icelandair.com, easyjet.com, wizzair.com, visiticeland.com, safetravel.is, vedur.is, umferdin.is",
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
