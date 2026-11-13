/**
 * Pronti? VIA! — platform hub (dashboard, polls, stats, backup, theme, reminders).
 * Sidecar: does not replace React SPA; stores additive data under trip.meta + localStorage.
 * Stamp: 20261104b
 */
(() => {
  const VER = "20261104b";
  const STYLE_ID = "pv-platform-css";
  const THEME_KEY = "viavia-theme-v1";
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
  function expenseCents(expenses) {
    let sum = 0;
    for (const e of expenses || []) {
      if (Number.isFinite(e.amountCents)) sum += Math.trunc(e.amountCents);
      else {
        const n = Number(e.amount) || 0;
        sum += Number.isInteger(n) && Math.abs(n) >= 100 && !String(e.amount).includes(".")
          ? n
          : Math.round(n * 100);
      }
    }
    return sum;
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
    if (!Array.isArray(data?.trips)) errors.push("trips mancante");
    if (Number(data?.schema) > 1) errors.push("schema troppo nuovo");
    return {
      ok: !errors.length,
      errors,
      data,
      summary: {
        tripCount: data?.trips?.length || 0,
        exportedAt: data?.exportedAt,
        titles: (data?.trips || []).map((t) => t?.trip?.title || t?.title || "?").slice(0, 8),
      },
    };
  }

  /* ---------- theme ---------- */
  function applyTheme(mode) {
    const root = document.documentElement;
    const m = mode || readJson(THEME_KEY, { mode: "system" }).mode || "system";
    writeJson(THEME_KEY, { mode: m });
    let dark = m === "dark";
    if (m === "system") {
      dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    root.dataset.pvTheme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
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
  --pv-plat-ink: #14343a;
  --pv-plat-muted: #5b7378;
  --pv-plat-accent: #007d82;
  --pv-plat-warn: #b45309;
  --pv-plat-ok: #047857;
  --pv-plat-err: #b91c1c;
  --pv-plat-border: rgba(20,52,58,.12);
  --pv-plat-shadow: 0 10px 30px rgba(16,42,48,.08);
}
[data-pv-theme="dark"] {
  --pv-plat-bg: #0f1c1f;
  --pv-plat-card: #16282c;
  --pv-plat-ink: #e7f2f3;
  --pv-plat-muted: #9bb3b8;
  --pv-plat-accent: #2dd4bf;
  --pv-plat-warn: #fbbf24;
  --pv-plat-ok: #34d399;
  --pv-plat-err: #f87171;
  --pv-plat-border: rgba(231,242,243,.12);
  --pv-plat-shadow: 0 12px 32px rgba(0,0,0,.35);
}
/* Hub FAB lives on the LEFT so it never covers Pronty (bacchetta) / Preventivo on the right. */
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
/* While Pronty sheet is open, hide Hub so it does not fight the sheet/FABs. */
body.pv-magic-open #pv-plat-fab {
  opacity: 0 !important; pointer-events: none !important; visibility: hidden !important;
}
body.pv-plat-open #pv-offline-chip {
  bottom: calc(78px + env(safe-area-inset-bottom, 0px)) !important;
}
#pv-plat-panel {
  position: fixed; z-index: 120150; inset: auto 0 0 0;
  max-height: min(88vh, 920px);
  background: var(--pv-plat-bg); color: var(--pv-plat-ink);
  border-radius: 20px 20px 0 0; box-shadow: var(--pv-plat-shadow);
  padding: 12px 14px calc(16px + env(safe-area-inset-bottom));
  overflow: auto; display: none;
  transform: translateY(12px); opacity: 0;
  transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease;
  will-change: transform, opacity;
  contain: layout style;
}
#pv-plat-panel.open { display: block; transform: translateY(0); opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  #pv-plat-fab, #pv-plat-panel { transition: none !important; }
  #pv-plat-panel { transform: none; opacity: 1; }
}
#pv-plat-panel .pv-plat-head {
  display:flex; align-items:center; gap:8px; margin-bottom:10px;
}
#pv-plat-panel .pv-plat-head strong { flex:1; font:700 16px/1.2 Georgia, "Times New Roman", serif; }
#pv-plat-panel .pv-plat-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
#pv-plat-panel .pv-plat-tabs button, .pv-plat-btn {
  border:1px solid var(--pv-plat-border); background: var(--pv-plat-card);
  color: var(--pv-plat-ink); border-radius: 999px; padding: 8px 12px;
  font: 600 12px/1.2 system-ui,sans-serif; cursor:pointer; min-height:40px;
}
#pv-plat-panel .pv-plat-tabs button.on { background: var(--pv-plat-accent); color:#fff; border-color: transparent; }
.pv-plat-card {
  background: var(--pv-plat-card); border:1px solid var(--pv-plat-border);
  border-radius: 14px; padding: 12px 14px; margin-bottom: 10px;
}
.pv-plat-card h3 { margin:0 0 6px; font:700 14px/1.3 Georgia,serif; }
.pv-plat-muted { color: var(--pv-plat-muted); font: 400 12px/1.45 system-ui,sans-serif; }
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
@media (min-width: 860px) {
  #pv-plat-panel {
    inset: 72px auto auto 24px; width: min(440px, 92vw); max-height: calc(100vh - 96px);
    border-radius: 18px; bottom: auto;
  }
  #pv-plat-fab { bottom: 24px; left: 24px; right: auto; }
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
    const role = roleForTrip(trip);
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
    if (typeof window.__pvEnqueueTripWrite === "function") {
      return window.__pvEnqueueTripWrite(run);
    }
    return run();
  }

  /* ---------- UI shell ---------- */
  let activeTab = "dash";
  function ensureFab() {
    if (document.getElementById("pv-plat-fab")) return;
    const fab = document.createElement("button");
    fab.id = "pv-plat-fab";
    fab.type = "button";
    fab.title = "Hub Pronti? VIA!";
    fab.setAttribute("aria-label", "Apri hub piattaforma");
    fab.textContent = "Hub";
    fab.addEventListener("click", () => togglePanel());
    document.body.appendChild(fab);
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
    panel.classList.toggle("open", open);
    document.body.classList.toggle("pv-plat-open", open);
    const fab = document.getElementById("pv-plat-fab");
    if (fab) fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) void renderPanel();
  }
  async function renderPanel() {
    const panel = document.getElementById("pv-plat-panel");
    if (!panel) return;
    const tabs = [
      ["dash", "Dashboard"],
      ["polls", "Voti"],
      ["prep", "Preparazione"],
      ["stats", "Statistiche"],
      ["cal", "Calendario"],
      ["archive", "Archivio"],
      ["backup", "Backup"],
      ["settings", "Impostazioni"],
    ];
    panel.innerHTML = `
      <div class="pv-plat-head">
        <strong>Pronti? VIA! Hub</strong>
        <button type="button" class="pv-plat-btn" data-plat="close" aria-label="Chiudi">Chiudi</button>
      </div>
      <div class="pv-plat-tabs">${tabs
        .map(
          ([id, label]) =>
            `<button type="button" data-tab="${id}" class="${id === activeTab ? "on" : ""}">${label}</button>`
        )
        .join("")}</div>
      <div id="pv-plat-body"><p class="pv-plat-muted">Caricamento…</p></div>
    `;
    panel.querySelector("[data-plat=close]")?.addEventListener("click", () => togglePanel(false));
    panel.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        void renderPanel();
      });
    });
    const body = panel.querySelector("#pv-plat-body");
    try {
      if (activeTab === "dash") body.innerHTML = await renderDash();
      else if (activeTab === "polls") body.innerHTML = await renderPolls();
      else if (activeTab === "prep") body.innerHTML = await renderPrep();
      else if (activeTab === "stats") body.innerHTML = await renderStats();
      else if (activeTab === "cal") body.innerHTML = await renderCal();
      else if (activeTab === "archive") body.innerHTML = await renderArchive();
      else if (activeTab === "backup") body.innerHTML = await renderBackup();
      else body.innerHTML = renderSettings();
      wireBody(body);
    } catch (err) {
      body.innerHTML = `<div class="pv-plat-card"><p class="pv-plat-muted">${escapeHtml(
        err.message || "Errore"
      )}</p></div>`;
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
          <h3>Benvenuto</h3>
          <p class="pv-plat-muted">Non hai ancora viaggi. Crea il primo dalla home: destinazione, date e compagni.</p>
          <div class="pv-plat-actions">
            <button type="button" class="pv-plat-btn" data-plat="goto-new">Crea viaggio</button>
          </div>
        </div>`;
      }
      return `<div class="pv-plat-card"><h3>I tuoi viaggi</h3>
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
    if (openChecks) todos.push(`${openChecks} voci checklist aperte`);
    if (!bookings.length) todos.push("Nessuna prenotazione registrata");
    if (openPolls) todos.push(`${openPolls} votazioni aperte`);
    if (!(prep.departureChecklist || []).some((x) => x.done)) todos.push("Checklist partenza da completare");
    return `
      <div class="pv-plat-card">
        <h3>${escapeHtml(trip.title || "Viaggio")}</h3>
        <p class="pv-plat-muted">${escapeHtml(trip.destination || "Destinazione da definire")}</p>
        <div class="pv-plat-grid" style="margin-top:10px">
          <div class="pv-plat-stat"><b>${dLeft == null ? "—" : dLeft >= 0 ? dLeft + "g" : "via"}</b><span>Alla partenza</span></div>
          <div class="pv-plat-stat"><b>${duration || "—"}</b><span>Giorni</span></div>
          <div class="pv-plat-stat"><b>${members.length || 1}</b><span>Partecipanti</span></div>
          <div class="pv-plat-stat"><b>${euro(spent)}</b><span>Spese</span></div>
        </div>
        <p class="pv-plat-muted" style="margin-top:8px">Budget ${euro(budget)} · residuo ${euro(budget - spent)}</p>
      </div>
      <div class="pv-plat-card">
        <h3>Attività da completare</h3>
        <ul class="pv-plat-list">${(todos.length ? todos : ["Tutto in ordine per ora."])
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("")}</ul>
        <div class="pv-plat-actions">
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="prep">Preparazione</button>
          <button type="button" class="pv-plat-btn" data-plat="tab" data-to="polls">Votazioni</button>
          <button type="button" class="pv-plat-btn" data-plat="optimize">Ottimizza tappe</button>
          <a class="pv-plat-btn" style="text-decoration:none" href="./map.html" target="_blank" rel="noopener">Mappa</a>
        </div>
      </div>`;
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
                )}" data-opt="${escapeHtml(o.id)}" ${p.status !== "open" ? "disabled" : ""}>${escapeHtml(
                  o.label
                )} · ${(o.votes || []).length}</button></li>`
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
    const dep = prep.departureChecklist || defaultDeparture();
    const pack = ["Bagaglio principale", "Bagaglio a mano", "Documenti", "Elettronica", "Abbigliamento", "Igiene", "Farmaci"];
    const notes = trip.meta?.destinationNotes || {};
    return `
      <div class="pv-plat-card">
        <h3>Documenti</h3>
        <p class="pv-plat-muted">Link e note (i file restano nella tab Documenti; non finiscono nei link pubblici).</p>
        <ul class="pv-plat-list">${docs
          .map(
            (d) =>
              `<li><strong>${escapeHtml(d.title)}</strong> · ${escapeHtml(d.category || "")}
              ${d.url ? ` · <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">apri</a>` : ""}</li>`
          )
          .join("") || "<li>Nessun documento annotato.</li>"}</ul>
        <label class="pv-plat-muted">Titolo<input class="pv-plat-input" id="pv-doc-title" /></label>
        <label class="pv-plat-muted">Link<input class="pv-plat-input" id="pv-doc-url" placeholder="https://…" /></label>
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

  async function renderStats() {
    const auth = tripAuth();
    if (auth) {
      const { trip } = await fetchTrip();
      const spent = expenseCents(trip.expenses);
      const people = Math.max(1, (trip.members || []).length);
      const days = daysBetween(trip.start, trip.end) || 1;
      const byCat = {};
      for (const e of trip.expenses || []) {
        const cat = e.category || e.type || "altro";
        byCat[cat] = (byCat[cat] || 0) + Math.round((Number(e.amount) || 0) * 100);
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
      return `<div class="pv-plat-card">
        <h3>Statistiche viaggio</h3>
        <div class="pv-plat-grid">
          <div class="pv-plat-stat"><b>${euro(spent)}</b><span>Spesa</span></div>
          <div class="pv-plat-stat"><b>${euro(Math.round(spent / people))}</b><span>Per persona</span></div>
          <div class="pv-plat-stat"><b>${euro(Math.round(spent / days))}</b><span>Al giorno</span></div>
          <div class="pv-plat-stat"><b>${(trip.stops || []).length}</b><span>Tappe</span></div>
        </div>
        <div style="margin-top:10px">${bars || '<p class="pv-plat-muted">Nessuna spesa categorizzata.</p>'}</div>
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
      <h3 style="margin-top:12px">Nuovo promemoria</h3>
      <input class="pv-plat-input" id="pv-rem-title" placeholder="Titolo" />
      <input class="pv-plat-input" id="pv-rem-date" type="date" />
      <button type="button" class="pv-plat-btn" data-plat="rem-add">Salva promemoria</button>
      <button type="button" class="pv-plat-btn" data-plat="ics">Scarica ICS</button>
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
        <button type="button" class="pv-plat-btn" data-plat="mem-add">Aggiungi ricordo</button>
        <button type="button" class="pv-plat-btn" data-plat="archive-trip">Archivia viaggio concluso</button>
        <ul class="pv-plat-list">${memories
          .map((m) => `<li>${escapeHtml(m.text)} <span class="pv-plat-muted">${escapeHtml(m.at || "")}</span></li>`)
          .join("") || "<li>Nessun ricordo ancora.</li>"}</ul>
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

  async function renderBackup() {
    return `<div class="pv-plat-card">
      <h3>Backup e ripristino</h3>
      <p class="pv-plat-muted">Export indipendente da hosting/DB. Prima dell'import vedi un riepilogo; nessuna sovrascrittura cieca.</p>
      <div class="pv-plat-actions">
        <button type="button" class="pv-plat-btn" data-plat="backup-export">Scarica backup JSON</button>
      </div>
      <label class="pv-plat-muted">Importa file backup
        <input class="pv-plat-input" id="pv-backup-file" type="file" accept="application/json,.json" />
      </label>
      <pre id="pv-backup-summary" class="pv-plat-muted" style="white-space:pre-wrap"></pre>
      <button type="button" class="pv-plat-btn" data-plat="backup-apply" hidden>Applica merge sicuro</button>
    </div>`;
  }

  function renderSettings() {
    const theme = readJson(THEME_KEY, { mode: "system" }).mode || "system";
    const outbox =
      typeof window.__pvReadOutbox === "function" ? window.__pvReadOutbox() : readJson(OUTBOX_KEY, []);
    return `<div class="pv-plat-card">
      <h3>Aspetto</h3>
      <label class="pv-plat-muted">Tema
        <select class="pv-plat-input" id="pv-theme">
          <option value="system" ${theme === "system" ? "selected" : ""}>Sistema</option>
          <option value="light" ${theme === "light" ? "selected" : ""}>Chiaro</option>
          <option value="dark" ${theme === "dark" ? "selected" : ""}>Scuro</option>
        </select>
      </label>
      <button type="button" class="pv-plat-btn" data-plat="theme-save">Applica tema</button>
      <p class="pv-plat-muted" style="margin-top:10px">Versione hub ${VER} · online: ${
      navigator.onLine ? "sì" : "no"
    } · in coda sync: ${outbox.length}</p>
      <p class="pv-plat-muted">La coda riprova i PUT locali/falliti finché il server non conferma. Non dichiara sync senza conferma.</p>
      <button type="button" class="pv-plat-btn" data-plat="flush-outbox">Riprova sincronizzazione</button>
      <p class="pv-plat-muted" style="margin-top:10px"><strong>Ruoli:</strong> proprietario / amministratore / collaboratore / visualizzatore.
      Enforcement UI + header <code>X-Pronti-Member-Id</code>. Limite: con sola edit-key condivisa il server non può autenticare criptograficamente il membro senza tale header.</p>
    </div>`;
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
        showStatus("Tappe ottimizzate (modificabile)", "server");
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
      if (!title) return showStatus("Titolo documento obbligatorio", "error");
      try {
        await saveTripMeta((trip) => {
          trip.meta.preparation = trip.meta.preparation || {};
          trip.meta.preparation.docs = trip.meta.preparation.docs || [];
          trip.meta.preparation.docs.unshift({
            id: `doc-${Date.now().toString(36)}`,
            title,
            url,
            category,
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
        showStatus("Checklist bagagli aggiunta", "server");
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
        showStatus("Note destinazione salvate", "server");
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
      const rows = [["id", "title", "category", "amount", "paidBy"]];
      for (const e of trip.expenses || []) {
        rows.push([e.id || "", e.title || e.note || "", e.category || "", e.amount || "", e.paidBy || ""]);
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
      if (!text && !diary) return;
      try {
        await saveTripMeta((trip) => {
          trip.meta.archive = trip.meta.archive || { memories: [], diary: "" };
          trip.meta.archive.diary = diary.slice(0, 20000);
          if (text) {
            trip.meta.archive.memories = trip.meta.archive.memories || [];
            trip.meta.archive.memories.unshift({ text, at: new Date().toISOString() });
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
        showStatus("Viaggio archiviato", "server");
        void renderPanel();
      } catch (e) {
        showStatus(e.message, "error");
      }
    });
    body.querySelector("[data-plat=backup-export]")?.addEventListener("click", () => {
      const tripsDb = readJson("viavia-local-trips-v1", {});
      const trips = Object.values(tripsDb);
      const account = readJson("viavia-account-v1", null);
      const backup = {
        kind: "pronti-via-backup",
        schema: 1,
        exportedAt: new Date().toISOString(),
        app: "Pronti? VIA!",
        account: account?.user
          ? { username: account.user.username, displayName: account.user.displayName }
          : null,
        preferences: { theme: readJson(THEME_KEY, { mode: "system" }) },
        trips,
        localStores: {
          recent: readJson("viavia-recent-links-v1", []),
          archive: readJson(ARCHIVE_KEY, []),
        },
      };
      download(`pronti-via-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
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
        showStatus("Salvato e sincronizzato", "server");
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

  function boot() {
    injectCss();
    applyTheme();
    ensureFab();
    window.addEventListener("pv-save-status", (e) => onSaveEvent(e.detail));
    window.addEventListener("pv-outbox-changed", () => {
      /* badge refresh when settings open */
    });
    window.addEventListener("online", () => {
      showStatus("Di nuovo online — sincronizzazione…", "server");
      if (typeof window.__pvFlushOutbox === "function") void window.__pvFlushOutbox();
    });
    window.addEventListener("offline", () =>
      showStatus("Offline — le modifiche restano in coda locale", "local")
    );
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme());
    }
    window.ProntiPlatform = {
      ver: VER,
      optimizeStops,
      splitEqualCents,
      expenseCents,
      validateBackup,
      roleForTrip,
      canRole,
      open: () => togglePanel(true),
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
