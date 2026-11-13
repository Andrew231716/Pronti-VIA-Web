/**
 * Destination theme engine — Pronti? VIA!
 * Auto-applies palette, nav icons and a soft canvas atmosphere from trip.destination.
 * Orthogonal to Hub light/dark (`data-pv-theme`).
 */
(() => {
  const STYLE_ID = "pv-dest-theme-css";
  const CANVAS_ID = "pv-dest-atmosphere";
  const BADGE_ID = "pv-dest-theme-badge";
  const DEFAULT_ID = "default";

  const ICO = {
    home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>`,
    trips: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h9l2 4H7l2-4z"/><path d="M7 8v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`,
    hub: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19"/><path d="M14 14.2c1.5-.7 3.2-.5 4.8.8.6.5 1 1.2 1.2 2"/></svg>`,
    ai: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.2 4.2L17.5 8.5 13.2 9.8 12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z"/><path d="M18.5 14.5 19 16l1.5.5L19 17l-.5 1.5L18 17l-1.5-.5L18 16l.5-1.5z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.2-3.2 3.6-4.7 7-4.7s5.8 1.5 7 4.7"/></svg>`,
  };

  /** Country / region themes — distinctive but on-brand travel feel */
  const THEMES = {
    default: {
      id: "default",
      label: "Pronti? VIA!",
      motif: "globe",
      flag: "🌍",
      stickers: ["✈️", "🧳", "🗺️", "📸", "🧭", "🌴"],
      teal: "#007d82",
      tealDeep: "#00656a",
      ink: "#12343c",
      muted: "#3f5860",
      sand: "#f3f8f8",
      line: "#d5e3e6",
      accent: "#2aa3a8",
      wash: "rgba(0,125,130,.08)",
      icons: ICO,
    },
    it: {
      id: "it",
      label: "Italia",
      motif: "cypress",
      flag: "🇮🇹",
      stickers: ["🍝", "🏛️", "🍋", "🛵", "🍷", "⛵"],
      teal: "#0b6e6a",
      tealDeep: "#085651",
      ink: "#1a3030",
      muted: "#3f5854",
      sand: "#f4f7f4",
      line: "#d3e2dc",
      accent: "#c4a35a",
      wash: "rgba(11,110,106,.1)",
      icons: {
        ...ICO,
        trips: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2.5 3.5 6 7.2 6 11a6 6 0 1 1-12 0c0-3.8 3.5-7.5 6-11z"/><circle cx="12" cy="14" r="2"/></svg>`,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M12 4v3"/></svg>`,
      },
    },
    is: {
      id: "is",
      label: "Islanda",
      motif: "aurora",
      flag: "🇮🇸",
      stickers: ["🌋", "🌌", "🐋", "❄️", "♨️", "🐑"],
      teal: "#1a7f9c",
      tealDeep: "#0f5f78",
      ink: "#0e2a38",
      muted: "#3a5764",
      sand: "#eef6fa",
      line: "#c9dde6",
      accent: "#6bc4b0",
      wash: "rgba(26,127,156,.12)",
      icons: {
        ...ICO,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c2-4 5-7 9-7s7 3 9 7"/><path d="M5 18h14"/><path d="M8 14l2-5 2 3 2-4 2 6"/></svg>`,
        ai: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16c3-6 6-9 8-9s5 3 8 9"/><path d="M12 4v3"/><circle cx="12" cy="9" r="1.2"/></svg>`,
      },
    },
    jp: {
      id: "jp",
      label: "Giappone",
      motif: "sakura",
      flag: "🇯🇵",
      stickers: ["🌸", "⛩️", "🍣", "🗻", "🏯", "🍵"],
      teal: "#2c6b6f",
      tealDeep: "#1f5256",
      ink: "#1c2426",
      muted: "#425054",
      sand: "#f7f4f2",
      line: "#e0d6d2",
      accent: "#c45c5c",
      wash: "rgba(196,92,92,.08)",
      icons: {
        ...ICO,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V11l8-6 8 6v9"/><path d="M9 20v-5h6v5"/><circle cx="12" cy="8" r="2"/></svg>`,
        ai: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>`,
      },
    },
    gr: {
      id: "gr",
      label: "Grecia",
      motif: "waves",
      flag: "🇬🇷",
      stickers: ["🏛️", "🫒", "🌊", "☀️", "🧿", "⛵"],
      teal: "#1d6fa5",
      tealDeep: "#14557f",
      ink: "#123246",
      muted: "#3d5568",
      sand: "#f3f8fb",
      line: "#c9dae6",
      accent: "#d9c9a0",
      wash: "rgba(29,111,165,.12)",
      icons: {
        ...ICO,
        trips: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c2-2 4-3 8-3s6 1 8 3"/><path d="M4 13c2-2 4-3 8-3s6 1 8 3"/><path d="M4 8c2-2 4-3 8-3s6 1 8 3"/></svg>`,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-7h6v7"/><path d="M8 9h8"/></svg>`,
      },
    },
    es: {
      id: "es",
      label: "Spagna",
      motif: "sun",
      flag: "🇪🇸",
      stickers: ["☀️", "💃", "🍊", "🏰", "🍷", "⚽"],
      teal: "#0f7a72",
      tealDeep: "#0b5e58",
      ink: "#1f2e2c",
      muted: "#425550",
      sand: "#f7f5ef",
      line: "#e0dccf",
      accent: "#d4a017",
      wash: "rgba(212,160,23,.1)",
      icons: {
        ...ICO,
        ai: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>`,
      },
    },
    fr: {
      id: "fr",
      label: "Francia",
      motif: "arc",
      flag: "🇫🇷",
      stickers: ["🥐", "🗼", "🧀", "🎨", "🥖", "🍷"],
      teal: "#2f6f8f",
      tealDeep: "#245872",
      ink: "#1a2c38",
      muted: "#405560",
      sand: "#f4f6f8",
      line: "#d0dae2",
      accent: "#c45c5c",
      wash: "rgba(47,111,143,.1)",
      icons: {
        ...ICO,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10l8-6 8 6v10"/><path d="M9 20v-5a3 3 0 0 1 6 0v5"/><path d="M12 4v3"/></svg>`,
      },
    },
    th: {
      id: "th",
      label: "Thailandia",
      motif: "lotus",
      flag: "🇹🇭",
      stickers: ["🛕", "🐘", "🍜", "🏝️", "🪷", "🥭"],
      teal: "#0d7a6f",
      tealDeep: "#0a5e56",
      ink: "#16332f",
      muted: "#3d5853",
      sand: "#f3f8f5",
      line: "#cee3dc",
      accent: "#d4a84b",
      wash: "rgba(13,122,111,.12)",
      icons: {
        ...ICO,
        trips: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 3 5 5 5 9a5 5 0 1 1-10 0c0-4 3-6 5-9z"/><path d="M12 12v9"/><path d="M9 16h6"/></svg>`,
      },
    },
    no: {
      id: "no",
      label: "Norvegia",
      motif: "fjord",
      flag: "🇳🇴",
      stickers: ["🏔️", "🦌", "⛴️", "❄️", "🎣", "🌌"],
      teal: "#1b6b7a",
      tealDeep: "#14515c",
      ink: "#0f2830",
      muted: "#3a545c",
      sand: "#eef5f6",
      line: "#c8dce0",
      accent: "#d94f4f",
      wash: "rgba(27,107,122,.12)",
      icons: ICO,
    },
    eg: {
      id: "eg",
      label: "Egitto",
      motif: "pyramid",
      flag: "🇪🇬",
      stickers: ["🏜️", "🐪", "☀️", "🏺", "🛶", "🧿"],
      teal: "#1f6f7a",
      tealDeep: "#17555e",
      ink: "#2a2418",
      muted: "#554c3c",
      sand: "#f7f2e8",
      line: "#e2d8c4",
      accent: "#c9a227",
      wash: "rgba(201,162,39,.12)",
      icons: {
        ...ICO,
        home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18L12 4z"/><path d="M12 10v6"/><path d="M9 16h6"/></svg>`,
      },
    },
    ma: {
      id: "ma",
      label: "Marocco",
      motif: "tile",
      flag: "🇲🇦",
      stickers: ["🕌", "🍵", "🧭", "🐪", "🌅", "🧿"],
      teal: "#1f5f6e",
      tealDeep: "#164853",
      ink: "#1a2430",
      muted: "#40505c",
      sand: "#f3f1ec",
      line: "#d9d3c7",
      accent: "#b8860b",
      wash: "rgba(31,95,110,.1)",
      icons: ICO,
    },
    gb: {
      id: "gb",
      label: "Regno Unito",
      flag: "🇬🇧",
      stickers: ["☔", "🫖", "🚌", "🏰", "🎸", "🌫️"],
      motif: "mist",
      teal: "#3a6b7a",
      tealDeep: "#2c5360",
      ink: "#1c2a32",
      muted: "#41525a",
      sand: "#f3f5f6",
      line: "#d0d8dc",
      accent: "#c45c5c",
      wash: "rgba(58,107,122,.1)",
      icons: ICO,
    },
    us: {
      id: "us",
      label: "Stati Uniti",
      motif: "skyline",
      flag: "🇺🇸",
      stickers: ["🗽", "🍔", "🎸", "🌵", "🎬", "🌃"],
      teal: "#1f6f8f",
      tealDeep: "#175572",
      ink: "#152433",
      muted: "#405564",
      sand: "#f3f6f9",
      line: "#cfd9e3",
      accent: "#d17a3a",
      wash: "rgba(31,111,143,.1)",
      icons: ICO,
    },
    br: {
      id: "br",
      label: "Brasile",
      motif: "leaf",
      flag: "🇧🇷",
      stickers: ["🌴", "⚽", "🦜", "🏖️", "🍹", "🎉"],
      teal: "#1b7a4a",
      tealDeep: "#145c38",
      ink: "#143024",
      muted: "#3d574c",
      sand: "#f2f8f4",
      line: "#cce0d4",
      accent: "#d4a017",
      wash: "rgba(27,122,74,.12)",
      icons: {
        ...ICO,
        trips: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c4-4 7-8 7-12a7 7 0 1 0-14 0c0 4 3 8 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
      },
    },
    de: {
      id: "de",
      label: "Germania",
      motif: "forest",
      flag: "🇩🇪",
      stickers: ["🥨", "🏰", "🍺", "🌲", "🚂", "🎼"],
      teal: "#2f6b5c",
      tealDeep: "#245246",
      ink: "#1a2a26",
      muted: "#40554f",
      sand: "#f3f6f4",
      line: "#d0ddd6",
      accent: "#c45c5c",
      wash: "rgba(47,107,92,.1)",
      icons: ICO,
    },
    pt: {
      id: "pt",
      label: "Portogallo",
      motif: "tile",
      flag: "🇵🇹",
      stickers: ["🐟", "🚋", "🏖️", "🍷", "🌅", "⛵"],
      teal: "#1a6f7a",
      tealDeep: "#13555e",
      ink: "#1a2c30",
      muted: "#40555a",
      sand: "#f4f7f6",
      line: "#d0dedc",
      accent: "#c45c3a",
      wash: "rgba(26,111,122,.1)",
      icons: ICO,
    },
    hr: {
      id: "hr",
      label: "Croazia",
      motif: "waves",
      flag: "🇭🇷",
      stickers: ["🌊", "🏰", "⛵", "🦞", "☀️", "🪨"],
      teal: "#1a7a8a",
      tealDeep: "#135c69",
      ink: "#123038",
      muted: "#3d5760",
      sand: "#f2f8f9",
      line: "#c9e0e4",
      accent: "#d4a017",
      wash: "rgba(26,122,138,.12)",
      icons: ICO,
    },
    tr: {
      id: "tr",
      label: "Turchia",
      motif: "crescent",
      flag: "🇹🇷",
      stickers: ["🌙", "🫖", "🕌", "🎈", "🧿", "🥙"],
      teal: "#1f6f6a",
      tealDeep: "#175550",
      ink: "#1a2a28",
      muted: "#405550",
      sand: "#f5f3ef",
      line: "#ddd6cb",
      accent: "#c45c5c",
      wash: "rgba(31,111,106,.1)",
      icons: {
        ...ICO,
        ai: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a6 6 0 1 0 0 12 7.5 7.5 0 1 1 0-12z"/><circle cx="17.5" cy="7" r="1"/></svg>`,
      },
    },
    nl: {
      id: "nl",
      label: "Paesi Bassi",
      motif: "canal",
      flag: "🇳🇱",
      stickers: ["🌷", "🚲", "🧀", "🛶", "🌬️", "🎨"],
      teal: "#2a6f8f",
      tealDeep: "#205672",
      ink: "#152833",
      muted: "#405560",
      sand: "#f3f7f9",
      line: "#cfdce4",
      accent: "#d17a3a",
      wash: "rgba(42,111,143,.1)",
      icons: ICO,
    },
    se: {
      id: "se",
      label: "Svezia",
      motif: "aurora",
      flag: "🇸🇪",
      stickers: ["🦌", "🌲", "❄️", "🛶", "🕯️", "🌌"],
      teal: "#1f6f8f",
      tealDeep: "#175572",
      ink: "#132633",
      muted: "#3c5564",
      sand: "#eef5f8",
      line: "#c9dde6",
      accent: "#d4a017",
      wash: "rgba(31,111,143,.12)",
      icons: ICO,
    },
    cn: {
      id: "cn",
      label: "Cina",
      motif: "lantern",
      flag: "🇨🇳",
      stickers: ["🏮", "🐼", "🏯", "🐉", "🍜", "🎋"],
      teal: "#1f6b6f",
      tealDeep: "#175255",
      ink: "#1c2426",
      muted: "#425054",
      sand: "#f6f3f0",
      line: "#e0d6d0",
      accent: "#c45c5c",
      wash: "rgba(196,92,92,.08)",
      icons: ICO,
    },
    in: {
      id: "in",
      label: "India",
      motif: "lotus",
      flag: "🇮🇳",
      stickers: ["🕌", "🪷", "🐘", "🍛", "🕉️", "🎨"],
      teal: "#0f6e6a",
      tealDeep: "#0b5451",
      ink: "#1a2c2a",
      muted: "#405550",
      sand: "#f6f3ea",
      line: "#e2d9c6",
      accent: "#d17a3a",
      wash: "rgba(209,122,58,.1)",
      icons: ICO,
    },
  };

  const RULES = [
    { id: "is", re: /islanda|\bisland\b|iceland|reykjav|akureyr/ },
    { id: "jp", re: /giappone|japan|tokyo|osaka|kyoto|hokkaido/ },
    { id: "gr", re: /grecia|greece|athen|atene|santorini|mykonos|creta|crete/ },
    { id: "es", re: /spain|spagna|madrid|barcellona|barcelona|sevilla|valencia|ibiza|mallorca/ },
    { id: "fr", re: /france|francia|parigi|paris|lyon|marsiglia|nizza|nice|bordeaux/ },
    { id: "th", re: /thailandia|thailand|bangkok|phuket|chiang/ },
    { id: "no", re: /norvegia|norway|oslo|bergen|troms[oø]/ },
    { id: "eg", re: /egitto|egypt|cairo|luxor|sharm|giza|aswan/ },
    { id: "ma", re: /marocco|morocco|marrakech|casablanca|fez|rabat/ },
    { id: "gb", re: /regno unito|\buk\b|inghilterra|scozia|london|londra|edinburgh|manchester|wales|galles/ },
    { id: "us", re: /stati uniti|\busa\b|new york|california|miami|hawaii|los angeles|chicago|boston/ },
    { id: "br", re: /brasile|brazil|rio de janeiro|s[aã]o paulo|salvador|brasilia/ },
    { id: "de", re: /germania|germany|berlin|monaco di baviera|münchen|munich|hamburg|colonia|köln/ },
    { id: "pt", re: /portugal|portogallo|lisbona|lisboa|porto|algarve/ },
    { id: "hr", re: /croazia|croatia|dubrovnik|zagabria|zagreb|split|hvar/ },
    { id: "tr", re: /turchia|turkey|istanbul|ankara|antalya|cappadocia/ },
    { id: "nl", re: /olanda|netherlands|amsterdam|rotterdam|paesi bassi/ },
    { id: "se", re: /svezia|sweden|stockholm|stoccolma|gothenburg/ },
    { id: "cn", re: /cina|china|pechino|beijing|shanghai|hong kong|xi.?an/ },
    { id: "in", re: /india|delhi|mumbai|goa|jaipur|agra|kerala/ },
    { id: "it", re: /italia|italy|rome|roma|milan|milano|firenze|napoli|venezia|torino|bologna|sicilia|sardegna|toscana|amalfi|positano|cinque terre/ },
  ];

  let currentId = null;
  let canvasRaf = 0;
  let lastDestKey = "";

  function tripAuth() {
    try {
      const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const id = p.get("trip");
      const key = p.get("key");
      if (!id || !key) return null;
      return { id, key };
    } catch {
      return null;
    }
  }

  function readLocalTrip(id) {
    try {
      const db = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
      return db?.[id]?.trip || null;
    } catch {
      return null;
    }
  }

  function readTripHints(id) {
    let destination = "";
    let title = "";
    try {
      const meta = JSON.parse(localStorage.getItem(`viavia-trip-card-meta:${id}`) || "null");
      if (meta && typeof meta === "object") {
        destination = String(meta.destination || "").trim();
        title = String(meta.title || "").trim();
      }
    } catch {
      /* ignore */
    }
    try {
      const recent = JSON.parse(localStorage.getItem("viavia-recent-links-v1") || "[]");
      if (Array.isArray(recent)) {
        const hit = recent.find((r) => r && r.id === id);
        if (hit) {
          destination = destination || String(hit.destination || "").trim();
          title = title || String(hit.title || "").trim();
        }
      }
    } catch {
      /* ignore */
    }
    return { destination, title };
  }

  async function loadTripDestination(hintTrip) {
    const auth = tripAuth();
    if (!auth) return { destination: "", title: "" };

    if (hintTrip && typeof hintTrip === "object") {
      const destination = String(hintTrip.destination || "").trim();
      const title = String(hintTrip.title || "").trim();
      if (destination || title) return { destination, title };
    }

    const local = readLocalTrip(auth.id);
    if (local && (local.destination || local.title)) {
      return {
        destination: String(local.destination || "").trim(),
        title: String(local.title || "").trim(),
      };
    }

    const hints = readTripHints(auth.id);
    if (hints.destination || hints.title) return hints;

    try {
      // api-shim / Netlify expect Bearer, not ?key=
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      if (!res.ok) return hints;
      const data = await res.json().catch(() => ({}));
      return {
        destination: String(data?.trip?.destination || hints.destination || "").trim(),
        title: String(data?.trip?.title || hints.title || "").trim(),
      };
    } catch {
      return hints;
    }
  }

  function resolveThemeId(destination, title = "") {
    const q = `${destination} ${title}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (!q.trim()) return DEFAULT_ID;
    for (const rule of RULES) {
      if (rule.re.test(q)) return rule.id;
    }
    // Prefer language helper when available
    try {
      const lang = window.__pvLanguageForDestination?.(destination);
      if (lang?.code === "is") return "is";
      if (lang?.code === "ja") return "jp";
      if (lang?.code === "el") return "gr";
      if (lang?.code === "es") return "es";
      if (lang?.code === "fr") return "fr";
      if (lang?.code === "th") return "th";
      if (lang?.code === "no") return "no";
      if (lang?.code === "ar" && /egitto|egypt|cairo/.test(q)) return "eg";
      if (lang?.code === "ar" && /marocco|morocco/.test(q)) return "ma";
      if (lang?.code === "en" && /uk|londra|london|inghilterra/.test(q)) return "gb";
      if (lang?.code === "en" && /usa|new york|stati uniti/.test(q)) return "us";
      if (lang?.code === "pt" && /brasil|rio|paulo/.test(q)) return "br";
      if (lang?.code === "de") return "de";
      if (lang?.code === "pt") return "pt";
      if (lang?.code === "hr") return "hr";
      if (lang?.code === "tr") return "tr";
      if (lang?.code === "nl") return "nl";
      if (lang?.code === "sv") return "se";
      if (lang?.code === "zh-CN" || lang?.code === "zh") return "cn";
      if (lang?.home) return "it";
    } catch {
      /* ignore */
    }
    return DEFAULT_ID;
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      html[data-pv-dest]{
        --pv-account-teal: var(--pv-dest-teal);
        --pv-account-teal-deep: var(--pv-dest-teal-deep);
        --pv-account-teal-soft: var(--pv-dest-wash);
        --pv-account-ink: var(--pv-dest-ink);
        --pv-account-muted: var(--pv-dest-muted);
        --pv-account-sand: var(--pv-dest-sand);
        --pv-account-line: var(--pv-dest-line);
        --pv-teal: var(--pv-dest-teal);
        --pv-teal-deep: var(--pv-dest-teal-deep);
        --pv-ink: var(--pv-dest-ink);
        --pv-muted: var(--pv-dest-muted);
        --pv-line: var(--pv-dest-line);
        --pv-wash: var(--pv-dest-sand);
        --pv-plat-accent: var(--pv-dest-teal);
      }
      body.pv-account-ready{
        background:
          radial-gradient(900px 420px at 0% -8%, var(--pv-dest-wash, rgba(0,125,130,.07)), transparent 55%),
          radial-gradient(700px 380px at 100% 0%, color-mix(in srgb, var(--pv-dest-accent, #2aa3a8) 18%, transparent), transparent 50%),
          linear-gradient(180deg, var(--pv-dest-sand, #f7fbfb) 0%, #f3f7f8 100%) !important;
        background-attachment: fixed;
        transition: background .45s ease;
      }
      #pv-dest-atmosphere{
        position:fixed; inset:0; z-index:1; pointer-events:none;
        opacity:.78;
        mix-blend-mode: multiply;
      }
      html[data-pv-theme="dark"] #pv-dest-atmosphere{
        opacity:.55;
        mix-blend-mode: screen;
      }
      /* Keep React UI above atmosphere; chrome stays higher via account.css */
      #root{ position:relative; z-index:2; background:transparent; }
      #pv-account-chip,#pv-primary-nav,#pv-ux-modal,#pv-plat-panel,#pv-magic-root{ position:relative; }
      #pv-dest-theme-badge{
        display:inline-flex; align-items:center; gap:6px;
        margin-left:8px; padding:4px 10px; border-radius:999px;
        font:750 .7rem/1 inherit; letter-spacing:.01em;
        color: var(--pv-dest-ink, #12343c);
        background: color-mix(in srgb, var(--pv-dest-wash, rgba(0,125,130,.12)) 70%, #fff);
        border:1px solid color-mix(in srgb, var(--pv-dest-teal, #007d82) 24%, transparent);
        max-width:min(260px, 48vw); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        transition: opacity .25s ease, transform .25s ease;
        box-shadow: 0 2px 10px rgba(16,42,48,.06);
      }
      #pv-dest-theme-badge .pv-dest-flag{ font-size:1rem; line-height:1; }
      .pv-dest-floaters{
        position:fixed; inset:auto 8px calc(96px + env(safe-area-inset-bottom,0px)) auto;
        z-index:2; display:flex; gap:6px; pointer-events:none;
        opacity:.92; filter: drop-shadow(0 4px 10px rgba(16,42,48,.12));
        transition: opacity .2s ease, transform .2s ease;
      }
      .pv-dest-floaters span{
        font-size:1.2rem; line-height:1; padding:6px 7px; border-radius:14px;
        background:rgba(255,255,255,.82); border:1px solid rgba(16,42,48,.08);
        backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
      }
      html[data-pv-theme="dark"] .pv-dest-floaters span{
        background:rgba(20,36,40,.78); border-color:rgba(255,255,255,.08);
      }
      /* Keep floaters clear of floating Hub on tablet/desktop */
      body.pv-plat-open .pv-dest-floaters{ opacity:0; transform:translateY(8px); }
      #pv-dest-theme-badge[hidden]{ display:none!important; }
      #pv-primary-nav .pv-nav-ico svg{ transition: transform .22s ease, color .22s ease; }
      body.pv-dest-theme-ready #pv-primary-nav .pv-nav-item.is-active .pv-nav-ico{
        background: var(--pv-dest-wash, rgba(0,125,130,.12));
        color: var(--pv-dest-teal, #007d82);
      }
      @media (min-width:768px){
        #pv-dest-theme-badge{
          max-width:min(300px, 36vw); font-size:.74rem; padding:5px 12px;
        }
        #pv-dest-atmosphere{ opacity:.72; }
        .pv-dest-floaters{
          top: calc(72px + env(safe-area-inset-top,0px));
          right: max(16px, env(safe-area-inset-right,0px));
          bottom: auto;
          flex-direction: column;
          gap: 8px;
        }
        .pv-dest-floaters span{ font-size:1.45rem; padding:9px 10px; border-radius:16px; }
        body.pv-plat-open .pv-dest-floaters{
          opacity:.55; transform:none;
          right: max(12px, calc((100vw - 680px) / 2 - 56px));
        }
      }
      @media (min-width:1100px){
        #pv-dest-theme-badge{ max-width:340px; }
        #pv-dest-atmosphere{ opacity:.68; }
        #pv-account-chip .pv-account-chip-main{ gap:16px; }
        .pv-dest-floaters{
          top: calc(78px + env(safe-area-inset-top,0px));
          right: max(24px, env(safe-area-inset-right,0px));
          gap: 10px;
        }
        .pv-dest-floaters span{ font-size:1.6rem; padding:10px 11px; border-radius:18px; }
        body.pv-plat-open .pv-dest-floaters{
          opacity:.65;
          right: max(16px, calc((100vw - 820px) / 2 - 64px));
        }
        /* Extra scrapbook rail on the left for wide desktops */
        .pv-dest-floaters-left{
          position:fixed; top:calc(120px + env(safe-area-inset-top,0px));
          left: max(22px, env(safe-area-inset-left,0px));
          z-index:2; display:flex; flex-direction:column; gap:10px; pointer-events:none;
          filter: drop-shadow(0 4px 10px rgba(16,42,48,.1));
        }
        .pv-dest-floaters-left span{
          font-size:1.45rem; line-height:1; padding:9px 10px; border-radius:16px;
          background:rgba(255,255,255,.8); border:1px solid rgba(16,42,48,.08);
          backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        }
        html[data-pv-theme="dark"] .pv-dest-floaters-left span{
          background:rgba(20,36,40,.78); border-color:rgba(255,255,255,.08);
        }
        body.pv-plat-open .pv-dest-floaters-left{ opacity:.5; }
      }
      @media (max-width:1099px){
        .pv-dest-floaters-left{ display:none!important; }
      }
      @media (prefers-reduced-motion: reduce){
        body.pv-account-ready{ transition:none; }
        /* Keep a static atmosphere; hide only animated floaters */
        #pv-dest-atmosphere{ opacity:.55; }
        .pv-dest-floaters, .pv-dest-floaters-left{ display:none!important; }
      }
    `;
  }

  function applyCssVars(theme) {
    const root = document.documentElement;
    root.style.setProperty("--pv-dest-teal", theme.teal);
    root.style.setProperty("--pv-dest-teal-deep", theme.tealDeep);
    root.style.setProperty("--pv-dest-ink", theme.ink);
    root.style.setProperty("--pv-dest-muted", theme.muted);
    root.style.setProperty("--pv-dest-sand", theme.sand);
    root.style.setProperty("--pv-dest-line", theme.line);
    root.style.setProperty("--pv-dest-accent", theme.accent);
    root.style.setProperty("--pv-dest-wash", theme.wash);
    root.dataset.pvDest = theme.id;
    document.body.classList.add("pv-dest-theme-ready");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.teal);
  }

  function applyNavIcons(theme) {
    const map = {
      "pv-nav-home": theme.icons.home,
      "pv-nav-trips": theme.icons.trips,
      "pv-hub-nav": theme.icons.hub,
      "pv-nav-ai": theme.icons.ai,
      "pv-account-menu": theme.icons.profile,
    };
    for (const [id, svg] of Object.entries(map)) {
      const ico = document.querySelector(`#${id} .pv-nav-ico`);
      if (ico && svg) ico.innerHTML = svg;
    }
  }

  function ensureBadge(theme) {
    const hint = document.getElementById("pv-account-chip-hint");
    if (!hint) return;
    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement("span");
      badge.id = BADGE_ID;
      hint.insertAdjacentElement("afterend", badge);
    }
    if (!tripAuth() || theme.id === DEFAULT_ID) {
      badge.hidden = true;
      ensureFloaters(null);
      return;
    }
    badge.hidden = false;
    const flag = theme.flag || "🌍";
    badge.innerHTML = `<span class="pv-dest-flag" aria-hidden="true">${flag}</span> Tema · ${theme.label}`;
    badge.title = `Grafica adattata a ${theme.label}`;
    ensureFloaters(theme);
  }

  function ensureFloaters(theme) {
    let row = document.querySelector(".pv-dest-floaters");
    let left = document.querySelector(".pv-dest-floaters-left");
    if (!theme || theme.id === DEFAULT_ID || !tripAuth()) {
      if (row) row.remove();
      if (left) left.remove();
      return;
    }
    const stickers = theme.stickers || [];
    if (!row) {
      row = document.createElement("div");
      row.className = "pv-dest-floaters";
      row.setAttribute("aria-hidden", "true");
      document.body.appendChild(row);
    }
    const wide = window.matchMedia?.("(min-width: 1100px)")?.matches;
    const tablet = window.matchMedia?.("(min-width: 768px)")?.matches;
    const rightCount = wide ? 4 : tablet ? 3 : 3;
    row.innerHTML = stickers.slice(0, rightCount).map((e) => `<span>${e}</span>`).join("");

    if (wide && stickers.length > 3) {
      if (!left) {
        left = document.createElement("div");
        left.className = "pv-dest-floaters-left";
        left.setAttribute("aria-hidden", "true");
        document.body.appendChild(left);
      }
      left.innerHTML = stickers.slice(rightCount).map((e) => `<span>${e}</span>`).join("");
    } else if (left) {
      left.remove();
    }
  }

  function ensureCanvas() {
    let c = document.getElementById(CANVAS_ID);
    if (!c) {
      c = document.createElement("canvas");
      c.id = CANVAS_ID;
      c.setAttribute("aria-hidden", "true");
      document.body.prepend(c);
    }
    return c;
  }

  function drawAtmosphere(theme) {
    const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const canvas = ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Still draw a static soft layer when motion is reduced (do not remove the canvas).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const accent = theme.accent || theme.teal;
    const teal = theme.teal;
    const wide = w >= 1100;
    const density = wide ? 1.45 : w >= 768 ? 1.2 : 1;

    // Soft photo-like color blobs (less geometric)
    for (let i = 0; i < Math.round(4 * density); i++) {
      const cx = ((i * 173) % w) + (i % 2 ? w * 0.08 : -w * 0.05);
      const cy = h * (0.12 + (i % 4) * 0.18);
      const radius = (wide ? 180 : 130) + i * 28;
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius);
      g.addColorStop(0, hexAlpha(i % 2 ? accent : teal, 0.16));
      g.addColorStop(0.55, hexAlpha(i % 2 ? teal : accent, 0.06));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (theme.motif === "aurora") {
      for (let i = 0; i < Math.round(4 * density); i++) {
        const g = ctx.createLinearGradient(0, h * 0.08 * i, w, h * 0.18 * (i + 1));
        g.addColorStop(0, "transparent");
        g.addColorStop(0.4, hexAlpha(teal, 0.09 + i * 0.015));
        g.addColorStop(0.7, hexAlpha(accent, 0.07));
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 36 + i * 26);
        for (let x = 0; x <= w; x += 24) {
          ctx.lineTo(x, 55 + i * 28 + Math.sin(x * 0.01 + i) * 16);
        }
        ctx.lineTo(w, h * 0.55);
        ctx.lineTo(0, h * 0.55);
        ctx.fill();
      }
    } else if (theme.motif === "waves" || theme.motif === "canal" || theme.motif === "fjord") {
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = hexAlpha(teal, 0.1 + i * 0.02);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const y0 = h * 0.58 + i * 22;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += 14) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 9);
        }
        ctx.stroke();
      }
    } else if (theme.motif === "sakura") {
      const count = Math.round(22 * density);
      for (let i = 0; i < count; i++) {
        const x = (i * 97) % w;
        const y = (i * 53) % (h * 0.72);
        ctx.fillStyle = hexAlpha(accent, 0.14 + (i % 5) * 0.02);
        petal(ctx, x, y, 6 + (i % 4));
      }
    } else if (theme.motif === "sun" || theme.motif === "pyramid") {
      const cx = w * 0.82;
      const cy = h * 0.1;
      const radius = wide ? 240 : w >= 768 ? 190 : 170;
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius);
      g.addColorStop(0, hexAlpha(accent, 0.28));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      if (theme.motif === "pyramid") {
        ctx.fillStyle = hexAlpha(accent, 0.12);
        ctx.beginPath();
        ctx.moveTo(w * 0.12, h * 0.88);
        ctx.lineTo(w * 0.34, h * 0.52);
        ctx.lineTo(w * 0.56, h * 0.88);
        ctx.fill();
      }
    } else if (theme.motif === "lotus" || theme.motif === "leaf" || theme.motif === "forest") {
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = hexAlpha(teal, 0.1);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const x = (w / 11) * i + 16;
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + 28, h * 0.62, x + 8, h * 0.32);
        ctx.stroke();
      }
    } else if (theme.motif === "cypress") {
      for (let i = 0; i < 8; i++) {
        const x = 24 + i * (w / 8);
        ctx.fillStyle = hexAlpha(teal, 0.09);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.32);
        ctx.lineTo(x + 16, h * 0.84);
        ctx.lineTo(x - 16, h * 0.84);
        ctx.fill();
      }
    } else if (theme.motif === "skyline" || theme.motif === "arc") {
      ctx.fillStyle = hexAlpha(teal, 0.08);
      const bases = [0.55, 0.62, 0.48, 0.7, 0.58, 0.65, 0.5];
      bases.forEach((bh, i) => {
        const bw = w / bases.length;
        ctx.fillRect(i * bw + 6, h * bh, bw - 14, h * (1 - bh));
      });
    } else if (theme.motif === "lantern" || theme.motif === "crescent" || theme.motif === "tile") {
      for (let i = 0; i < Math.round(10 * density); i++) {
        const x = ((i * 131) % w) + 10;
        const y = ((i * 79) % (h * 0.55)) + 40;
        ctx.fillStyle = hexAlpha(accent, 0.12);
        ctx.beginPath();
        ctx.arc(x, y, 10 + (i % 4) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = hexAlpha(teal, 0.09);
      ctx.lineWidth = 1.4;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.18, 90 * i, 32 * i, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Figurative sticker layer — emoji scattered like travel scrapbook
    if (!reduced) drawEmojiStickers(ctx, theme, w, h, density);
  }

  function drawEmojiStickers(ctx, theme, w, h, density) {
    const stickers = theme.stickers || [];
    if (!stickers.length) return;
    const count = Math.min(Math.round(14 * density), stickers.length * 4);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < count; i++) {
      const emo = stickers[i % stickers.length];
      // Bias stickers to the side rails so they remain visible beside cards
      const rail = i % 2 === 0;
      const x = rail
        ? 18 + ((i * 37) % Math.max(36, Math.floor(w * 0.18)))
        : w - 18 - ((i * 41) % Math.max(36, Math.floor(w * 0.18)));
      const y = 64 + ((i * 89) % Math.max(80, h * 0.72));
      const size = 26 + (i % 4) * 8;
      ctx.save();
      ctx.globalAlpha = 0.55 + (i % 5) * 0.08;
      ctx.translate(x, y);
      ctx.rotate(((i % 7) - 3) * 0.08);
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(emo, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function petal(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.ellipse(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r, r * 0.45, a, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function hexAlpha(hex, a) {
    const h = String(hex || "#007d82").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full.slice(0, 6), 16);
    if (!Number.isFinite(n)) return `rgba(0,125,130,${a})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function applyTheme(theme) {
    ensureStyle();
    applyCssVars(theme);
    applyNavIcons(theme);
    ensureBadge(theme);
    cancelAnimationFrame(canvasRaf);
    canvasRaf = requestAnimationFrame(() => drawAtmosphere(theme));
    currentId = theme.id;
    window.__pvDestTheme = {
      id: theme.id,
      label: theme.label,
      motif: theme.motif,
      flag: theme.flag || "🌍",
      stickers: theme.stickers || [],
    };
    window.dispatchEvent(new CustomEvent("pv-dest-theme", { detail: window.__pvDestTheme }));
  }

  async function syncTheme(force = false, hintTrip = null) {
    ensureStyle();
    const auth = tripAuth();
    if (!auth) {
      if (currentId !== DEFAULT_ID || force) applyTheme(THEMES.default);
      ensureBadge(THEMES.default);
      ensureFloaters(null);
      return THEMES.default;
    }
    const { destination, title } = await loadTripDestination(hintTrip);
    const key = `${auth.id}|${destination}|${title}`;
    if (!force && key === lastDestKey && currentId) return THEMES[currentId] || THEMES.default;
    lastDestKey = key;
    const id = resolveThemeId(destination, title);
    const theme = THEMES[id] || THEMES.default;
    applyTheme(theme);
    ensureFloaters(theme.id === DEFAULT_ID ? null : theme);
    return theme;
  }

  function onResize() {
    if (!currentId) return;
    const theme = THEMES[currentId] || THEMES.default;
    cancelAnimationFrame(canvasRaf);
    canvasRaf = requestAnimationFrame(() => {
      drawAtmosphere(theme);
      ensureFloaters(theme.id === DEFAULT_ID ? null : theme);
    });
  }

  window.__pvApplyDestTheme = syncTheme;
  window.__pvResolveDestThemeId = resolveThemeId;
  window.__pvDestThemes = THEMES;

  addEventListener("hashchange", () => {
    lastDestKey = "";
    void syncTheme(true);
  });
  addEventListener("resize", onResize);
  addEventListener("pv-trip-loaded", (ev) => {
    lastDestKey = "";
    const trip = ev?.detail?.trip || null;
    void syncTheme(true, trip);
  });

  // Boot + light polling so SPA trip loads are picked up without fighting React.
  setTimeout(() => void syncTheme(true), 400);
  setInterval(() => {
    try {
      void syncTheme(false);
    } catch {
      /* ignore */
    }
  }, 2500);
})();
