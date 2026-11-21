/**
 * Pronti? VIA! — platform hub (dashboard, polls, stats, backup, theme, reminders).
 * Sidecar: does not replace React SPA; stores additive data under trip.meta + localStorage.
 * Hub, itinerary day view and account-scoped backup export.
 */
(() => {
  const VER = "20261112g";
  const STYLE_ID = "pv-platform-css";
  const THEME_KEY = "viavia-theme-v1";
  const THEME_CYCLE = ["system", "light", "dark"];
  const OUTBOX_KEY = "viavia-platform-outbox-v1";
  const REMINDERS_LOCAL = "viavia-reminders-local-v1";
  const ARCHIVE_KEY = "viavia-archive-index-v1";
  const FX_CACHE_KEY = "viavia-fx-cache-v1";

  const ROLE_PERMS = {
    owner: ["edit", "invite", "roles", "delete", "expenses", "stops", "docs", "polls", "checklist", "polls-vote"],
    admin: ["edit", "invite", "expenses", "stops", "docs", "polls", "checklist", "polls-vote"],
    member: ["edit", "expenses", "stops", "polls", "checklist", "polls-vote"],
    readonly: ["docs-read", "polls-vote"],
  };
  function normalizeRole(role) {
    const r = String(role || "").toLowerCase();
    if (r === "proprietario") return "owner";
    if (r === "amministratore") return "admin";
    if (r === "collaboratore") return "member";
    if (r === "visualizzatore" || r === "viewer") return "readonly";
    if (ROLE_PERMS[r]) return r;
    return "member";
  }
  function canRole(role, permission) {
    const list = ROLE_PERMS[normalizeRole(role)] || [];
    return list.includes(permission) || (permission === "polls-vote" && list.includes("polls"));
  }
  function currentIdentity() {
    try {
      const s = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
      return s?.user?.displayName || s?.user?.username || "";
    } catch {
      return "";
    }
  }
  function memberIdForTrip(trip) {
    const idn = currentIdentity().trim().toLowerCase();
    if (!idn) return "";
    for (const m of trip?.members || []) {
      if (String(m?.name || "").trim().toLowerCase() === idn) return m.id || "";
      if (String(m?.username || "").trim().toLowerCase() === idn) return m.id || "";
    }
    return "";
  }
  function roleForTrip(trip) {
    const mid = memberIdForTrip(trip);
    const roles = trip?.meta?.roles || {};
    if (mid && roles[mid]) return normalizeRole(roles[mid]);
    if ((trip?.members || [])[0]?.id && mid === trip.members[0].id) return "owner";
    if (mid) return "member";
    return "member"; // edit-key holder without member match: legacy collaborator
  }

  /* ---------- tiny utils (mirrors lib/* for browser IIFE) ---------- */
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota */
    }
  }
  function tripAuth() {
    try {
      const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const id = p.get("trip");
      const key = p.get("key");
      return id && key ? { id, key } : null;
    } catch {
      return null;
    }
  }
  function euro(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
      (Number(cents) || 0) / 100
    );
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const t = new Date(dateStr + "T12:00:00");
    if (Number.isNaN(+t)) return null;
    return Math.ceil((t - new Date()) / 86400000);
  }
  function daysBetween(a, b) {
    if (!a || !b) return 0;
    const x = new Date(a);
    const y = new Date(b);
    if (Number.isNaN(+x) || Number.isNaN(+y)) return 0;
    return Math.max(0, Math.round((y - x) / 86400000) + 1);
  }
  function expenseAmountCents(expense) {
    if (Number.isFinite(expense.amountCents)) return Math.trunc(expense.amountCents);
    return Number.isFinite(expense.amount) ? Math.round(expense.amount) : 0;
  }
  function expenseCents(expenses) {
    return (expenses || []).reduce((sum, expense) => sum + expenseAmountCents(expense), 0);
  }
  function splitEqualCents(total, n) {
    const count = Math.max(0, Math.floor(n));
    const t = Math.trunc(total);
    if (!count) return [];
    const base = Math.trunc(t / count);
    const rem = t - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
  }
  function haversineKm(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function stopCoords(s) {
    const lat = Number(s.lat ?? s.latitude ?? s.coords?.lat);
    const lng = Number(s.lng ?? s.lon ?? s.longitude ?? s.coords?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  function optimizeStops(stops) {
    const byDay = new Map();
    for (const s of stops || []) {
      const day = String(s.day ?? s.date ?? "0");
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(s);
    }
    const out = [];
    const report = [];
    for (const [day, group] of byDay) {
      const movable = group.filter((s) => stopCoords(s));
      const rest = group.filter((s) => !stopCoords(s));
      const ordered = [];
      if (movable.length) {
        let cur = movable[0];
        const left = new Set(movable.slice(1));
        ordered.push(cur);
        while (left.size) {
          let best = null;
          let bestD = Infinity;
          for (const s of left) {
            const d = haversineKm(stopCoords(cur), stopCoords(s));
            if (d < bestD) {
              bestD = d;
              best = s;
            }
          }
          left.delete(best);
          ordered.push(best);
          cur = best;
        }
      }
      const dayOrdered = [...ordered, ...rest];
      let dist = 0;
      for (let i = 1; i < dayOrdered.length; i++) {
        const a = stopCoords(dayOrdered[i - 1]);
        const b = stopCoords(dayOrdered[i]);
        if (a && b) dist += haversineKm(a, b);
      }
      report.push({ day, distanceKm: Math.round(dist * 10) / 10 });
      out.push(...dayOrdered);
    }
    return { stops: out, report };
  }
  function createPoll(title, options) {
    const opts = (options?.length ? options : [title]).map((label, i) => ({
      id: `opt-${i}-${Math.random().toString(36).slice(2, 6)}`,
      label: String(label).slice(0, 120),
      votes: [],
    }));
    return {
      id: `poll-${Date.now().toString(36)}`,
      title: String(title).slice(0, 120),
      description: "",
      options: opts,
      status: "open",
      createdAt: new Date().toISOString(),
      winnerId: null,
    };
  }
  function buildIcs(trip) {
    const pad = (n) => String(n).padStart(2, "0");
    const toD = (d) => String(d || "").replace(/-/g, "").slice(0, 8);
    const stamp = () => {
      const x = new Date();
      return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
    };
    const esc = (s) =>
      String(s || "")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pronti VIA//IT", "CALSCALE:GREGORIAN"];
    const push = (uid, summary, start, end, desc) => {
      const s = toD(start);
      if (!/^\d{8}$/.test(s)) return;
      let e = toD(end) || s;
      if (e === s) {
        const dt = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + 1));
        e = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
      }
      lines.push(
        "BEGIN:VEVENT",
        `UID:${esc(uid)}`,
        `DTSTAMP:${stamp()}`,
        `DTSTART;VALUE=DATE:${s}`,
        `DTEND;VALUE=DATE:${e}`,
        `SUMMARY:${esc(summary)}`,
        `DESCRIPTION:${esc(desc || "")}`,
        "END:VEVENT"
      );
    };
    push(`start-${trip?.title}@pv`, `Partenza: ${trip?.title || "Viaggio"}`, trip?.start, trip?.start, trip?.destination);
    push(`end-${trip?.title}@pv`, `Ritorno: ${trip?.title || "Viaggio"}`, trip?.end, trip?.end, trip?.destination);
    for (const b of trip?.bookings || []) {
      push(`b-${b.id}@pv`, b.title || b.name || "Prenotazione", b.date || b.checkIn, b.checkOut || b.date, b.notes);
    }
    for (const r of trip?.meta?.reminders || []) {
      push(`r-${r.id}@pv`, r.title || "Promemoria", r.date, r.date, r.notes);
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
  function validateBackup(raw) {
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        return { ok: false, errors: ["JSON non valido"] };
      }
    }
    const errors = [];
    if (data?.kind !== "pronti-via-backup") errors.push("kind non valido");
    const trips = Array.isArray(data?.trips) ? data.trips : [];
    if (!Array.isArray(data?.trips)) errors.push("trips mancante");
    if (Number(data?.schema) > 1) errors.push("schema troppo nuovo");
    return {
      ok: !errors.length,
      errors,
      data,
      summary: {
        tripCount: trips.length,
        exportedAt: data?.exportedAt,
        titles: trips.map((t) => t?.trip?.title || t?.title || "?").slice(0, 8),
      },
    };
  }

  /* ---------- theme ---------- */
  function getThemeMode() {
    const mode = readJson(THEME_KEY, { mode: "system" }).mode || "system";
    return THEME_CYCLE.includes(mode) ? mode : "system";
  }

  function applyTheme(mode) {
    const root = document.documentElement;
    const m = THEME_CYCLE.includes(mode) ? mode : getThemeMode();
    writeJson(THEME_KEY, { mode: m });
    let dark = m === "dark";
    if (m === "system") {
      dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    root.dataset.pvTheme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    // Keep Tailwind `.dark` utilities in sync with Hub theme.
    root.classList.toggle("dark", dark);
    root.dataset.pvThemeMode = m;
    try {
      window.dispatchEvent(new CustomEvent("pv-theme-changed", { detail: { mode: m, dark } }));
    } catch {
      /* ignore */
    }
    const select = document.getElementById("pv-theme");
    if (select && select.value !== m) select.value = m;
  }

  function cycleTheme() {
    const cur = getThemeMode();
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % THEME_CYCLE.length];
    applyTheme(next);
    return next;
  }

  /* ---------- styles ---------- */
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
:root, [data-pv-theme="light"] {
  --pv-plat-bg: #f4f7f8;
  --pv-plat-card: #ffffff;
  --pv-plat-ink: #102f36;
  --pv-plat-muted: #3a545b;
  --pv-plat-accent: #007d82;
  --pv-plat-accent-deep: #00656a;
  --pv-plat-warn: #b45309;
  --pv-plat-ok: #047857;
  --pv-plat-err: #b91c1c;
  --pv-plat-border: rgba(20,52,58,.14);
  --pv-plat-shadow: 0 10px 30px rgba(16,42,48,.08);
  --pv-plat-panel-bg: linear-gradient(180deg, rgba(255,255,255,.88), rgba(236,245,247,.98) 28%, #e8f1f3);
  --pv-plat-panel-edge: rgba(255,255,255,.7);
  --pv-plat-group-track: rgba(16,47,54,.08);
  --pv-plat-group-on-bg: #fff;
  --pv-plat-wash: rgba(0,125,130,.12);
  --pv-plat-glass: rgba(255,255,255,.86);
}
[data-pv-theme="dark"] {
  --pv-plat-bg: #0f1c1f;
  --pv-plat-card: #1a2d32;
  --pv-plat-ink: #eef6f7;
  --pv-plat-muted: #b7c9cd;
  --pv-plat-accent: #2dd4bf;
  --pv-plat-accent-deep: #14b8a6;
  --pv-plat-warn: #fbbf24;
  --pv-plat-ok: #34d399;
  --pv-plat-err: #f87171;
  --pv-plat-border: rgba(231,242,243,.14);
  --pv-plat-shadow: 0 12px 32px rgba(0,0,0,.35);
  --pv-plat-panel-bg: linear-gradient(180deg, rgba(22,40,44,.96), #121f23 40%, #0e191c);
  --pv-plat-panel-edge: rgba(255,255,255,.08);
  --pv-plat-group-track: rgba(231,242,243,.1);
  --pv-plat-group-on-bg: #24383d;
  --pv-plat-wash: rgba(45,212,191,.16);
  --pv-plat-glass: rgba(22,40,44,.88);
}
/* Hub tokens drive the whole shell (nav, chip, UX overlays, body) */
:root, [data-pv-theme="light"], [data-pv-theme="dark"] {
  --pv-ink: var(--pv-plat-ink);
  --pv-muted: var(--pv-plat-muted);
  --pv-teal: var(--pv-plat-accent);
  --pv-teal-deep: var(--pv-plat-accent-deep);
  --pv-surface: var(--pv-plat-card);
  --pv-wash: var(--pv-plat-wash);
  --pv-line: var(--pv-plat-border);
  --pv-shadow: var(--pv-plat-shadow);
  --pv-glass: var(--pv-plat-glass);
  --pv-account-ink: var(--pv-plat-ink);
  --pv-account-muted: var(--pv-plat-muted);
  --pv-account-teal: var(--pv-plat-accent);
  --pv-account-teal-deep: var(--pv-plat-accent-deep);
  --pv-account-teal-soft: var(--pv-plat-wash);
  --pv-account-sand: var(--pv-plat-bg);
  --pv-account-line: var(--pv-plat-border);
}
/* App chrome mirrors Hub panel language */
body.pv-account-ready{
  background: var(--pv-plat-panel-bg) !important;
  background-attachment: fixed !important;
  color: var(--pv-plat-ink);
}
#pv-account-chip{
  background: linear-gradient(180deg, color-mix(in srgb, var(--pv-plat-glass) 92%, transparent), color-mix(in srgb, var(--pv-plat-card) 78%, transparent)) !important;
  border-bottom-color: var(--pv-plat-border) !important;
  color: var(--pv-plat-ink) !important;
  box-shadow: 0 1px 0 var(--pv-plat-panel-edge) inset, 0 8px 22px rgba(16,42,48,.05) !important;
}
#pv-account-chip .pv-account-chip-who{ color: var(--pv-plat-muted) !important; }
#pv-account-chip strong{ color: var(--pv-plat-ink) !important; }
#pv-account-chip .pv-account-chip-hint{ color: var(--pv-plat-accent) !important; }
/* Bottom nav = Hub tab-group language (track + active pill) */
#pv-primary-nav .pv-primary-nav-inner{
  background: var(--pv-plat-group-track) !important;
  border: 1px solid var(--pv-plat-border) !important;
  box-shadow: var(--pv-plat-shadow), 0 1px 0 var(--pv-plat-panel-edge) inset !important;
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  padding: 6px !important;
  gap: 4px !important;
  border-radius: 22px !important;
}
#pv-primary-nav .pv-nav-item{
  color: var(--pv-plat-muted) !important;
  border-radius: 16px !important;
  min-height: 54px !important;
}
#pv-primary-nav .pv-nav-item.is-active,
#pv-primary-nav #pv-hub-nav[aria-expanded="true"],
#pv-primary-nav #pv-nav-ai[aria-expanded="true"]{
  color: var(--pv-plat-accent-deep) !important;
  background: var(--pv-plat-group-on-bg) !important;
  box-shadow: 0 4px 14px rgba(16,42,48,.1);
  font-weight: 800 !important;
}
/* Dark chrome: brand + muted SPA headings must not keep light-theme ink */
html[data-pv-theme="dark"] #root .brand,
html[data-pv-theme="dark"] #root .topbar .brand,
html[data-pv-theme="dark"] #root h1,
html[data-pv-theme="dark"] #root h2,
html[data-pv-theme="dark"] #root .section-heading,
html[data-pv-theme="dark"] #root .workspace{ color: var(--pv-plat-ink) !important; }
html[data-pv-theme="dark"] #root .link-reminder,
html[data-pv-theme="dark"] #root .footer,
html[data-pv-theme="dark"] #root .muted,
html[data-pv-theme="dark"] #root .explore-links span{ color: var(--pv-plat-muted) !important; }
html[data-pv-theme="dark"] #pv-primary-nav .pv-nav-item.is-active{
  color: var(--pv-plat-accent) !important;
}
html[data-pv-theme="dark"] #pv-account-chip{
  background: linear-gradient(180deg, rgba(22,40,44,.94), rgba(15,28,31,.9)) !important;
  border-bottom-color: rgba(231,242,243,.1) !important;
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset !important;
}
/* Active icon = Hub tab fill */
#pv-primary-nav .pv-nav-item.is-active .pv-nav-ico,
#pv-primary-nav #pv-hub-nav[aria-expanded="true"] .pv-nav-ico,
#pv-primary-nav #pv-nav-ai[aria-expanded="true"] .pv-nav-ico,
#pv-primary-nav .pv-nav-hub.is-active .pv-nav-ico,
#pv-primary-nav .pv-nav-ai.is-active .pv-nav-ico{
  background: var(--pv-plat-accent) !important;
  color: #fff !important;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--pv-plat-accent) 32%, transparent);
  transform: translateY(-1px);
}
/* Trip surfaces pick Hub card look */
#root .booking-card,
#root .pv-trip-card,
#root .workspace > section,
#root .day-card,
#root .share-box,
#root .topbar{
  border-color: var(--pv-plat-border) !important;
  box-shadow: var(--pv-plat-shadow) !important;
  background-color: color-mix(in srgb, var(--pv-plat-card) 92%, transparent) !important;
}
#root .main-tabs,
#root [role="tablist"]{
  background: var(--pv-plat-group-track) !important;
  border-radius: 16px !important;
  padding: 4px !important;
  border: 1px solid var(--pv-plat-border) !important;
}
#root .main-tabs [role="tab"][aria-selected="true"],
#root .main-tabs [role="tab"][data-state="active"],
#root [role="tablist"] [role="tab"][aria-selected="true"],
#root [role="tablist"] [role="tab"][data-state="active"]{
  color: var(--pv-plat-accent-deep) !important;
  background: var(--pv-plat-group-on-bg) !important;
  border-radius: 12px !important;
  box-shadow: 0 2px 8px rgba(16,42,48,.08) !important;
}
/* Destination wash strip under chip — very visible cue */
body.pv-dest-theme-ready.pv-account-ready::before{
  content:"";
  position:fixed; left:0; right:0; top:0; height:calc(48px + env(safe-area-inset-top,0px));
  pointer-events:none; z-index:99980;
  background: linear-gradient(180deg, color-mix(in srgb, var(--pv-plat-accent) 22%, transparent), transparent);
}
/*
  Hub lives in the primary bottom nav (#pv-hub-nav). Floating FAB is fallback only
  when the nav is missing (e.g. early boot) — then keep it bottom-left clear of Pronty.
*/
#pv-plat-fab {
  position: fixed; z-index: 120100;
  left: max(12px, env(safe-area-inset-left, 0px));
  right: auto;
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  width: 52px; height: 52px; border-radius: 16px; border: 0;
  background: var(--pv-plat-accent); color: #fff; font: 700 13px/1 system-ui,sans-serif;
  box-shadow: var(--pv-plat-shadow); cursor: pointer;
  transition: opacity .2s ease, transform .16s ease;
}
#pv-plat-fab:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
body.pv-hub-nav-ready #pv-plat-fab {
  display: none !important;
}
body.pv-magic-open #pv-plat-fab,
body.pv-magic-open #pv-hub-nav {
  opacity: 0.55;
}
#pv-plat-panel {
  position: fixed; z-index: 120150; inset: auto 0 0 0;
  max-height: min(90vh, 940px);
  background: var(--pv-plat-panel-bg);
  color: var(--pv-plat-ink);
  border-radius: 28px 28px 0 0;
  box-shadow: 0 -16px 52px rgba(12,40,48,.18);
  border-top: 1px solid var(--pv-plat-panel-edge);
  padding: 16px 14px calc(90px + env(safe-area-inset-bottom));
  overflow: auto; display: none;
  transform: translateY(0); opacity: 1;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
body:not(.pv-primary-nav-ready) #pv-plat-panel {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
#pv-plat-panel.open { display: block; }
#pv-plat-panel.open.pv-plat-entering {
  transform: translateY(18px); opacity: 0;
}
#pv-plat-panel.open.pv-plat-anim {
  transition: transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease;
}
@media (prefers-reduced-motion: reduce) {
  #pv-plat-fab, #pv-plat-panel { transition: none !important; }
  #pv-plat-panel.open.pv-plat-entering { transform: none; opacity: 1; }
}
/* Tablet+: floating centered Hub (not phone bottom-sheet) */
@media (min-width: 768px) {
  #pv-plat-panel {
    top: auto;
    right: auto;
    left: 50%;
    bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    width: min(680px, calc(100vw - 48px));
    max-height: min(80vh, 860px);
    transform: translateX(-50%);
    border-radius: 26px;
    padding: 20px 20px 22px;
    box-shadow: 0 18px 56px rgba(12,40,48,.16);
  }
  #pv-plat-panel.open.pv-plat-entering { transform: translateX(-50%) translateY(18px); }
  #pv-plat-panel .pv-plat-head { gap: 16px; margin-bottom: 16px; padding-bottom: 14px; }
  #pv-plat-panel .pv-plat-kicker { font-size: .76rem; gap: 9px; }
  #pv-plat-panel .pv-plat-kicker .pv-plat-emo { font-size: 1.3rem; }
  #pv-plat-panel .pv-plat-head strong { font-size: 1.38rem; }
  #pv-plat-panel .pv-plat-head .pv-plat-lead { font-size: .92rem; max-width: 46ch; }
  #pv-plat-panel .pv-plat-tab-groups { gap: 6px; padding: 6px; margin-bottom: 14px; border-radius: 18px; }
  #pv-plat-panel .pv-plat-tab-groups button { min-height: 46px; font-size: 14px; border-radius: 14px; }
  #pv-plat-panel .pv-plat-tabs {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }
  #pv-plat-panel .pv-plat-tabs button {
    min-height: 64px; border-radius: 18px; padding: 10px 8px; font-size: 12.5px; gap: 5px;
  }
  #pv-plat-panel .pv-plat-tabs button .pv-plat-tab-emo { font-size: 1.4rem; }
  .pv-plat-hero { gap: 16px; align-items: center; }
  .pv-plat-hero-ico { width: 64px; height: 64px; border-radius: 20px; font-size: 2rem; }
  .pv-plat-sticker-row { gap: 8px; margin: 14px 0 4px; }
  .pv-plat-sticker { padding: 7px 12px; font-size: 13px; }
  .pv-plat-sticker span { font-size: 1.15rem; }
  .pv-plat-card { padding: 18px 18px; border-radius: 22px; }
  .pv-plat-card h3 { font-size: 1.08rem; }
  .pv-plat-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .pv-plat-stat { padding: 12px 14px; border-radius: 14px; }
  .pv-plat-stat b { font-size: 1.15rem; }
  .pv-plat-actions { gap: 8px; margin-top: 12px; }
  #pv-plat-panel .pv-plat-btn { min-height: 44px; padding: 10px 16px; font-size: 13px; border-radius: 14px; }
  .pv-plat-dash-wide {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(180px, .72fr);
    gap: 12px;
    align-items: stretch;
    margin-bottom: 12px;
  }
  .pv-plat-dash-wide > .pv-plat-card { margin-bottom: 0; }
  .pv-plat-side-stickers {
    display: flex; flex-direction: column; gap: 10px;
    padding: 14px; border-radius: 20px;
    background: color-mix(in srgb, var(--pv-plat-accent) 8%, var(--pv-plat-card));
    border: 1px solid var(--pv-plat-border);
  }
  .pv-plat-side-stickers h4 {
    margin: 0; font: 800 .74rem/1.2 system-ui,sans-serif; letter-spacing: .04em;
    text-transform: uppercase; color: var(--pv-plat-accent);
  }
  .pv-plat-side-stickers .pv-plat-sticker-row { margin: 0; }
}
#pv-plat-body { min-height: 120px; transition: opacity .18s ease; }
#pv-plat-body.pv-plat-body-busy { opacity: .7; }
#pv-plat-panel .pv-plat-head {
  display:flex; align-items:flex-start; gap:12px; margin-bottom:14px;
  padding: 2px 2px 12px; border-bottom: 1px solid var(--pv-plat-border);
}
#pv-plat-panel .pv-plat-head > div { flex:1; min-width:0; }
#pv-plat-panel .pv-plat-kicker {
  display:inline-flex; align-items:center; gap:8px; margin:0 0 6px;
  font:700 .72rem/1 system-ui,sans-serif; letter-spacing:.06em; text-transform:uppercase;
  color: var(--pv-plat-accent);
}
#pv-plat-panel .pv-plat-kicker .pv-plat-emo { font-size:1.15rem; letter-spacing:0; text-transform:none; }
#pv-plat-panel .pv-plat-head strong {
  display:block; font:800 1.22rem/1.25 system-ui,sans-serif; color: var(--pv-plat-ink);
  letter-spacing: -0.02em;
}
#pv-plat-panel .pv-plat-head .pv-plat-lead {
  margin:6px 0 0; font:500 0.86rem/1.45 system-ui,sans-serif; color: var(--pv-plat-muted);
}
#pv-plat-panel .pv-plat-tab-groups {
  display:grid; grid-template-columns:1fr 1fr; gap:4px; margin:0 0 12px;
  padding:5px; border-radius:16px; background: var(--pv-plat-group-track);
}
#pv-plat-panel .pv-plat-tab-groups button {
  border:0; background:transparent; color: var(--pv-plat-ink);
  border-radius: 12px; padding: 11px 12px; min-height:42px;
  font: 700 13px/1.2 system-ui,sans-serif; cursor:pointer;
  transition: background .2s ease, color .2s ease, box-shadow .2s ease, transform .16s ease;
}
#pv-plat-panel .pv-plat-tab-groups button:not(.on) { color: var(--pv-plat-muted); font-weight:650; }
#pv-plat-panel .pv-plat-tab-groups button.on {
  background: var(--pv-plat-group-on-bg); color: var(--pv-plat-accent);
  box-shadow: 0 3px 10px rgba(16,42,48,.12);
}
#pv-plat-panel .pv-plat-tabs {
  display:grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap:7px; margin:0 0 14px; padding:2px 0 6px;
}
#pv-plat-panel button:focus-visible { outline: 2px solid var(--pv-plat-accent); outline-offset: 2px; }
#pv-plat-panel .pv-day-map { width:100%; min-height:280px; border:1px solid var(--pv-plat-border); border-radius:14px; }
#pv-plat-panel .pv-plat-tabs button, .pv-plat-btn {
  border:1px solid var(--pv-plat-border); background: var(--pv-plat-card);
  color: var(--pv-plat-ink); border-radius: 16px; padding: 10px 12px;
  font: 650 12px/1.25 system-ui,sans-serif; cursor:pointer; min-height:44px; flex:0 0 auto;
  box-shadow: 0 2px 8px rgba(16,42,48,.05);
  transition: background .2s ease, color .2s ease, border-color .2s ease, transform .16s ease, box-shadow .2s ease;
}
#pv-plat-panel .pv-plat-tabs button { min-height:48px; white-space:normal; width:100%; justify-self:stretch; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; }
#pv-plat-panel .pv-plat-tabs button .pv-plat-tab-emo { font-size:1.15rem; line-height:1; }
#pv-plat-panel .pv-plat-tabs button[hidden] { display:none !important; }
#pv-plat-panel .pv-plat-tabs button.on {
  background: var(--pv-plat-accent); color:#fff; border-color: transparent;
  box-shadow: 0 6px 16px rgba(0,125,130,.22);
}
#pv-plat-panel .pv-plat-tabs button:active, .pv-plat-btn:active { transform: scale(.97); }
.pv-plat-card {
  background: var(--pv-plat-card); border:1px solid var(--pv-plat-border);
  border-radius: 20px; padding: 15px 16px; margin-bottom: 12px;
  box-shadow: 0 8px 22px rgba(16,42,48,.06);
  color: var(--pv-plat-ink);
}
.pv-plat-hero {
  display:flex; align-items:flex-start; gap:12px; text-align:left;
}
.pv-plat-hero-ico {
  flex:0 0 auto; width:52px; height:52px; border-radius:18px;
  display:grid; place-items:center; font-size:1.7rem; line-height:1;
  background: color-mix(in srgb, var(--pv-plat-accent) 14%, var(--pv-plat-card));
  border:1px solid color-mix(in srgb, var(--pv-plat-accent) 22%, transparent);
}
.pv-plat-sticker-row {
  display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 2px;
}
.pv-plat-sticker {
  display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:999px;
  background: color-mix(in srgb, var(--pv-plat-accent) 10%, var(--pv-plat-card));
  border:1px solid var(--pv-plat-border); font:650 12px/1.2 system-ui,sans-serif;
  color: var(--pv-plat-ink);
}
.pv-plat-sticker span { font-size:1rem; }
.pv-plat-side-stickers { display: none; }
.pv-plat-dash-wide { display: block; }
#pv-print-day { display: none; }
.pv-plat-conflict-choice { display: block; padding: 8px 0; }
.pv-plat-conflict-choice span, .pv-plat-conflict-details { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
@media print {
  body:has(> #pv-print-day) > :not(#pv-print-day) { display: none !important; }
  body:has(> #pv-print-day) { background: white !important; }
  body > #pv-print-day { display: block; color: #111; background: white; border: 0; }
  #pv-print-day li { break-inside: avoid; }
}
.pv-plat-card h3 { margin:0 0 6px; font:800 1rem/1.3 system-ui,sans-serif; color: var(--pv-plat-ink); }
.pv-plat-muted { color: var(--pv-plat-muted); font: 500 13px/1.45 system-ui,sans-serif; }
.pv-plat-grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap:8px; }
.pv-plat-stat { padding:10px; border-radius:12px; background: rgba(0,125,130,.08); }
.pv-plat-stat b { display:block; font:700 16px/1.2 system-ui,sans-serif; }
.pv-plat-stat span { font:400 11px/1.3 system-ui,sans-serif; color: var(--pv-plat-muted); }
#pv-plat-status {
  position: fixed; z-index: 120300; left: 50%; transform: translateX(-50%);
  top: calc(8px + env(safe-area-inset-top)); max-width: min(92vw, 420px);
  padding: 8px 12px; border-radius: 999px; font: 600 12px/1.3 system-ui,sans-serif;
  background: var(--pv-plat-card); color: var(--pv-plat-ink); border:1px solid var(--pv-plat-border);
  box-shadow: var(--pv-plat-shadow); display:none;
}
#pv-plat-status.show { display:block; }
#pv-plat-status.server { border-color: var(--pv-plat-ok); }
#pv-plat-status.local { border-color: var(--pv-plat-warn); }
#pv-plat-status.pending { border-color: var(--pv-plat-accent); }
#pv-plat-status.error { border-color: var(--pv-plat-err); }
.pv-plat-list { list-style:none; margin:0; padding:0; }
.pv-plat-list li { padding:8px 0; border-bottom:1px solid var(--pv-plat-border); font:400 13px/1.4 system-ui,sans-serif; }
.pv-plat-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
input.pv-plat-input, select.pv-plat-input, textarea.pv-plat-input {
  width:100%; box-sizing:border-box; margin:4px 0 8px; padding:10px 12px;
  border-radius:10px; border:1px solid var(--pv-plat-border);
  background: var(--pv-plat-card); color: var(--pv-plat-ink); font:400 14px/1.3 system-ui,sans-serif;
}
/* Desktop wide: larger Hub panel, still clear of capsule nav */
@media (min-width: 1100px) {
  #pv-plat-panel {
    width: min(820px, calc(100vw - 72px));
    max-height: min(84vh, 920px);
    bottom: calc(100px + env(safe-area-inset-bottom, 0px));
    padding: 24px 26px 26px;
    border-radius: 28px;
  }
  #pv-plat-fab { bottom: 28px; left: 28px; right: auto; }
  #pv-plat-panel .pv-plat-head strong { font-size: 1.5rem; }
  #pv-plat-panel .pv-plat-head .pv-plat-lead { font-size: .96rem; max-width: 52ch; }
  #pv-plat-panel .pv-plat-tabs button { min-height: 72px; font-size: 13px; }
  #pv-plat-panel .pv-plat-tabs button .pv-plat-tab-emo { font-size: 1.55rem; }
  .pv-plat-hero-ico { width: 72px; height: 72px; border-radius: 22px; font-size: 2.2rem; }
  .pv-plat-dash-wide {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(220px, .85fr);
    gap: 14px;
    align-items: start;
  }
  .pv-plat-dash-wide > .pv-plat-card { margin-bottom: 0; }
  .pv-plat-side-stickers {
    display: flex; flex-direction: column; gap: 10px;
    padding: 16px; border-radius: 22px;
    background: color-mix(in srgb, var(--pv-plat-accent) 8%, var(--pv-plat-card));
    border: 1px solid var(--pv-plat-border);
  }
  .pv-plat-side-stickers h4 {
    margin: 0; font: 800 .78rem/1.2 system-ui,sans-serif; letter-spacing: .04em;
    text-transform: uppercase; color: var(--pv-plat-accent);
  }
  .pv-plat-side-stickers .pv-plat-sticker-row { margin: 0; }
  .pv-plat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 1400px) {
  #pv-plat-panel {
    width: min(900px, calc(100vw - 96px));
    padding: 26px 28px 28px;
  }
  #pv-plat-panel .pv-plat-tabs { gap: 10px; }
  #pv-plat-panel .pv-plat-tabs button { min-height: 76px; }
}
`;
    document.head.appendChild(s);
  }

  /* ---------- save status ---------- */
  function showStatus(text, kind) {
    let el = document.getElementById("pv-plat-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "pv-plat-status";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.className = `show ${kind || ""}`;
    el.textContent = text;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => el.classList.remove("show"), 4200);
  }
  function onSaveEvent(detail) {
    if (!detail) return;
    if (detail.conflict || detail.message?.includes?.("Versione non aggiornata")) {
      showStatus(detail.message || window.__pvSaveMsg?.CONFLICT || "Conflitto di versione", "error");
      return;
    }
    const msg =
      detail.message ||
      (typeof window.__pvSaveToast === "function"
        ? window.__pvSaveToast(detail)
        : detail.local
          ? "Salvato su questo dispositivo. In attesa di sincronizzazione"
          : "Salvato e sincronizzato");
    showStatus(msg, detail.local ? "local" : "server");
  }

  /* ---------- trip fetch/save ---------- */
  async function fetchTrip() {
    const auth = tripAuth();
    if (!auth) return null;
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Viaggio non disponibile");
    return { auth, data, trip: data.trip || {} };
  }
  async function saveTripMeta(mutator, { permission = "edit" } = {}) {
    const { auth, data, trip } = await fetchTrip();
    if (data.canEdit === false) throw new Error("Solo lettura: non puoi modificare.");
    const role = data.personalRole === "editor" ? "member" : roleForTrip(trip);
    if (!canRole(role, permission)) {
      throw new Error(`Operazione non consentita per il ruolo «${role}».`);
    }
    const memberId = memberIdForTrip(trip);
    const next = structuredClone ? structuredClone(trip) : JSON.parse(JSON.stringify(trip));
    next.meta = next.meta && typeof next.meta === "object" ? next.meta : {};
    mutator(next);
    const body = { trip: next, revision: data.revision, actorMemberId: memberId || undefined };
    const run = async () => {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      };
      if (memberId) headers["X-Pronti-Member-Id"] = memberId;
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 409) {
        throw new Error(
          window.__pvSaveMsg?.CONFLICT ||
            "Versione non aggiornata. Ricarica e riprova: le modifiche più recenti non sono state sovrascritte."
        );
      }
      if (!res.ok) throw new Error(out.error || "Salvataggio non riuscito");
      const msg =
        typeof window.__pvSaveToast === "function"
          ? window.__pvSaveToast(out)
          : out.local || out.source === "memory"
            ? "Salvato su questo dispositivo. In attesa di sincronizzazione"
            : "Salvato e sincronizzato";
      showStatus(msg, out.local || out.source === "memory" ? "local" : "server");
      return out;
    };
    return run();
  }

  /* ---------- UI shell ---------- */
  let activeTab = "dash";
  function bindHubTrigger(el) {
    if (!el || el.dataset.pvHubBound === "1") return el;
    el.dataset.pvHubBound = "1";
    el.addEventListener("click", () => togglePanel());
    return el;
  }
  function ensureFab() {
    // Preferred: Hub in the primary bottom nav (integrated navigation).
    const nav = document.getElementById("pv-hub-nav");
    if (nav) {
      document.body.classList.add("pv-hub-nav-ready");
      document.getElementById("pv-plat-fab")?.remove();
      bindHubTrigger(nav);
      return nav;
    }
    document.body.classList.remove("pv-hub-nav-ready");
    let fab = document.getElementById("pv-plat-fab");
    if (fab) return bindHubTrigger(fab);
    fab = document.createElement("button");
    fab.id = "pv-plat-fab";
    fab.type = "button";
    fab.title = "Hub · Collabora";
    fab.setAttribute("aria-label", "Apri Hub collaborativo");
    fab.textContent = "Hub";
    document.body.appendChild(fab);
    return bindHubTrigger(fab);
  }
  let panelRenderSeq = 0;
  function playPanelEnter(panel) {
    if (!panel || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    panel.classList.add("pv-plat-entering", "pv-plat-anim");
    // Double rAF: apply starting pose, then release to resting open pose.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.remove("pv-plat-entering");
        const done = () => {
          panel.classList.remove("pv-plat-anim");
          panel.removeEventListener("transitionend", done);
        };
        panel.addEventListener("transitionend", done);
        setTimeout(done, 280);
      });
    });
  }
  const HUB_GROUPS = {
    collab: {
      label: "🤝 Collabora",
      tabs: [
        ["dash", "Panoramica", "🏠"],
        ["polls", "Votazioni", "🗳️"],
        ["access", "Inviti", "📨"],
        ["prep", "Preparazione", "🧳"],
        ["stats", "Numeri", "📊"],
      ],
    },
    trip: {
      label: "🗺️ Organizza",
      tabs: [
        ["today", "Oggi", "☀️"],
        ["cal", "Calendario", "📅"],
        ["archive", "Ricordi", "📸"],
        ["settings", "Impostazioni", "⚙️"],
      ],
    },
  };
  let activeGroup = "collab";
  function groupForTab(tab) {
    if (HUB_GROUPS.trip.tabs.some(([id]) => id === tab)) return "trip";
    return "collab";
  }
  function ensurePanelChrome(panel) {
    // Recreate if older single-row chrome (pre-grouping).
    if (panel.querySelector("#pv-plat-body") && panel.querySelector(".pv-plat-tab-groups")) return;
    activeGroup = groupForTab(activeTab);
    const allTabs = [...HUB_GROUPS.collab.tabs, ...HUB_GROUPS.trip.tabs];
    panel.innerHTML = `
      <div class="pv-plat-head">
        <div>
          <div class="pv-plat-kicker"><span class="pv-plat-emo" aria-hidden="true">✨</span> Hub di viaggio</div>
          <strong>Collaborazione di gruppo</strong>
          <p class="pv-plat-lead">Voti, cose da preparare, numeri e copie di sicurezza — tutto in un posto.</p>
        </div>
        <button type="button" class="pv-plat-btn" data-plat="close" aria-label="Chiudi Hub">Chiudi</button>
      </div>
      <div class="pv-plat-tab-groups" role="tablist" aria-label="Aree Hub">
        ${Object.entries(HUB_GROUPS)
          .map(
            ([id, g]) =>
              `<button type="button" class="pv-plat-group${id === activeGroup ? " on" : ""}" data-plat-group="${id}">${g.label}</button>`
          )
          .join("")}
      </div>
      <div class="pv-plat-tabs" role="tablist" aria-label="Sezioni Hub">${allTabs
        .map(([id, label, emo]) => {
          const icon = emo ? `<span class="pv-plat-tab-emo" aria-hidden="true">${emo}</span>` : "";
          return `<button type="button" role="tab" data-tab="${id}" data-group="${groupForTab(id)}" hidden>${icon}<span>${label}</span></button>`;
        })
        .join("")}</div>
      <div id="pv-plat-body"></div>
    `;
    panel.querySelector("[data-plat=close]")?.addEventListener("click", () => togglePanel(false));
    panel.querySelectorAll("[data-plat-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = btn.dataset.platGroup;
        if (g === activeGroup) return;
        activeGroup = g;
        const first = HUB_GROUPS[g].tabs[0][0];
        if (!HUB_GROUPS[g].tabs.some(([id]) => id === activeTab)) activeTab = first;
        syncTabButtons(panel);
        void renderPanel({ tabSwitch: true });
      });
    });
    panel.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === activeTab) return;
        activeTab = btn.dataset.tab;
        activeGroup = groupForTab(activeTab);
        void renderPanel({ tabSwitch: true });
      });
    });
  }
  function syncTabButtons(panel) {
    activeGroup = groupForTab(activeTab);
    panel.querySelectorAll("[data-plat-group]").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.platGroup === activeGroup);
    });
    panel.querySelectorAll("[data-tab]").forEach((btn) => {
      const inGroup = btn.dataset.group === activeGroup;
      btn.hidden = !inGroup;
      btn.classList.toggle("on", btn.dataset.tab === activeTab);
    });
  }
  function togglePanel(force) {
    let panel = document.getElementById("pv-plat-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "pv-plat-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Hub Pronti VIA");
      document.body.appendChild(panel);
    }
    const open = force == null ? !panel.classList.contains("open") : force;
    const wasOpen = panel.classList.contains("open");
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pv-plat-open", open);
    for (const id of ["pv-hub-nav", "pv-plat-fab"]) {
      const el = document.getElementById(id);
      if (el) el.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (open && typeof window.__pvSetPrimaryNav === "function") window.__pvSetPrimaryNav("hub");
    if (!open && typeof window.__pvSetPrimaryNav === "function") {
      const lock = window.__pvPrimaryNavLock;
      if (lock?.tab && Date.now() < Number(lock.until || 0)) {
        window.__pvSetPrimaryNav(lock.tab);
      } else {
        window.__pvSetPrimaryNav(document.body.classList.contains("pv-trip-open") ? "trips" : "home");
      }
    }
    if (open) {
      if (!wasOpen) playPanelEnter(panel);
      void renderPanel({ tabSwitch: wasOpen });
    } else {
      panel.classList.remove("pv-plat-entering", "pv-plat-anim");
    }
  }
  async function renderTabHtml(tab) {
    if (tab === "dash") return renderDash();
    if (tab === "polls") return renderPolls();
    if (tab === "prep") return renderPrep();
    if (tab === "stats") return renderStats();
    if (tab === "today") return renderToday();
    if (tab === "access") return renderAccess();
    if (tab === "cal") return renderCal();
    if (tab === "archive") return renderArchive();
    if (tab === "backup") return renderBackup();
    return renderSettings();
  }
  async function renderPanel({ tabSwitch = false } = {}) {
    const panel = document.getElementById("pv-plat-panel");
    if (!panel) return;
    ensurePanelChrome(panel);
    syncTabButtons(panel);
    const body = panel.querySelector("#pv-plat-body");
    if (!body) return;
    const seq = ++panelRenderSeq;
    const prevH = body.getBoundingClientRect().height;
    if (tabSwitch && prevH > 80) body.style.minHeight = `${Math.round(prevH)}px`;
    body.classList.add("pv-plat-body-busy");
    try {
      const html = await renderTabHtml(activeTab);
      if (seq !== panelRenderSeq) return; // newer tab click won
      body.innerHTML = html;
      wireBody(body);
    } catch (err) {
      if (seq !== panelRenderSeq) return;
      body.innerHTML = `<div class="pv-plat-card"><p class="pv-plat-muted">${escapeHtml(
        err.message || "Errore"
      )}</p><button type="button" class="pv-plat-btn" data-plat="retry-panel">Riprova</button></div>`;
      wireBody(body);
    } finally {
      if (seq === panelRenderSeq) {
        body.classList.remove("pv-plat-body-busy");
        // Release height lock after paint so the next tab can size naturally.
        requestAnimationFrame(() => {
          if (seq === panelRenderSeq) body.style.minHeight = "";
        });
      }
    }
  }

  async function renderDash() {
    const auth = tripAuth();
    if (!auth) {
      const recent = readJson("viavia-recent-links-v1", []);
      const upcoming = [];
      for (const r of recent.slice(0, 8)) {
        const meta = readJson(`viavia-trip-card-meta:${r.id}`, null);
        upcoming.push({ ...r, meta });
      }
      if (!upcoming.length) {
        return `<div class="pv-plat-card">
          <div class="pv-plat-hero">
            <div class="pv-plat-hero-ico" aria-hidden="true">👋</div>
            <div>
              <h3>Benvenuto</h3>
              <p class="pv-plat-muted">Non hai ancora viaggi. Crea il primo dalla home: destinazione, date e compagni.</p>
            </div>
          </div>
          <div class="pv-plat-sticker-row" aria-hidden="true">
            <span class="pv-plat-sticker"><span>✈️</span> destinazione</span>
            <span class="pv-plat-sticker"><span>📅</span> date</span>
            <span class="pv-plat-sticker"><span>🧑‍🤝‍🧑</span> compagni</span>
          </div>
          <div class="pv-plat-actions">
            <button type="button" class="pv-plat-btn" data-plat="goto-new">✨ Crea viaggio</button>
          </div>
        </div>`;
      }
      return `<div class="pv-plat-card"><div class="pv-plat-hero"><div class="pv-plat-hero-ico" aria-hidden="true">🧳</div><div><h3>I tuoi viaggi</h3></div></div>
        <ul class="pv-plat-list">${upcoming
          .map((r) => {
            const d = daysUntil(r.meta?.start);
            return `<li><strong>${escapeHtml(r.title || "Viaggio")}</strong>
              <div class="pv-plat-muted">${escapeHtml(r.meta?.start || "?")} → ${escapeHtml(
              r.meta?.end || "?"
            )}${d != null ? ` · ${d >= 0 ? `tra ${d} giorni` : "concluso"}` : ""}</div>
              <a class="pv-plat-btn" style="display:inline-block;margin-top:6px;text-decoration:none"
                 href="#trip=${encodeURIComponent(r.id)}&key=${encodeURIComponent(r.key)}">Apri</a></li>`;
          })
          .join("")}</ul></div>`;
    }
    const { trip } = await fetchTrip();
    const spent = expenseCents(trip.expenses);
    const budget = Math.round((Number(trip.budget) || 0) * (Math.abs(Number(trip.budget) || 0) >= 100 && Number.isInteger(Number(trip.budget)) ? 1 : 100));
    const dLeft = daysUntil(trip.start);
    const duration = daysBetween(trip.start, trip.end);
    const members = trip.members || [];
    const checks = trip.checklist || [];
    const openChecks = checks.filter((c) => !c.done && !c.checked).length;
    const bookings = trip.bookings || [];
    const polls = trip.meta?.polls || [];
    const openPolls = polls.filter((p) => p.status === "open").length;
    const prep = trip.meta?.preparation || {};
    const todos = [];
    if (openChecks) {
      todos.push(
        openChecks === 1 ? "1 voce checklist aperta" : `${openChecks} voci checklist aperte`
      );
    }
    if (!bookings.length) todos.push("Nessuna prenotazione registrata");
    if (openPolls) todos.push(`${openPolls} votazioni aperte`);
    if (!(prep.departureChecklist || []).some((x) => x.done)) todos.push("Checklist partenza da completare");
    const destTheme = window.__pvDestTheme || {};
    const allStickers = Array.isArray(destTheme.stickers) ? destTheme.stickers : [];
    const destStickers = allStickers.slice(0, 6);
    const destFlag = destTheme.flag || "✈️";
    const destLabel = destTheme.label && destTheme.id !== "default" ? destTheme.label : "";
    const stickerHtml = destStickers.length
      ? `<div class="pv-plat-sticker-row" aria-hidden="true">${destStickers
          .map((e) => `<span class="pv-plat-sticker"><span>${e}</span></span>`)
          .join("")}</div>`
      : "";
    const mainCard = `
      <div class="pv-plat-card">
        <div class="pv-plat-hero">
          <div class="pv-plat-hero-ico" aria-hidden="true">${destFlag}</div>
          <div>
            <h3>${escapeHtml(trip.title || "Viaggio")}</h3>
            <p class="pv-plat-muted">${escapeHtml(trip.destination || "Destinazione da definire")}${
              destLabel ? ` · tema ${escapeHtml(destLabel)}` : ""
            }</p>
          </div>
        </div>
        ${stickerHtml}
        <div class="pv-plat-grid" style="margin-top:10px">
          <div class="pv-plat-stat"><b>${
            dLeft == null ? "—" : dLeft > 0 ? `tra ${dLeft} gg` : dLeft === 0 ? "oggi" : "concluso"
          }</b><span>Partenza</span></div>
          <div class="pv-plat-stat"><b>${duration || "—"}</b><span>Giorni</span></div>
          <div class="pv-plat-stat"><b>${members.length || 1}</b><span>In gruppo</span></div>
          <div class="pv-plat-stat"><b>${euro(spent)}</b><span>Spese</span></div>
        </div>
        <p class="pv-plat-muted" style="margin-top:8px">Budget ${euro(budget)} · resta ${euro(Math.max(0, budget - spent))}</p>
      </div>`;
    const nextCard = `
      <div class="pv-plat-card">
        <h3>🧭 Prossimi passi</h3>
        <ul class="pv-plat-list">${(todos.length ? todos : ["Niente di urgente — puoi esplorare le sezioni qui sotto."])
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("")}</ul>
        <div class="pv-plat-actions">
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="today">☀️ Oggi</button>
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="prep">🧳 Preparazione</button>
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="polls">🗳️ Votazioni</button>
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="access">Inviti</button>
          <button type="button" class="pv-plat-btn" data-trip-notifications>Notifiche</button>
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="settings">Sincronizzazione</button>
          <a class="pv-plat-btn" style="text-decoration:none" href="./map.html" target="_blank" rel="noopener">🗺️ Mappa</a>
          <button type="button" class="pv-plat-btn" data-plat="optimize" title="Riordina le tappe per ridurre i tragitti">🔀 Riordina tappe</button>
        </div>
      </div>`;
    const side =
      destStickers.length > 0
        ? `<aside class="pv-plat-side-stickers" aria-hidden="true">
            <h4>${destFlag} Atmosfera</h4>
            <div class="pv-plat-sticker-row">${allStickers
              .map((e) => `<span class="pv-plat-sticker"><span>${e}</span></span>`)
              .join("")}</div>
            <p class="pv-plat-muted" style="margin:0">Suggerimenti visivi dal paese di destinazione.</p>
          </aside>`
        : "";
    return side
      ? `<div class="pv-plat-dash-wide">${mainCard}${side}</div>${nextCard}`
      : `${mainCard}${nextCard}`;
  }

  async function renderPolls() {
    if (!tripAuth()) return `<div class="pv-plat-card"><p class="pv-plat-muted">Apri un viaggio per votare.</p></div>`;
    const { trip, data } = await fetchTrip();
    const polls = trip.meta?.polls || [];
    const canEdit = data.canEdit !== false;
    const voter =
      readJson("viavia-account-v1", null)?.user?.username ||
      trip.members?.[0]?.name ||
      "anon";
    return `
      <div class="pv-plat-card">
        <h3>Votazioni di gruppo</h3>
        <p class="pv-plat-muted">Destinazioni, ristoranti, attività, alloggi. Un voto a persona.</p>
        ${
          canEdit
            ? `<label class="pv-plat-muted">Nuova proposta
                <input class="pv-plat-input" id="pv-poll-title" placeholder="Es. Ristorante centro" />
               </label>
               <label class="pv-plat-muted">Opzioni (separate da virgola)
                <input class="pv-plat-input" id="pv-poll-opts" placeholder="Opzione A, Opzione B" />
               </label>
               <button type="button" class="pv-plat-btn" data-plat="poll-create">Crea votazione</button>`
            : ""
        }
      </div>
      ${polls
        .map((p) => {
          const tally = (p.options || [])
            .map(
              (o) =>
                `<li><button type="button" class="pv-plat-btn" data-plat="vote" data-poll="${escapeHtml(
                  p.id
                )}" data-opt="${escapeHtml(o.id)}" ${p.status !== "open" || !canEdit ? "disabled" : ""} aria-pressed="${(o.votes || []).includes(voter)}">${escapeHtml(
                  o.label
                )} · ${(o.votes || []).length}${(o.votes || []).includes(voter) ? " · Il tuo voto" : ""}</button></li>`
            )
            .join("");
          return `<div class="pv-plat-card">
            <h3>${escapeHtml(p.title)}</h3>
            <p class="pv-plat-muted">${p.status === "open" ? "Aperta" : "Chiusa"}${
            p.winnerId
              ? " · vincitore: " +
                escapeHtml(p.options?.find((o) => o.id === p.winnerId)?.label || "")
              : ""
          }</p>
            <ul class="pv-plat-list">${tally}</ul>
            ${
              canEdit && p.status === "open"
                ? `<button type="button" class="pv-plat-btn" data-plat="poll-close" data-poll="${escapeHtml(
                    p.id
                  )}">Chiudi votazione</button>`
                : ""
            }
          </div>`;
        })
        .join("") || `<div class="pv-plat-card"><p class="pv-plat-muted">Nessuna votazione ancora.</p></div>`}
      <div id="pv-poll-voter" hidden data-voter="${escapeHtml(voter)}"></div>`;
  }

  async function renderPrep() {
    if (!tripAuth()) return `<div class="pv-plat-card"><p class="pv-plat-muted">Apri un viaggio.</p></div>`;
    const { trip } = await fetchTrip();
    const prep = trip.meta?.preparation || {};
    const docs = prep.docs || [];
    const missing = [];
    if (!(trip.bookings || []).length) missing.push("Aggiungi le prenotazioni");
    if (!docs.length) missing.push("Annota i documenti da portare");
    const dep = prep.departureChecklist || defaultDeparture();
    if (dep.some(item => !item.done)) missing.push("Completa la checklist di partenza");
    const pack = ["Bagaglio principale", "Bagaglio a mano", "Documenti", "Elettronica", "Abbigliamento", "Igiene", "Farmaci"];
    const notes = trip.meta?.destinationNotes || {};
    return `
      <div class="pv-plat-card">
        <h3>Prima di partire</h3>
        <ul class="pv-plat-list">${missing.map(item => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Checklist completata.</li>"}</ul>
        <h3>Documenti</h3>
        <p class="pv-plat-muted">Link e note (i file restano nella tab Documenti; non finiscono nei link pubblici).</p>
        <ul class="pv-plat-list">${docs
          .map(
            (d) =>
              `<li><strong>${escapeHtml(d.title)}</strong> · ${escapeHtml(d.category || "")}
              ${/^https?:\/\//i.test(d.url || "") ? ` · <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">apri</a>` : ""}</li>`
          )
          .join("") || "<li>Nessun documento annotato.</li>"}</ul>
        <label class="pv-plat-muted">Titolo<input class="pv-plat-input" id="pv-doc-title" /></label>
        <label class="pv-plat-muted">Link<input class="pv-plat-input" id="pv-doc-url" placeholder="https://…" /></label>
        <label class="pv-plat-muted">Giorno di utilizzo <input type="date" class="pv-plat-input" id="pv-doc-day"></label>
        <label class="pv-plat-muted">Categoria
          <select class="pv-plat-input" id="pv-doc-cat">
            <option>prenotazione</option><option>biglietto</option><option>assicurazione</option>
            <option>voucher</option><option>documento</option><option>altro</option>
          </select>
        </label>
        <button type="button" class="pv-plat-btn" data-plat="doc-add">Aggiungi</button>
      </div>
      <div class="pv-plat-card">
        <h3>Checklist partenza</h3>
        <ul class="pv-plat-list">${dep
          .map(
            (c, i) =>
              `<li><label><input type="checkbox" data-plat="dep-check" data-i="${i}" ${
                c.done ? "checked" : ""
              }/> ${escapeHtml(c.label)}</label></li>`
          )
          .join("")}</ul>
      </div>
      <div class="pv-plat-card">
        <h3>Bagagli (modello)</h3>
        <p class="pv-plat-muted">${pack.map(escapeHtml).join(" · ")}</p>
        <button type="button" class="pv-plat-btn" data-plat="pack-seed">Aggiungi al checklist viaggio</button>
      </div>
      <div class="pv-plat-card">
        <h3>Note destinazione</h3>
        <p class="pv-plat-muted">Informazioni pratiche inserite da voi (non sono consulenza legale).</p>
        ${["lingua", "moneta", "fuso", "emergenze", "documentiRichiesti", "locali"]
          .map(
            (k) =>
              `<label class="pv-plat-muted">${escapeHtml(k)}
                <input class="pv-plat-input" data-note="${k}" value="${escapeHtml(notes[k] || "")}" /></label>`
          )
          .join("")}
        <button type="button" class="pv-plat-btn" data-plat="notes-save">Salva note</button>
      </div>`;
  }
  function defaultDeparture() {
    return [
      { id: "d1", label: "Documenti e documenti digitali", done: false },
      { id: "d2", label: "Prenotazioni confermate", done: false },
      { id: "d3", label: "Check-in online", done: false },
      { id: "d4", label: "Trasporti per aeroporto/stazione", done: false },
      { id: "d5", label: "Bagagli chiusi", done: false },
      { id: "d6", label: "Controllo casa (gas, luci, piante)", done: false },
      { id: "d7", label: "Meteo controllato", done: false },
    ];
  }

  function computeShareBalances(trip) {
    const bal = Object.fromEntries((trip?.members || []).map((m) => [m.id, 0]));
    for (const e of trip?.expenses || []) {
      const cents = expenseAmountCents(e);
      const payer = e.payer || e.paidBy;
      if (payer && payer in bal) bal[payer] += cents;
      for (const s of e.shares || []) {
        const mid = s.member || s.memberId;
        if (mid && mid in bal) bal[mid] -= Math.trunc(Number(s.amount) || 0);
      }
    }
    for (const t of trip?.transfers || []) {
      const cents = Math.trunc(
        Number.isFinite(t.amountCents) ? t.amountCents : Number(t.amount) || 0
      );
      if (t.from && t.from in bal) bal[t.from] += cents;
      if (t.to && t.to in bal) bal[t.to] -= cents;
    }
    return bal;
  }

  function settleBalancesMap(balances) {
    const debtors = [];
    const creditors = [];
    for (const [id, v] of Object.entries(balances || {})) {
      const n = Math.trunc(v);
      if (n < 0) debtors.push({ id, amount: -n });
      else if (n > 0) creditors.push({ id, amount: n });
    }
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const transfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amount, creditors[j].amount);
      if (pay > 0) {
        transfers.push({ from: debtors[i].id, to: creditors[j].id, amountCents: pay });
        debtors[i].amount -= pay;
        creditors[j].amount -= pay;
      }
      if (debtors[i].amount === 0) i += 1;
      if (creditors[j].amount === 0) j += 1;
    }
    return transfers;
  }

  async function renderStats() {
    const auth = tripAuth();
    if (auth) {
      const { trip } = await fetchTrip();
      const spent = expenseCents(trip.expenses);
      const people = Math.max(1, (trip.members || []).length);
      const days = daysBetween(trip.start, trip.end) || 1;
      const byCat = Object.create(null);
      for (const e of trip.expenses || []) {
        const cat = e.category || e.type || "altro";
        byCat[cat] = (byCat[cat] || 0) + expenseAmountCents(e);
      }
      const max = Math.max(1, ...Object.values(byCat), 1);
      const bars = Object.entries(byCat)
        .map(
          ([k, v]) =>
            `<div style="margin:6px 0"><div class="pv-plat-muted">${escapeHtml(k)} · ${euro(v)}</div>
             <div style="height:8px;background:var(--pv-plat-border);border-radius:99px;overflow:hidden">
               <div style="height:100%;width:${Math.round((v / max) * 100)}%;background:var(--pv-plat-accent)"></div>
             </div></div>`
        )
        .join("");
      const bal = computeShareBalances(trip);
      const maxAbs = Math.max(1, ...Object.values(bal).map((v) => Math.abs(Math.trunc(v || 0))));
      const nameOf = (id) => {
        const m = (trip.members || []).find((x) => x.id === id);
        return m?.name || m?.username || id;
      };
      const balRows = (trip.members || [])
        .map((m) => {
          const v = Math.trunc(bal[m.id] || 0);
          const pct = Math.round((Math.abs(v) / maxAbs) * 100);
          const label = v > 0 ? `+${euro(v)}` : v < 0 ? `−${euro(-v)}` : euro(0);
          return `<div style="margin:6px 0">
            <div class="pv-plat-muted">${escapeHtml(m.name || m.id)} · ${escapeHtml(label)}</div>
            <div style="height:8px;background:var(--pv-plat-border);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${v < 0 ? "var(--pv-plat-warn,#b45309)" : "var(--pv-plat-accent)"}"></div>
            </div></div>`;
        })
        .join("");
      const settles = settleBalancesMap(bal);
      const settleList = settles.length
        ? `<ul class="pv-plat-list">${settles
            .map(
              (t) =>
                `<li><strong>${escapeHtml(nameOf(t.from))}</strong> → <strong>${escapeHtml(
                  nameOf(t.to)
                )}</strong> · ${euro(t.amountCents)}</li>`
            )
            .join("")}</ul>`
        : `<p class="pv-plat-muted">Tutti in pari.</p>`;
      const activity = [...(trip.meta?.expenseActivity || [])].reverse().slice(0, 6);
      const actList = activity.length
        ? `<ul class="pv-plat-list">${activity
            .map(
              (a) =>
                `<li>${escapeHtml(String(a.at || "").slice(0, 10))} · ${escapeHtml(
                  a.summary || a.type || ""
                )}</li>`
            )
            .join("")}</ul>`
        : `<p class="pv-plat-muted">Ancora nessuna attività spese.</p>`;
      return `<div class="pv-plat-card">
        <h3>Statistiche viaggio</h3>
        <div class="pv-plat-grid">
          <div class="pv-plat-stat"><b>${euro(spent)}</b><span>Spesa</span></div>
          <div class="pv-plat-stat"><b>${euro(Math.round(spent / people))}</b><span>Per persona</span></div>
          <div class="pv-plat-stat"><b>${euro(Math.round(spent / days))}</b><span>Al giorno</span></div>
          <div class="pv-plat-stat"><b>${(trip.stops || []).length}</b><span>Tappe</span></div>
        </div>
        <div style="margin-top:10px">${bars || '<p class="pv-plat-muted">Nessuna spesa categorizzata.</p>'}</div>
        <h3 style="margin-top:14px">Spese condivise · saldi</h3>
        <p class="pv-plat-muted">Come Splitwise: crediti, debiti e rimborsi suggeriti (semplificati).</p>
        <div style="margin-top:8px">${balRows || '<p class="pv-plat-muted">Nessun membro.</p>'}</div>
        <h3 style="margin-top:14px">Come pareggiare</h3>
        ${settleList}
        <h3 style="margin-top:14px">Attività spese</h3>
        ${actList}
        <div class="pv-plat-actions">
          <button type="button" class="pv-plat-btn" data-plat="export-json">Export JSON</button>
          <button type="button" class="pv-plat-btn" data-plat="export-csv">Export CSV spese</button>
        </div>
      </div>`;
    }
    const recent = readJson("viavia-recent-links-v1", []);
    return `<div class="pv-plat-card"><h3>Portfolio</h3>
      <p class="pv-plat-muted">${recent.length} viaggi recenti su questo dispositivo. Apri un viaggio per dettagli.</p>
      <ul class="pv-plat-list">${recent
        .slice(0, 12)
        .map((r) => `<li>${escapeHtml(r.title || r.id)}</li>`)
        .join("")}</ul></div>`;
  }

  async function renderCal() {
    if (!tripAuth()) return `<div class="pv-plat-card"><p class="pv-plat-muted">Apri un viaggio.</p></div>`;
    const { trip } = await fetchTrip();
    const reminders = trip.meta?.reminders || [];
    return `<div class="pv-plat-card">
      <h3>Calendario e promemoria</h3>
      <p class="pv-plat-muted">${escapeHtml(trip.start || "?")} → ${escapeHtml(trip.end || "?")}</p>
      <ul class="pv-plat-list">
        <li>Partenza ${escapeHtml(trip.start || "—")}</li>
        <li>Ritorno ${escapeHtml(trip.end || "—")}</li>
        ${(trip.bookings || [])
          .map((b) => `<li>${escapeHtml(b.title || "Prenotazione")} · ${escapeHtml(b.date || b.checkIn || "")}</li>`)
          .join("")}
      </ul>
      <h3 style="margin-top:12px">Promemoria locali</h3>
      <p class="pv-plat-muted">Le notifiche locali richiedono il permesso del browser. Per ritrovare i promemoria nel calendario, esporta il file ICS e importalo nella tua app calendario.</p>
      <input class="pv-plat-input" id="pv-rem-title" placeholder="Titolo" />
      <input class="pv-plat-input" id="pv-rem-date" type="date" />
      <button type="button" class="pv-plat-btn" data-plat="rem-add">Salva promemoria</button>
      <button type="button" class="pv-plat-btn" data-plat="ics">Esporta nel calendario (.ics)</button>
      <button type="button" class="pv-plat-btn" data-plat="notify-perm">Attiva notifiche locali</button>
      <ul class="pv-plat-list">${reminders
        .map((r) => `<li>${escapeHtml(r.date)} · ${escapeHtml(r.title)}</li>`)
        .join("") || "<li>Nessun promemoria.</li>"}</ul>
    </div>`;
  }

  async function renderArchive() {
    const index = readJson(ARCHIVE_KEY, []);
    let tripBlock = "";
    if (tripAuth()) {
      const { trip } = await fetchTrip();
      const memories = trip.meta?.archive?.memories || [];
      const diary = trip.meta?.archive?.diary || "";
      tripBlock = `<div class="pv-plat-card">
        <h3>Ricordi di questo viaggio</h3>
        <textarea class="pv-plat-input" id="pv-diary" rows="4" placeholder="Diario…">${escapeHtml(diary)}</textarea>
        <label class="pv-plat-muted">Nota / luogo<input class="pv-plat-input" id="pv-mem-text" /></label>
        <label>Link a una foto <input type="url" class="pv-plat-input" id="pv-mem-photo" placeholder="https://…"></label>
        <label>Giorno del ricordo <input type="date" class="pv-plat-input" id="pv-mem-day" value="${escapeHtml(tripDay(trip))}"></label>
        <button type="button" class="pv-plat-btn" data-plat="mem-add">Salva diario e ricordo</button>
        <button type="button" class="pv-plat-btn" data-plat="archive-trip">Archivia viaggio concluso</button>
        ${[...new Set(memories.map(m => m.day || String(m.at || "").slice(0, 10)))].sort().reverse().map(day =>
          `<h4>${escapeHtml(day ? day.split("-").reverse().join("/") : "Senza data")}</h4><ul class="pv-plat-list">${memories.filter(m => (m.day || String(m.at || "").slice(0, 10)) === day)
            .map(m => `<li>${escapeHtml(m.text)}${/^https?:\/\//i.test(m.photo || "") ? ` <a href="${escapeHtml(m.photo)}" target="_blank" rel="noopener">Apri foto</a>` : ""}</li>`).join("")}</ul>`
        ).join("") || "<p>Nessun ricordo ancora.</p>"}
      </div>`;
    }
    return (
      tripBlock +
      `<div class="pv-plat-card"><h3>Archivio locale</h3>
        <ul class="pv-plat-list">${index
          .map(
            (a) =>
              `<li><strong>${escapeHtml(a.title)}</strong> · ${escapeHtml(a.destination || "")} · spese ${euro(
                a.spentCents || 0
              )}</li>`
          )
          .join("") || "<li>Nessun viaggio archiviato su questo dispositivo.</li>"}</ul>
      </div>`
    );
  }

  function backupChoices() {
    const recent = readJson("viavia-recent-links-v1", []);
    const auth = tripAuth();
    return auth && !recent.some(r => r.id === auth.id && r.key === auth.key)
      ? [{ ...auth, title: "Viaggio aperto" }, ...recent] : recent;
  }

  async function renderBackup() {
    const choices = backupChoices();
    const auth = tripAuth();
    return `<div class="pv-plat-card">
      <h3>Copia di sicurezza</h3>
      <p class="pv-plat-muted">Scegli un viaggio da esportare. Il file contiene il suo link di accesso, quindi conservalo in un posto sicuro.</p>
      <label>Viaggio <select class="pv-plat-input" id="pv-backup-trip">
        ${choices.map((r, i) => `<option value="${i}" ${r.id === auth?.id && r.key === auth?.key ? "selected" : ""}>${escapeHtml(r.title || "Viaggio")}</option>`).join("")}
      </select></label>
      <button type="button" class="pv-plat-btn" data-plat="backup-export" ${choices.length ? "" : "disabled"}>Scarica copia del viaggio</button>
      <label class="pv-plat-muted">Ripristina da file
        <input class="pv-plat-input" id="pv-backup-file" type="file" accept="application/json,.json" />
      </label>
      <pre id="pv-backup-summary" class="pv-plat-muted" style="white-space:pre-wrap"></pre>
      <button type="button" class="pv-plat-btn" data-plat="backup-apply" hidden>Ripristina senza cancellare tutto</button>
    </div>`;
  }

  function tripDay(trip) {
    const now = new Date();
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map(value => String(value).padStart(2, "0")).join("-");
    if (trip.start && today < trip.start) return trip.start;
    if (trip.end && today > trip.end) return trip.end;
    return today;
  }

  const daySelections = new Map();

  async function renderToday() {
    if (!tripAuth()) return '<div class="pv-plat-card"><p>Apri un viaggio per vedere il programma della giornata.</p></div>';
    const { auth, trip, data } = await fetchTrip();
    const buttons = [...(document.querySelectorAll?.(".day-strip button") || [])];
    const selected = buttons.findIndex(button => button.classList.contains("selected"));
    const first = Date.parse(`${trip.start}T12:00:00Z`);
    const itineraryDay = selected >= 0 && Number.isFinite(first)
      ? new Date(first + selected * 86400_000).toISOString().slice(0, 10) : "";
    const selectedDay = itineraryDay && (!trip.end || itineraryDay <= trip.end) ? itineraryDay : "";
    const syncLabel = window.__pvTripOverview?.(auth.id, auth.key).status;
    const chosen = daySelections.get(auth.id);
    const day = chosen ? chosen.day || tripDay(trip) : selectedDay || tripDay(trip);
    const stops = (trip.stops || []).filter(stop => (stop.day || stop.date) === day)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const bookings = (trip.bookings || []).filter(booking => {
      const start = booking.checkIn || booking.date || booking.start;
      const end = booking.checkOut || booking.end || start;
      return start && start <= day && end >= day;
    });
    const docs = data.canEdit === false ? [] : (trip.meta?.preparation?.docs || []).filter(doc => doc.day === day);
    function rows(items, directions = false) {
      return items.map(item => {
        const when = item.time || item.departureTime || item.startTime;
        const route = [item.from, item.to].filter(Boolean).join(" → ");
        const title = item.title || item.name || route || item.type || "Tappa";
        const point = Number.isFinite(item.lat) && Number.isFinite(item.lng)
          ? `${item.lat},${item.lng}` : [item.address || item.location || item.title, trip.destination].filter(Boolean).join(", ");
        const maps = directions && point
          ? `<div><a href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(point)}" target="_blank" rel="noopener">Indicazioni</a></div>` : "";
        return `<li><strong>${escapeHtml(when ? `${when} · ${title}` : title)}</strong>
          ${[item.address || item.location, item.reference || item.confirmation, item.notes]
            .filter(Boolean).map(value => `<div>${escapeHtml(value)}</div>`).join("")}${maps}</li>`;
      }).join("") || "<li>Nessuna voce per questa data.</li>";
    }
    return `<div class="pv-plat-card">
      <label>Giorno del viaggio
        <input type="date" id="pv-today-date" class="pv-plat-input" value="${escapeHtml(day)}" min="${escapeHtml(trip.start || "")}" max="${escapeHtml(trip.end || "")}">
      </label>
      <button type="button" class="pv-plat-btn" data-plat="map-day">Mappa del giorno</button>
      <button type="button" class="pv-plat-btn" data-plat="print-day">Stampa o salva come PDF</button>
    </div>
    <div id="pv-day-map-host"></div>
    <article class="pv-plat-card" id="pv-day-sheet">
      <h3>${escapeHtml(trip.title || "Viaggio")}</h3>
      <p>${escapeHtml([day.split("-").reverse().join("/"), trip.destination].filter(Boolean).join(" · "))}</p>
      ${syncLabel ? `<p class="pv-plat-muted">${escapeHtml(syncLabel)}</p>` : ""}
      <h4>Tappe e indicazioni</h4><ol class="pv-plat-list">${rows(stops, true)}</ol>
      <h4>Prenotazioni</h4><ul class="pv-plat-list">${rows(bookings)}</ul>
      ${docs.length ? `<h4>Documenti del giorno</h4><ul class="pv-plat-list">${docs.map(doc =>
        `<li>${escapeHtml(doc.title)}${/^https?:\/\//i.test(doc.url || "") ? ` · <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">Apri</a>` : ""}</li>`
      ).join("")}</ul>` : ""}
    </article>`;
  }

  async function inviteRequest(auth, method = "GET", body) {
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}/access`, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${auth.key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error("Il servizio degli inviti personali non è disponibile su questo server.");
    if (!res.ok) throw new Error(data.error || "Inviti personali non disponibili.");
    return data;
  }

  async function renderAccess() {
    const auth = tripAuth();
    if (!auth) {
      return `<div class="pv-plat-card">
        <h3>Inviti personali</h3>
        <p>Apri un viaggio per creare link distinti da condividere con ogni persona.</p>
        <p class="pv-plat-muted">Ogni invito può essere in sola lettura o con permesso di modifica, e si può revocare in qualsiasi momento.</p>
      </div>`;
    }
    if (!navigator.onLine) {
      return `<div class="pv-plat-card">
        <h3>Inviti personali</h3>
        <p>Sei offline: ripristina la connessione per creare o revocare i link personali.</p>
        <p class="pv-plat-muted">Intanto puoi usare <strong>Condividi viaggio</strong> dalla scheda del viaggio per il link di gruppo.</p>
      </div>`;
    }
    try {
      const { invites, revoked = [] } = await inviteRequest(auth);
      if (!Array.isArray(invites)) throw new Error("Il servizio inviti non è ancora disponibile.");
      return `<div class="pv-plat-card">
        <h3>Inviti personali</h3>
        <p class="pv-plat-muted">Crea un link distinto per ogni persona. Chi lo riceve può usarlo fino a quando lo revochi. Condividilo direttamente con la persona indicata.</p>
        <form id="pv-invite-form">
          <label>Nome <input id="pv-invite-name" class="pv-plat-input" maxlength="80" required></label>
          <label>Permesso <select id="pv-invite-role" class="pv-plat-input">
            <option value="viewer">Solo lettura</option>
            <option value="editor">Modifica programma e spese</option>
          </select></label>
          <button type="submit" class="pv-plat-btn">Crea link personale</button>
        </form>
        <div id="pv-invite-result" hidden>
          <label>Link personale <input id="pv-invite-url" class="pv-plat-input" readonly></label>
          <button type="button" class="pv-plat-btn" data-plat="invite-copy">Copia link</button>
        </div>
        <h4>Inviti attivi</h4>
        <ul class="pv-plat-list" id="pv-invite-list">${inviteRows(invites)}</ul>
        <h4>Inviti revocati</h4>
        <ul class="pv-plat-list" id="pv-revoked-list">${revokedInviteRows(revoked)}</ul>
      </div>`;
    } catch (err) {
      return `<div class="pv-plat-card">
        <h3>Inviti personali</h3>
        <p>${escapeHtml(err.message || "Servizio inviti non disponibile.")}</p>
        <p class="pv-plat-muted">Puoi comunque condividere il viaggio con il pulsante <strong>Condividi viaggio</strong> nella scheda principale. Gli inviti personali (link singoli + revoca) richiedono il backend aggiornato.</p>
        <button type="button" class="pv-plat-btn" data-plat="retry-panel">Riprova</button>
      </div>`;
    }
  }

  function inviteRows(invites) {
    return invites.map(invite => `<li><strong>${escapeHtml(invite.name)}</strong> · ${invite.role === "editor" ? "Modifica" : "Solo lettura"}
      <button type="button" class="pv-plat-btn" data-revoke-invite="${escapeHtml(invite.id)}">Revoca</button></li>`).join("") ||
      "<li>Nessun invito attivo.</li>";
  }

  function revokedInviteRows(invites) {
    return invites.map(invite => `<li><strong>${escapeHtml(invite.name)}</strong> · ${invite.role === "editor" ? "Modifica" : "Solo lettura"} · ${escapeHtml(String(invite.revokedAt || "").slice(0, 10).split("-").reverse().join("/"))}</li>`).join("") ||
      "<li>Nessuna revoca registrata.</li>";
  }

  const CONFLICT_FIELDS = {
    title: "Nome", destination: "Destinazione", start: "Partenza", end: "Rientro",
    stops: "Tappe", bookings: "Prenotazioni", expenses: "Spese", transfers: "Spostamenti",
    checklist: "Lista di controllo", members: "Partecipanti", notes: "Note", meta: "Dettagli aggiuntivi",
  };

  function conflictValue(value) {
    if (value === undefined || value === null || value === "") return "Vuoto";
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item !== "object" || !item) return escapeHtml(item);
        const headline = item.title || item.name || item.text || item.label || item.id;
        const detail = [item.date || item.day, item.time, item.address, item.reference, item.notes].filter(Boolean);
        return escapeHtml([headline, ...detail].filter(Boolean).join(" · "));
      }).join("<br>") || "Nessuna voce";
    }
    return escapeHtml(typeof value === "object" ? JSON.stringify(value, null, 2) : value);
  }

  function conflictFields(review) {
    const keys = new Set([...Object.keys(review.server), ...Object.keys(review.local)]);
    keys.delete("budget");
    return [...keys].filter(field => JSON.stringify(review.server[field]) !== JSON.stringify(review.local[field]));
  }

  function renderConflict(review) {
    return conflictFields(review).map(field => `<fieldset class="pv-plat-card">
      <legend>${escapeHtml(CONFLICT_FIELDS[field] || field)}</legend>
      ${[["server", "Versione online"], ["local", "Versione sul dispositivo"]].map(([side, label]) => `
        <label class="pv-plat-conflict-choice">
          <input type="radio" name="conflict-${escapeHtml(field)}" data-conflict-field="${escapeHtml(field)}" value="${side}" ${side === "server" ? "checked" : ""}>
          <strong>${label}</strong><span>${conflictValue(review[side][field])}</span>
        </label>
        ${Array.isArray(review[side][field]) && review[side][field].length
          ? `<details><summary>Dettagli</summary><div class="pv-plat-conflict-details">${escapeHtml(JSON.stringify(review[side][field], null, 2))}</div></details>`
          : ""}`).join("")}
      </fieldset>`).join("") || "<p>Le due versioni hanno gli stessi dati.</p>";
  }

  async function renderSettings() {
    const theme = readJson(THEME_KEY, { mode: "system" }).mode || "system";
    const outbox =
      typeof window.__pvReadOutbox === "function" ? window.__pvReadOutbox() : readJson(OUTBOX_KEY, []);
    const pending = Array.isArray(outbox) ? outbox.length : 0;
    const auth = tripAuth();
    const conflict = auth && window.__pvHasTripConflict?.(auth.id, auth.key);
    const conflicts = Array.isArray(outbox) ? outbox.filter(item => item.lastError === "conflict") : [];
    const recent = readJson("viavia-recent-links-v1", []);
    const links = conflicts.filter(item => item.tripId !== auth?.id).map(item => {
      const match = recent.find(trip => trip.id === item.tripId && trip.key === item.key);
      if (!match) return "";
      return `<li><a data-plat="open-conflict-trip" href="#trip=${encodeURIComponent(match.id)}&key=${encodeURIComponent(match.key)}">${escapeHtml(match.title || "Viaggio")}</a></li>`;
    }).filter(Boolean);
    return `<div class="pv-plat-card">
      <h3>Aspetto</h3>
      <label class="pv-plat-muted">Tema
        <select class="pv-plat-input" id="pv-theme">
          <option value="system" ${theme === "system" ? "selected" : ""}>Come il telefono</option>
          <option value="light" ${theme === "light" ? "selected" : ""}>Chiaro</option>
          <option value="dark" ${theme === "dark" ? "selected" : ""}>Scuro</option>
        </select>
      </label>
      <button type="button" class="pv-plat-btn" data-plat="theme-save">Applica</button>
      ${auth ? `<h3 style="margin-top:16px">Notifiche del viaggio</h3>
      <button type="button" class="pv-plat-btn" data-trip-notifications>Preferenze notifiche</button>` : ""}
      <h3 style="margin-top:16px">Sincronizzazione</h3>
      <p class="pv-plat-muted">${
        navigator.onLine
          ? pending
            ? `${pending} modifiche in attesa di conferma dal server.`
            : "Nessuna modifica in coda."
          : "Offline — le modifiche restano su questo dispositivo finché torni online."
      }</p>
      <button type="button" class="pv-plat-btn" data-plat="flush-outbox">Riprova ora</button>
      ${links.length ? `<p>Viaggi con modifiche da confrontare</p><ul>${links.join("")}</ul>` : ""}
      ${conflict ? `
        <p>Questo viaggio ha modifiche diverse sul dispositivo e online.</p>
        <button type="button" class="pv-plat-btn" data-plat="compare-conflict">Confronta versioni</button>
        <form id="pv-conflict-form" hidden></form>` : ""}
      <details style="margin-top:14px">
        <summary class="pv-plat-muted" style="cursor:pointer">Chi può fare cosa</summary>
        <p class="pv-plat-muted" style="margin-top:8px">
          <strong>Proprietario</strong> gestisce tutto ·
          <strong>Amministratore</strong> invita e modifica ·
          <strong>Collaboratore</strong> modifica contenuti ·
          <strong>Visualizzatore</strong> legge e vota.
        </p>
      </details>
      <p class="pv-plat-muted" style="margin-top:10px;font-size:11px">Hub ${VER}</p>
    </div><details class="pv-plat-card"><summary>Backup e ripristino</summary>${await renderBackup()}</details>`;
  }

  function download(filename, text, type = "application/json") {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function wireBody(body) {
    body.querySelector("[data-plat=retry-panel]")?.addEventListener("click", () => void renderPanel());
    body.querySelector("#pv-today-date")?.addEventListener("change", async event => {
      const auth = tripAuth();
      if (!auth || !event.target.value || !event.target.validity.valid) return;
      const day = event.target.value;
      const { trip } = await fetchTrip().catch(() => ({}));
      const index = trip?.start ? (Date.parse(day) - Date.parse(trip.start)) / 86400_000 : -1;
      daySelections.set(auth.id, { day, index });
      applyDaySelection();
      void renderPanel();
    });
    body.querySelector("[data-plat=map-day]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const host = body.querySelector("#pv-day-map-host");
      if (host.childElementCount) { host.replaceChildren(); button.textContent = "Mappa del giorno"; return; }
      button.disabled = true;
      try {
        const day = body.querySelector("#pv-today-date").value;
        const { trip } = await fetchTrip();
        const points = (trip.stops || []).filter(stop => (stop.day || stop.date) === day
          && Number.isFinite(stop.lat) && Number.isFinite(stop.lng));
        if (!points.length) throw new Error("Non ci sono tappe geolocalizzate per questa data.");
        const frame = document.createElement("iframe");
        frame.title = "Mappa delle tappe del giorno";
        frame.className = "pv-day-map";
        frame.src = "./map.html";
        const sendPoints = event => {
          if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== "viavia-ready") return;
          window.removeEventListener("message", sendPoints);
          frame.contentWindow?.postMessage({ type: "viavia-map", points }, location.origin);
        };
        window.addEventListener("message", sendPoints);
        setTimeout(() => window.removeEventListener("message", sendPoints), 15_000);
        host.append(frame);
        button.textContent = "Chiudi mappa";
      } catch (err) {
        showStatus(err.message, "error");
      } finally {
        button.disabled = false;
      }
    });
    body.querySelector("[data-plat=print-day]")?.addEventListener("click", () => {
      const sheet = body.querySelector("#pv-day-sheet");
      if (!sheet) return;
      document.getElementById("pv-print-day")?.remove();
      const copy = sheet.cloneNode(true);
      copy.id = "pv-print-day";
      document.body.append(copy);
      window.addEventListener("afterprint", () => copy.remove(), { once: true });
      window.print();
    });
    body.querySelector("[data-trip-notifications]")?.addEventListener("click", () => window.__pvOpenTripNotifications?.());
    const inviteList = body.querySelector("#pv-invite-list");
    const inviteForm = body.querySelector("#pv-invite-form");
    if (inviteForm && inviteList) {
      const auth = tripAuth();
      const result = body.querySelector("#pv-invite-result");
      const urlField = body.querySelector("#pv-invite-url");
      const refresh = async () => {
        const { invites, revoked = [] } = await inviteRequest(auth);
        inviteList.innerHTML = inviteRows(invites);
        body.querySelector("#pv-revoked-list").innerHTML = revokedInviteRows(revoked);
      };
      inviteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = inviteForm.querySelector("button");
        button.disabled = true;
        try {
          const name = body.querySelector("#pv-invite-name").value;
          const role = body.querySelector("#pv-invite-role").value;
          const created = await inviteRequest(auth, "POST", { name, role });
          if (!/^pv-personal-[a-f0-9]{64}$/.test(created.token)) throw new Error("Il server non ha confermato la creazione.");
          const url = new URL(location.href);
          url.hash = new URLSearchParams({ trip: auth.id, key: created.token }).toString();
          urlField.value = url.toString();
          result.hidden = false;
          inviteForm.reset();
          await refresh();
        } catch (err) {
          showStatus(err.message, "error");
        } finally {
          button.disabled = false;
        }
      });
      body.querySelector("[data-plat=invite-copy]")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(urlField.value);
          showStatus("Link personale copiato", "server");
        } catch {
          urlField.select();
        }
      });
      inviteList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-revoke-invite]");
        if (!button || !window.confirm("Revocare questo link personale?")) return;
        button.disabled = true;
        try {
          await inviteRequest(auth, "DELETE", { id: button.dataset.revokeInvite });
          result.hidden = true;
          urlField.value = "";
          await refresh();
          showStatus("Invito revocato", "server");
        } catch (err) {
          showStatus(err.message, "error");
          button.disabled = false;
        }
      });
    }
    body.querySelectorAll("[data-plat=open-conflict-trip]").forEach(link => {
      link.addEventListener("click", () => togglePanel(false));
    });
    const conflictForm = body.querySelector("#pv-conflict-form");
    if (conflictForm) {
      const auth = tripAuth();
      let review;
      body.querySelector("[data-plat=compare-conflict]").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          review = await window.__pvCompareTripConflict(auth.id, auth.key);
          if (!review) return void renderPanel();
          conflictForm.innerHTML = renderConflict(review) +
            '<button type="submit" class="pv-plat-btn">Salva le scelte</button>';
          conflictForm.hidden = false;
        } catch (err) {
          showStatus(err.message, "error");
        } finally {
          button.disabled = false;
        }
      });
      conflictForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!review) return;
        const selected = { ...review.server };
        conflictForm.querySelectorAll('input[value="local"]:checked').forEach(input => {
          const field = input.dataset.conflictField;
          Object.defineProperty(selected, field, { value: review.local[field], enumerable: true, configurable: true });
        });
        const button = conflictForm.querySelector("button");
        button.disabled = true;
        try {
          await window.__pvResolveTripConflict(auth.id, auth.key, review, selected);
          showStatus("Versione aggiornata", "server");
          void renderPanel();
        } catch (err) {
          showStatus(err.message, "error");
        } finally {
          button.disabled = false;
        }
      });
    }
    body.querySelector("[data-plat=goto-new]")?.addEventListener("click", () => {
      togglePanel(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    body.querySelectorAll("[data-plat=tab]").forEach((b) =>
      b.addEventListener("click", () => {
        activeTab = b.dataset.to;
        void renderPanel();
      })
    );
    body.querySelector("[data-plat=optimize]")?.addEventListener("click", async () => {
      try {
        await saveTripMeta((trip) => {
          const { stops, report } = optimizeStops(trip.stops || []);
          trip.stops = stops;
          trip.meta.optimizeReport = report;
        });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=poll-create]")?.addEventListener("click", async () => {
      const title = body.querySelector("#pv-poll-title")?.value?.trim();
      const opts = (body.querySelector("#pv-poll-opts")?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!title) return showStatus("Titolo obbligatorio", "error");
      try {
        await saveTripMeta((trip) => {
          trip.meta.polls = trip.meta.polls || [];
          trip.meta.polls.unshift(createPoll(title, opts.length ? opts : [title]));
        });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelectorAll("[data-plat=vote]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const voter = body.querySelector("#pv-poll-voter")?.dataset?.voter || "anon";
        try {
          await saveTripMeta((trip) => {
            const poll = (trip.meta.polls || []).find((p) => p.id === btn.dataset.poll);
            if (!poll || poll.status !== "open") throw new Error("Votazione chiusa");
            for (const o of poll.options) o.votes = (o.votes || []).filter((v) => v !== voter);
            const opt = poll.options.find((o) => o.id === btn.dataset.opt);
            if (!opt) throw new Error("Opzione assente");
            opt.votes.push(voter);
          });
          void renderPanel();
        } catch (e) {
          showStatus(e.message, "error");
        }
      })
    );
    body.querySelectorAll("[data-plat=poll-close]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await saveTripMeta((trip) => {
            const poll = (trip.meta.polls || []).find((p) => p.id === btn.dataset.poll);
            if (!poll) return;
            let winner = null;
            let best = -1;
            for (const o of poll.options || []) {
              const n = (o.votes || []).length;
              if (n > best) {
                best = n;
                winner = o.id;
              } else if (n === best) winner = null;
            }
            poll.status = "closed";
            poll.closedAt = new Date().toISOString();
            poll.winnerId = winner;
          });
          void renderPanel();
        } catch (e) {
          showStatus(e.message, "error");
        }
      })
    );
    body.querySelector("[data-plat=doc-add]")?.addEventListener("click", async () => {
      const title = body.querySelector("#pv-doc-title")?.value?.trim();
      const url = body.querySelector("#pv-doc-url")?.value?.trim();
      const category = body.querySelector("#pv-doc-cat")?.value;
      const day = body.querySelector("#pv-doc-day")?.value;
      if (!title) return showStatus("Titolo documento obbligatorio", "error");
      if (url && !/^https?:\/\//i.test(url)) return showStatus("Inserisci un link http o https.", "error");
      try {
        await saveTripMeta((trip) => {
          trip.meta.preparation = trip.meta.preparation || {};
          trip.meta.preparation.docs = trip.meta.preparation.docs || [];
          trip.meta.preparation.docs.unshift({
            id: `doc-${Date.now().toString(36)}`,
            title,
            url,
            category,
            ...(day ? { day } : {}),
            private: true,
          });
        });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelectorAll("[data-plat=dep-check]").forEach((cb) =>
      cb.addEventListener("change", async () => {
        const i = Number(cb.dataset.i);
        try {
          await saveTripMeta((trip) => {
            trip.meta.preparation = trip.meta.preparation || {};
            const list = trip.meta.preparation.departureChecklist || defaultDeparture();
            if (list[i]) list[i].done = cb.checked;
            trip.meta.preparation.departureChecklist = list;
          });
        } catch (e) {
          showStatus(e.message, "error");
        }
      })
    );
    body.querySelector("[data-plat=pack-seed]")?.addEventListener("click", async () => {
      try {
        await saveTripMeta((trip) => {
          const labels = [
            "Bagaglio principale",
            "Bagaglio a mano",
            "Documenti",
            "Elettronica",
            "Abbigliamento",
            "Igiene",
            "Farmaci",
          ];
          trip.checklist = Array.isArray(trip.checklist) ? trip.checklist : [];
          for (const label of labels) {
            if (!trip.checklist.some((c) => (c.text || c.label) === label)) {
              trip.checklist.push({ id: crypto.randomUUID?.() || `c-${Date.now()}`, text: label, done: false });
            }
          }
        });
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=notes-save]")?.addEventListener("click", async () => {
      try {
        await saveTripMeta((trip) => {
          trip.meta.destinationNotes = trip.meta.destinationNotes || {};
          body.querySelectorAll("[data-note]").forEach((inp) => {
            trip.meta.destinationNotes[inp.dataset.note] = inp.value.slice(0, 500);
          });
        });
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=export-json]")?.addEventListener("click", async () => {
      const { trip, data } = await fetchTrip();
      download(`pronti-via-${(trip.title || "trip").replace(/\s+/g, "-")}.json`, JSON.stringify({ trip, revision: data.revision }, null, 2));
    });
    body.querySelector("[data-plat=export-csv]")?.addEventListener("click", async () => {
      const { trip } = await fetchTrip();
      const rows = [["id", "title", "category", "amount_eur", "paidBy"]];
      for (const e of trip.expenses || []) {
        rows.push([e.id || "", e.title || e.note || "", e.category || "", (expenseAmountCents(e) / 100).toFixed(2), e.paidBy || e.payer || ""]);
      }
      download(
        "spese.csv",
        rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"),
        "text/csv"
      );
    });
    body.querySelector("[data-plat=rem-add]")?.addEventListener("click", async () => {
      const title = body.querySelector("#pv-rem-title")?.value?.trim();
      const date = body.querySelector("#pv-rem-date")?.value;
      if (!title || !date) return showStatus("Titolo e data obbligatori", "error");
      try {
        await saveTripMeta((trip) => {
          trip.meta.reminders = trip.meta.reminders || [];
          trip.meta.reminders.unshift({ id: `rem-${Date.now().toString(36)}`, title, date, notes: "" });
        });
        scheduleLocalReminder({ title, date });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=ics]")?.addEventListener("click", async () => {
      const { trip } = await fetchTrip();
      download(`pronti-via-calendario.ics`, buildIcs(trip), "text/calendar");
    });
    body.querySelector("[data-plat=notify-perm]")?.addEventListener("click", async () => {
      if (!("Notification" in window)) return showStatus("Notifiche non supportate", "error");
      const perm = await Notification.requestPermission();
      showStatus(perm === "granted" ? "Notifiche abilitate" : "Permesso negato", perm === "granted" ? "ok" : "error");
    });
    body.querySelector("[data-plat=mem-add]")?.addEventListener("click", async () => {
      const text = body.querySelector("#pv-mem-text")?.value?.trim();
      const diary = body.querySelector("#pv-diary")?.value || "";
      const day = body.querySelector("#pv-mem-day")?.value;
      const photo = body.querySelector("#pv-mem-photo")?.value?.trim();
      if (photo && !/^https?:\/\//i.test(photo)) return showStatus("Inserisci un link http o https.", "error");
      if (!text && !diary && !photo) return;
      try {
        await saveTripMeta((trip) => {
          trip.meta.archive = trip.meta.archive || { memories: [], diary: "" };
          trip.meta.archive.diary = diary.slice(0, 20000);
          if (text || photo) {
            trip.meta.archive.memories = trip.meta.archive.memories || [];
            trip.meta.archive.memories.unshift({ text, ...(photo ? { photo } : {}), ...(day ? { day } : {}), at: new Date().toISOString() });
          }
        });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=archive-trip]")?.addEventListener("click", async () => {
      try {
        const { trip, auth } = await fetchTrip();
        const index = readJson(ARCHIVE_KEY, []);
        index.unshift({
          id: auth.id,
          title: trip.title,
          destination: trip.destination,
          start: trip.start,
          end: trip.end,
          spentCents: expenseCents(trip.expenses),
          archivedAt: new Date().toISOString(),
        });
        writeJson(ARCHIVE_KEY, index.slice(0, 100));
        await saveTripMeta((t) => {
          t.meta.archive = t.meta.archive || {};
          t.meta.archive.archived = true;
          t.meta.archive.archivedAt = new Date().toISOString();
        });
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    const exportChoices = body.querySelector("#pv-backup-trip") ? backupChoices() : [];
    body.querySelector("[data-plat=backup-export]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const selected = exportChoices[Number(body.querySelector("#pv-backup-trip")?.value)];
      if (!selected) return;
      button.disabled = true;
      try {
        const recent = backupChoices().find(r => r.id === selected.id && r.key === selected.key);
        if (!recent) throw new Error("Il viaggio non è più nella lista. Riapri il backup.");
        const res = await fetch(`/api/trips/${encodeURIComponent(recent.id)}`, {
          headers: { Authorization: `Bearer ${recent.key}` }, cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.trip) throw new Error(data.error || "Apri il viaggio prima di esportarlo.");
        const { id, key, title } = recent;
        const backup = {
          kind: "pronti-via-backup", schema: 1, exportedAt: new Date().toISOString(), app: "Pronti? VIA!",
          trips: [{ id, key, revision: data.revision, trip: data.trip, viewToken: data.viewToken, canEdit: data.canEdit }],
          localStores: { recent: [{ id, key, title: title || data.trip.title }] },
        };
        download(`pronti-via-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
      } catch (err) {
        showStatus(err.message, "error");
      } finally {
        button.disabled = false;
      }
    });
    const fileInput = body.querySelector("#pv-backup-file");
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const text = await file.text();
      const v = validateBackup(text);
      const sum = body.querySelector("#pv-backup-summary");
      const apply = body.querySelector("[data-plat=backup-apply]");
      if (!v.ok) {
        sum.textContent = "Errori: " + v.errors.join("; ");
        apply.hidden = true;
        return;
      }
      sum.textContent = `OK · ${v.summary.tripCount} viaggi · ${v.summary.exportedAt}\n${(v.summary.titles || []).join(", ")}`;
      apply.hidden = false;
      apply._backup = v.data;
    });
    body.querySelector("[data-plat=backup-apply]")?.addEventListener("click", (ev) => {
      const data = ev.currentTarget._backup;
      if (!data) return;
      const db = readJson("viavia-local-trips-v1", {});
      let added = 0;
      let skipped = 0;
      for (const rec of data.trips || []) {
        const id = rec.id;
        if (!id || !rec.trip) {
          skipped += 1;
          continue;
        }
        const cur = db[id];
        if (!cur || Number(rec.revision || 0) > Number(cur.revision || 0)) {
          db[id] = { ...rec, local: true };
          added += 1;
        } else skipped += 1;
      }
      writeJson("viavia-local-trips-v1", db);
      if (data.localStores?.recent) {
        const recent = readJson("viavia-recent-links-v1", []);
        const map = new Map(recent.map((r) => [r.id, r]));
        for (const r of data.localStores.recent) if (r?.id) map.set(r.id, r);
        writeJson("viavia-recent-links-v1", [...map.values()].slice(0, 40));
      }
      showStatus(`Import: ${added} aggiornati, ${skipped} saltati`, "local");
    });
    body.querySelector("[data-plat=theme-save]")?.addEventListener("click", () => {
      const mode = body.querySelector("#pv-theme")?.value || "system";
      applyTheme(mode);
      showStatus("Tema aggiornato", "server");
    });
    body.querySelector("[data-plat=flush-outbox]")?.addEventListener("click", async () => {
      if (typeof window.__pvFlushOutbox !== "function") {
        showStatus("Outbox non disponibile", "error");
        return;
      }
      showStatus("Sincronizzazione in corso…", "pending");
      const result = await window.__pvFlushOutbox();
      if (result.flushed && !result.left) {
        showStatus("Sincronizzato", "server");
      } else if (result.flushed) {
        showStatus(
          `Sincronizzati ${result.flushed}, ancora in coda ${result.left}`,
          "local"
        );
      } else if (result.left) {
        showStatus(
          `Ancora ${result.left} in coda (rete/conflitto). Non dichiarata sincronizzata.`,
          "local"
        );
      } else {
        showStatus("Nessuna operazione in coda", "server");
      }
      void renderPanel();
    });
  }

  function scheduleLocalReminder(rem) {
    const list = readJson(REMINDERS_LOCAL, []);
    list.push({ ...rem, id: rem.id || `local-${Date.now()}` });
    writeJson(REMINDERS_LOCAL, list.slice(0, 50));
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const when = new Date(rem.date + "T09:00:00");
    const delay = when - Date.now();
    if (delay > 0 && delay < 2147483647) {
      setTimeout(() => {
        try {
          new Notification("Pronti? VIA!", { body: rem.title, icon: "./logo.png" });
        } catch {
          /* ignore */
        }
      }, delay);
    }
  }

  function applyDaySelection() {
    const selection = daySelections.get(tripAuth()?.id);
    if (!selection || !Number.isInteger(selection.index) || selection.index < 0) return;
    const button = document.querySelectorAll(".day-strip button")[selection.index];
    if (button && selection.button !== button && !button.disabled && !button.classList.contains("selected")) {
      selection.button = button;
      button.click();
    }
  }

  function ensureTodayShortcut() {
    const strip = document.querySelector(".day-strip");
    if (!strip || !tripAuth() || strip.parentElement.querySelector(".pv-today-shortcut")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pv-plat-btn pv-today-shortcut";
    button.textContent = "Oggi";
    button.addEventListener("click", () => {
      const auth = tripAuth();
      if (!auth) return;
      daySelections.set(auth.id, { day: "", index: -1 });
      activeTab = "today";
      togglePanel(true);
    });
    strip.before(button);
  }

  function boot() {
    injectCss();
    applyTheme();
    ensureFab();
    ensureTodayShortcut();
    // Chip may mount after platform boot — rebind when account becomes ready.
    let refreshFrame = 0;
    const mo = new MutationObserver(() => {
      if (document.hidden || refreshFrame) return;
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;
        if (document.getElementById("pv-hub-nav")) ensureFab();
        ensureTodayShortcut();
        applyDaySelection();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pv-save-status", (e) => onSaveEvent(e.detail));
    window.addEventListener("pv-outbox-changed", () => {
      /* badge refresh when settings open */
    });
    window.addEventListener("online", () => {
      showStatus("Di nuovo online — sincronizzazione…", "pending");
      if (typeof window.__pvFlushOutbox === "function") void window.__pvFlushOutbox();
    });
    window.addEventListener("offline", () =>
      showStatus("Offline — le modifiche restano in coda locale", "local")
    );
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());
    }
    document.addEventListener("click", event => {
      if (event.isTrusted && event.target.closest?.(".day-strip button")) daySelections.delete(tripAuth()?.id);
    });
    window.ProntiPlatform = {
      ver: VER,
      optimizeStops,
      splitEqualCents,
      expenseCents,
      expenseAmountCents,
      computeShareBalances,
      settleBalances: settleBalancesMap,
      validateBackup,
      roleForTrip,
      canRole,
      getThemeMode,
      setTheme: applyTheme,
      cycleTheme,
      open: () => togglePanel(true),
      openSettings: () => { activeTab = "settings"; togglePanel(true); },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
