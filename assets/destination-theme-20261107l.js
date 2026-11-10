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
      teal: "#007d82",
      tealDeep: "#00656a",
      ink: "#12343c",
      muted: "#5a727c",
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
      teal: "#0b6e6a",
      tealDeep: "#085651",
      ink: "#1a3030",
      muted: "#5a706c",
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
      teal: "#1a7f9c",
      tealDeep: "#0f5f78",
      ink: "#0e2a38",
      muted: "#4f6d7a",
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
      teal: "#2c6b6f",
      tealDeep: "#1f5256",
      ink: "#1c2426",
      muted: "#5c6a6c",
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
      teal: "#1d6fa5",
      tealDeep: "#14557f",
      ink: "#123246",
      muted: "#567086",
      sand: "#f3f8fb",
      line: "#c9dae6",
      accent: "#f0ece3",
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
      teal: "#0f7a72",
      tealDeep: "#0b5e58",
      ink: "#1f2e2c",
      muted: "#5d6f6b",
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
      teal: "#2f6f8f",
      tealDeep: "#245872",
      ink: "#1a2c38",
      muted: "#5a6f7c",
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
      teal: "#0d7a6f",
      tealDeep: "#0a5e56",
      ink: "#16332f",
      muted: "#56736e",
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
      teal: "#1b6b7a",
      tealDeep: "#14515c",
      ink: "#0f2830",
      muted: "#4f6870",
      sand: "#eef5f6",
      line: "#c8 recede",
      accent: "#d94f4f",
      wash: "rgba(27,107,122,.12)",
      icons: ICO,
    },
    eg: {
      id: "eg",
      label: "Egitto",
      motif: "pyramid",
      teal: "#1f6f7a",
      tealDeep: "#17555e",
      ink: "#2a2418",
      muted: "#6b6354",
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
      teal: "#1f5f6e",
      tealDeep: "#164853",
      ink: "#1a2430",
      muted: "#5a6874",
      sand: "#f3f1ec",
      line: "#d9d3c7",
      accent: "#b8860b",
      wash: "rgba(31,95,110,.1)",
      icons: ICO,
    },
    gb: {
      id: "gb",
      label: "Regno Unito",
      motif: "mist",
      teal: "#3a6b7a",
      tealDeep: "#2c5360",
      ink: "#1c2a32",
      muted: "#5b6c74",
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
      teal: "#1f6f8f",
      tealDeep: "#175572",
      ink: "#152433",
      muted: "#5a6d7c",
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
      teal: "#1b7a4a",
      tealDeep: "#145c38",
      ink: "#143024",
      muted: "#557365",
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
      teal: "#2f6b5c",
      tealDeep: "#245246",
      ink: "#1a2a26",
      muted: "#5a6e68",
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
      teal: "#1a6f7a",
      tealDeep: "#13555e",
      ink: "#1a2c30",
      muted: "#5a6e72",
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
      teal: "#1a7a8a",
      tealDeep: "#135c69",
      ink: "#123038",
      muted: "#56747c",
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
      teal: "#1f6f6a",
      tealDeep: "#175550",
      ink: "#1a2a28",
      muted: "#5a6e6b",
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
      teal: "#2a6f8f",
      tealDeep: "#205672",
      ink: "#152833",
      muted: "#5a6f7c",
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
      teal: "#1f6f8f",
      tealDeep: "#175572",
      ink: "#132633",
      muted: "#556e7c",
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
      teal: "#1f6b6f",
      tealDeep: "#175255",
      ink: "#1c2426",
      muted: "#5c6a6c",
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
      teal: "#0f6e6a",
      tealDeep: "#0b5451",
      ink: "#1a2c2a",
      muted: "#5a6e6b",
      sand: "#f6f3ea",
      line: "#e2d9c6",
      accent: "#d17a3a",
      wash: "rgba(209,122,58,.1)",
      icons: ICO,
    },
  };

  // Fix typo in no.line
  THEMES.no.line = "#c8dce0";

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

  async function loadTripDestination() {
    const auth = tripAuth();
    if (!auth) return { destination: "", title: "" };
    const local = readLocalTrip(auth.id);
    if (local?.destination) return { destination: local.destination, title: local.title || "" };
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}?key=${encodeURIComponent(auth.key)}`);
      if (!res.ok) return { destination: "", title: "" };
      const data = await res.json();
      return { destination: data?.trip?.destination || "", title: data?.trip?.title || "" };
    } catch {
      return { destination: "", title: "" };
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
        position:fixed; inset:0; z-index:0; pointer-events:none;
        opacity:.5; mix-blend-mode:multiply;
      }
      html[data-pv-theme="dark"] #pv-dest-atmosphere{ opacity:.26; mix-blend-mode:screen; }
      #root{ position:relative; z-index:1; }
      #pv-dest-theme-badge{
        display:inline-flex; align-items:center; gap:6px;
        margin-left:8px; padding:3px 9px; border-radius:999px;
        font:700 .68rem/1 inherit; letter-spacing:.02em;
        color: var(--pv-dest-teal-deep, #00656a);
        background: color-mix(in srgb, var(--pv-dest-wash, rgba(0,125,130,.12)) 85%, #fff);
        border:1px solid color-mix(in srgb, var(--pv-dest-teal, #007d82) 22%, transparent);
        max-width:min(220px, 42vw); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        transition: opacity .25s ease, transform .25s ease;
      }
      #pv-dest-theme-badge[hidden]{ display:none!important; }
      #pv-primary-nav .pv-nav-ico svg{ transition: transform .22s ease, color .22s ease; }
      body.pv-dest-theme-ready #pv-primary-nav .pv-nav-item.is-active .pv-nav-ico{
        background: var(--pv-dest-wash, rgba(0,125,130,.12));
        color: var(--pv-dest-teal, #007d82);
      }
      @media (min-width:768px){
        #pv-dest-theme-badge{
          max-width:min(280px, 36vw); font-size:.72rem; padding:4px 11px;
        }
        #pv-dest-atmosphere{ opacity:.42; }
      }
      @media (min-width:1100px){
        #pv-dest-theme-badge{ max-width:320px; }
        #pv-dest-atmosphere{ opacity:.36; }
        #pv-account-chip .pv-account-chip-main{
          gap:16px;
        }
      }
      @media (prefers-reduced-motion: reduce){
        body.pv-account-ready{ transition:none; }
        #pv-dest-atmosphere{ display:none; }
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
      return;
    }
    badge.hidden = false;
    badge.textContent = `Tema · ${theme.label}`;
    badge.title = `Grafica adattata a ${theme.label}`;
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
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      const dead = document.getElementById(CANVAS_ID);
      if (dead) dead.remove();
      return;
    }
    const canvas = ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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

    if (theme.motif === "aurora") {
      for (let i = 0; i < Math.round(5 * density); i++) {
        const g = ctx.createLinearGradient(0, h * 0.1 * i, w, h * 0.2 * (i + 1));
        g.addColorStop(0, "transparent");
        g.addColorStop(0.4, hexAlpha(teal, 0.07 + i * 0.015));
        g.addColorStop(0.7, hexAlpha(accent, 0.05));
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 40 + i * 28);
        for (let x = 0; x <= w; x += 24) {
          ctx.lineTo(x, 60 + i * 30 + Math.sin(x * 0.01 + i) * 18);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();
      }
    } else if (theme.motif === "waves" || theme.motif === "canal") {
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = hexAlpha(teal, 0.08 + i * 0.02);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const y0 = h * 0.55 + i * 28;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += 16) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 10);
        }
        ctx.stroke();
      }
    } else if (theme.motif === "sakura") {
      const count = Math.round(28 * density);
      for (let i = 0; i < count; i++) {
        const x = (i * 97) % w;
        const y = (i * 53) % (h * 0.7);
        ctx.fillStyle = hexAlpha(accent, 0.1 + (i % 5) * 0.02);
        petal(ctx, x, y, 5 + (i % 4));
      }
    } else if (theme.motif === "sun" || theme.motif === "pyramid") {
      const cx = w * 0.85;
      const cy = h * 0.12;
      const radius = wide ? 220 : w >= 768 ? 180 : 160;
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
      g.addColorStop(0, hexAlpha(accent, 0.22));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      if (theme.motif === "pyramid") {
        ctx.fillStyle = hexAlpha(accent, 0.08);
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.85);
        ctx.lineTo(w * 0.35, h * 0.55);
        ctx.lineTo(w * 0.55, h * 0.85);
        ctx.fill();
      }
    } else if (theme.motif === "lotus" || theme.motif === "leaf") {
      for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = hexAlpha(teal, 0.08);
        ctx.beginPath();
        const x = (w / 10) * i + 20;
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + 30, h * 0.6, x + 10, h * 0.35);
        ctx.stroke();
      }
    } else if (theme.motif === "cypress") {
      for (let i = 0; i < 7; i++) {
        const x = 30 + i * (w / 7);
        ctx.fillStyle = hexAlpha(teal, 0.06);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.35);
        ctx.lineTo(x + 14, h * 0.82);
        ctx.lineTo(x - 14, h * 0.82);
        ctx.fill();
      }
    } else if (theme.motif === "skyline") {
      ctx.fillStyle = hexAlpha(teal, 0.06);
      const bases = [0.55, 0.62, 0.48, 0.7, 0.58, 0.65];
      bases.forEach((bh, i) => {
        const bw = w / bases.length;
        ctx.fillRect(i * bw + 8, h * bh, bw - 16, h * (1 - bh));
      });
    } else {
      // soft globe rings
      ctx.strokeStyle = hexAlpha(teal, 0.07);
      ctx.lineWidth = 1.2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.2, 80 * i, 28 * i, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
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
    };
    window.dispatchEvent(new CustomEvent("pv-dest-theme", { detail: window.__pvDestTheme }));
  }

  async function syncTheme(force = false) {
    ensureStyle();
    const auth = tripAuth();
    if (!auth) {
      if (currentId !== DEFAULT_ID || force) applyTheme(THEMES.default);
      ensureBadge(THEMES.default);
      return THEMES.default;
    }
    const { destination, title } = await loadTripDestination();
    const key = `${auth.id}|${destination}|${title}`;
    if (!force && key === lastDestKey && currentId) return THEMES[currentId] || THEMES.default;
    lastDestKey = key;
    const id = resolveThemeId(destination, title);
    const theme = THEMES[id] || THEMES.default;
    applyTheme(theme);
    return theme;
  }

  function onResize() {
    if (!currentId) return;
    const theme = THEMES[currentId] || THEMES.default;
    cancelAnimationFrame(canvasRaf);
    canvasRaf = requestAnimationFrame(() => drawAtmosphere(theme));
  }

  window.__pvApplyDestTheme = syncTheme;
  window.__pvResolveDestThemeId = resolveThemeId;
  window.__pvDestThemes = THEMES;

  addEventListener("hashchange", () => {
    lastDestKey = "";
    void syncTheme(true);
  });
  addEventListener("resize", onResize);
  addEventListener("pv-trip-loaded", () => {
    lastDestKey = "";
    void syncTheme(true);
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
