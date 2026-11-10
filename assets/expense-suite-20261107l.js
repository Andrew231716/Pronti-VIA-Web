/**
 * Spese di gruppo — suite intuitiva:
 * meta FX originale, storico tassi, rimborsi multi-valuta, arrotondamenti,
 * template + scontrino, export CSV/PDF, valuta per membro, notifiche locali, offline FX.
 */
(() => {
  const META_KEY = "viavia-expense-fx-meta-v1";
  const FX_DISK_KEY = "viavia-fx-rate-disk-v1";
  const NOTIFY_KEY = "viavia-expense-notify-v1";
  const DOCK_DISMISS_KEY = "pv-es-dock-dismissed-v1";
  const STYLE_ID = "pv-expense-suite-style";
  const ASSET_VER = "20261107j";

  const TEMPLATES = [
    { id: "cena", title: "Cena", category: "Cibo", local: 0 },
    { id: "pranzo", title: "Pranzo", category: "Cibo", local: 0 },
    { id: "taxi", title: "Taxi / transfer", category: "Trasporto", local: 0 },
    { id: "alloggio", title: "Alloggio", category: "Alloggio", local: 0 },
    { id: "spesa", title: "Spesa supermercato", category: "Cibo", local: 0 },
    { id: "museo", title: "Biglietto / museo", category: "Altro", local: 0 },
    { id: "caffè", title: "Caffè / aperitivo", category: "Cibo", local: 0 },
  ];

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

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      return raw == null ? fallback : raw;
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

  function metaBag() {
    return readJson(META_KEY, {});
  }

  function tripMeta(tripId) {
    const db = metaBag();
    if (!db[tripId]) {
      db[tripId] = {
        expenses: {},
        transfers: {},
        memberCurrencies: {},
        pending: null,
        seenExpenseKeys: [],
      };
    }
    return db[tripId];
  }

  function saveTripMeta(tripId, meta) {
    const db = metaBag();
    db[tripId] = meta;
    writeJson(META_KEY, db);
  }

  function parseFxAmount(raw) {
    const n = Number(String(raw || "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function formatFxAmount(n, code) {
    if (!Number.isFinite(n)) return "";
    const digits = code === "JPY" || code === "ISK" || code === "HUF" || n >= 1000 ? 0 : 2;
    return n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  function formatEuro(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  }

  function formatMoney(amount, code) {
    try {
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: code || "EUR",
        maximumFractionDigits: code === "JPY" || code === "ISK" || code === "HUF" ? 0 : 2,
      }).format(amount);
    } catch {
      return `${formatFxAmount(amount, code)} ${code}`;
    }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.pv-es-dock-open{
        scroll-padding-bottom:calc(var(--pv-es-dock-h, 36vh) + 16px);
      }
      body.pv-es-dock-open .app-shell{
        padding-bottom:calc(var(--pv-es-dock-h, 36vh) + 24px) !important;
      }
      body.pv-es-dock-open .pv-prev-launch{
        bottom:calc(var(--pv-es-dock-h, 36vh) + 18px)!important;
        right:calc(14px + env(safe-area-inset-right,0px))!important;
      }
      body.pv-es-dock-open #pv-magic-root .pv-magic-btn{
        bottom:calc(var(--pv-es-dock-h, 36vh) + 86px)!important;
        right:calc(14px + env(safe-area-inset-right,0px))!important;
      }
      #pv-es-portal{overscroll-behavior:contain;max-height:min(36vh,360px)}
      #pv-es-portal[hidden]{display:none !important}
      #pv-es-portal .pv-es-dock-title{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        padding:0 0 8px;font:700 .78rem inherit;color:#007d82;letter-spacing:.02em;text-transform:uppercase
      }
      #pv-es-portal .pv-es-dock-title button{
        appearance:none;border:0;width:36px;height:36px;border-radius:999px;background:#eef5f5;
        color:#16353b;font:700 1.2rem/1 inherit;cursor:pointer
      }
      .pv-es-bar{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px;align-items:center}
      .pv-es-bar button,.pv-es-chip{
        appearance:none;border:1px solid #c9dbdb;background:#fff;color:#16353b;
        border-radius:999px;padding:8px 12px;font:600 .82rem inherit;cursor:pointer
      }
      .pv-es-bar button.primary{background:#007d82;border-color:#007d82;color:#fff}
      .pv-es-chip{background:#f3fafa}
      .pv-es-chip:hover{background:#e7f4f4}
      .pv-es-templates{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
      .pv-es-templates .pv-es-chip{font-size:.78rem;padding:6px 10px}
      .pv-es-receipt{display:grid;gap:8px;margin-top:4px}
      .pv-es-receipt input[type=file]{font:inherit;font-size:.82rem}
      .pv-es-receipt-preview{display:flex;gap:10px;align-items:center}
      .pv-es-receipt-preview img{width:56px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #d9e7e7}
      .pv-es-hint{margin:0;font-size:.78rem;color:#5b7076;line-height:1.35}
      .pv-es-local-tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.72rem;font-weight:700}
      .pv-es-member-fx{margin:12px 0;padding:12px 14px;border:1px solid #d9e7e7;border-radius:14px;background:#fff;display:grid;gap:8px}
      .pv-es-member-fx .row{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:8px;align-items:center}
      .pv-es-member-fx select{border:1px solid #c9dbdb;border-radius:10px;padding:8px 10px;font:inherit;background:#fff}
      .pv-es-export{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px}
      .pv-es-round{margin:6px 0 0;font-size:.78rem;color:#5b7076}
      .pv-es-notify{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
      .pv-es-offline-fx{font-size:.75rem;color:#7a4b00;background:#fff4e5;border-radius:8px;padding:4px 8px}
      .pv-expense-fx-rows{display:grid;gap:10px}
      .pv-expense-fx-row{display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:8px;align-items:center}
      .pv-expense-fx-row input{width:100%;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;font:600 1rem inherit;color:#16353b;background:#f7fbfb}
      .pv-expense-fx-row .code{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-transfer-fx{margin:0 0 10px;display:grid;gap:8px}
      label.field.pv-expense-amount-native-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    `;
    document.head.appendChild(style);
  }

  /* ---------- Offline / historical FX disk cache ---------- */
  function readFxDisk() {
    return readJson(FX_DISK_KEY, {});
  }

  function writeFxDisk(db) {
    writeJson(FX_DISK_KEY, db);
  }

  function diskKey(base, quote, asOf) {
    return `${String(base).toUpperCase()}:${String(quote).toUpperCase()}:${asOf || "latest"}`;
  }

  async function fetchRate(base, quote, asOf) {
    const from = String(base || "EUR").toUpperCase();
    const to = String(quote || "EUR").toUpperCase();
    if (from === to) return { rate: 1, provider: "identity", date: asOf || "", offline: false };
    const key = diskKey(from, to, asOf);
    const disk = readFxDisk();

    if (typeof window.__pvFetchExchangeRate === "function" && !asOf) {
      try {
        const hit = await window.__pvFetchExchangeRate(from, to);
        if (hit?.rate > 0) {
          disk[key] = { ...hit, savedAt: Date.now() };
          writeFxDisk(disk);
          return { ...hit, offline: false };
        }
      } catch {
        /* fall through */
      }
    }

    if (!navigator.onLine && disk[key]?.rate > 0) {
      return { ...disk[key], offline: true, provider: disk[key].provider || "cache" };
    }

    const day = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null;
    const providers = [];
    if (day) {
      providers.push(async () => {
        const data = await fetch(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/${from.toLowerCase()}.json`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const rate = Number(data?.[from.toLowerCase()]?.[to.toLowerCase()]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("hist-currency-api");
        return { rate, provider: "fawazahmed0-hist", date: day };
      });
      providers.push(async () => {
        const data = await fetch(
          `https://api.frankfurter.dev/v1/${day}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const rate = Number(data?.rates?.[to]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("hist-frankfurter");
        return { rate, provider: "frankfurter-hist", date: data?.date || day };
      });
    } else {
      providers.push(async () => {
        const data = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json());
        const rate = Number(data?.rates?.[to]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("er-api");
        return { rate, provider: "open.er-api", date: data?.time_last_update_utc || "" };
      });
      providers.push(async () => {
        const data = await fetch(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const rate = Number(data?.[from.toLowerCase()]?.[to.toLowerCase()]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("currency-api");
        return { rate, provider: "fawazahmed0", date: data?.date || "" };
      });
    }

    let lastErr;
    for (const run of providers) {
      try {
        const hit = await run();
        disk[key] = { ...hit, savedAt: Date.now() };
        // Also store as latest for offline reuse
        disk[diskKey(from, to, null)] = { ...hit, savedAt: Date.now() };
        writeFxDisk(disk);
        return { ...hit, offline: false };
      } catch (err) {
        lastErr = err;
      }
    }

    if (disk[key]?.rate > 0) return { ...disk[key], offline: true };
    const latest = disk[diskKey(from, to, null)];
    if (latest?.rate > 0) return { ...latest, offline: true };
    throw lastErr || new Error("fx-unavailable");
  }

  /* Prefetch common rates when online so offline trips stay usable */
  async function warmFxCache(localCode, homeCode) {
    if (!navigator.onLine) return;
    const pairs = [
      ["EUR", localCode],
      [homeCode, localCode],
      ["EUR", homeCode],
    ];
    for (const [a, b] of pairs) {
      if (!a || !b || a === b) continue;
      try {
        await fetchRate(a, b, null);
      } catch {
        /* ignore */
      }
    }
  }

  /* ---------- Notifications ---------- */
  function notifyEnabled() {
    return Boolean(readJson(NOTIFY_KEY, { on: false }).on);
  }

  function setNotifyEnabled(on) {
    writeJson(NOTIFY_KEY, { on: Boolean(on) });
  }

  async function ensureNotifyPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }

  function notifyExpense(title, body) {
    if (!notifyEnabled() || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: "./logo.png",
        tag: "pv-expense",
      });
      setTimeout(() => n.close(), 6000);
    } catch {
      /* ignore */
    }
  }

  /* ---------- Fair rounding (Splitpay-style) ---------- */
  function fairSplitCents(totalCents, memberIds) {
    const n = memberIds.length || 1;
    const base = Math.floor(totalCents / n);
    let rem = totalCents - base * n;
    return memberIds.map((id, i) => ({
      member: id,
      amount: base + (i < rem ? 1 : 0),
    }));
  }

  function roundingHint(totalCents, count) {
    if (!count || count < 2) return "";
    const base = Math.floor(totalCents / count);
    const rem = totalCents - base * count;
    if (!rem) return `Divisione precisa: ${formatEuro(base)} a testa.`;
    return `Arrotondamento equo: ${count - rem} persone a ${formatEuro(base)}, ${rem} a ${formatEuro(
      base + 1
    )} (i centesimi residui vanno ai primi della lista).`;
  }

  /* ---------- Parse FX tag from title ---------- */
  function parseFxTag(title) {
    const m = String(title || "").match(
      /\(([0-9]+(?:[.,][0-9]+)?)\s*([A-Z]{3})(?:\s*@\s*([0-9]+(?:[.,][0-9]+)?))?\)\s*$/
    );
    if (!m) return null;
    return {
      localAmount: parseFxAmount(m[1]),
      localCode: m[2],
      rate: m[3] ? parseFxAmount(m[3]) : null,
    };
  }

  /* ---------- Portal outside React #root ---------- */
  function isDockDismissed() {
    try {
      if (sessionStorage.getItem("pv-es-dock-closed-v1") === "1") return true;
    } catch {
      /* private mode */
    }
    const d = readJson(DOCK_DISMISS_KEY, {});
    return Boolean(d.dismissed || d["*"]);
  }

  function ensureDockStartsClosed() {
    if (!tripAuth()) return;
    try {
      if (sessionStorage.getItem("pv-es-dock-autohide-v1") === "1") return;
      sessionStorage.setItem("pv-es-dock-autohide-v1", "1");
    } catch {
      /* private mode */
    }
    const d = readJson(DOCK_DISMISS_KEY, {});
    if (d.dismissed || d["*"]) return;
    d.dismissed = Date.now();
    d["*"] = Date.now();
    writeJson(DOCK_DISMISS_KEY, d);
  }

  function expensePortal() {
    let host = document.getElementById("pv-es-portal");
    if (!host) {
      host = document.createElement("div");
      host.id = "pv-es-portal";
      host.hidden = true;
      host.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:121000;max-height:min(36vh,360px);overflow:auto;background:#fff;border:2px solid #007d82;border-radius:18px;box-shadow:0 16px 40px rgba(15,45,50,.22);padding:12px 14px";
      document.body.appendChild(host);
    }
    ensureDockChrome(host);
    return host;
  }

  function ensureDockChrome(host) {
    if (host.querySelector(".pv-es-dock-title")) return;
    const title = document.createElement("div");
    title.className = "pv-es-dock-title";
    title.innerHTML = `<span>Novità · strumenti spese</span><button type="button" aria-label="Chiudi strumenti" data-es-close>×</button>`;
    title.querySelector("[data-es-close]")?.addEventListener("click", () => dismissDock());
    host.insertBefore(title, host.firstChild);
  }

  function placeExpensePortal() {
    const host = document.getElementById("pv-es-portal");
    if (!host || host.hidden) {
      if (!document.body.classList.contains("pv-as-dock-open")) {
        document.documentElement.style.removeProperty("--pv-es-dock-h");
      }
      return;
    }
    const tabs = document.querySelector("[role=tablist]");
    const tabBox = tabs?.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    let bottomPad = 10;
    if (tabBox && tabBox.bottom > vh * 0.55 && tabBox.top < vh && tabBox.height > 20) {
      bottomPad = Math.min(Math.floor(vh * 0.28), Math.max(10, Math.ceil(vh - tabBox.top + 8)));
    }
    host.style.bottom = `calc(${bottomPad}px + env(safe-area-inset-bottom,0px))`;
    const h = Math.ceil(host.getBoundingClientRect().height) || Math.floor(vh * 0.32);
    document.documentElement.style.setProperty("--pv-es-dock-h", `${h + bottomPad}px`);
  }

  function animateDockIn(host) {
    if (!host) return;
    clearTimeout(host._dockOutT);
    // Already visible — do not restart enter transition (that caused the pulse).
    if (!host.hidden && host.classList.contains("pv-dock-in")) return;
    host.hidden = false;
    host.classList.remove("pv-dock-in");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => host.classList.add("pv-dock-in"));
    });
  }

  function animateDockOut(host) {
    if (!host) return;
    if (host.hidden && !host.classList.contains("pv-dock-in")) return;
    host.classList.remove("pv-dock-in");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    clearTimeout(host._dockOutT);
    if (reduce) {
      host.hidden = true;
      return;
    }
    host._dockOutT = setTimeout(() => {
      host.hidden = true;
    }, 220);
  }

  function syncExpenseDockClass(open) {
    const host = document.getElementById("pv-es-portal") || (open ? expensePortal() : null);
    const wasOpen = document.body.classList.contains("pv-es-dock-open") && host && !host.hidden;
    document.body.classList.toggle("pv-es-dock-open", Boolean(open));
    if (open && host) {
      if (!wasOpen) animateDockIn(host);
      else {
        host.hidden = false;
        host.classList.add("pv-dock-in");
      }
      placeExpensePortal();
    } else {
      if (host) host.style.bottom = "calc(10px + env(safe-area-inset-bottom,0px))";
      if (!document.body.classList.contains("pv-as-dock-open")) {
        document.documentElement.style.removeProperty("--pv-es-dock-h");
      }
      document.body.classList.remove("pv-es-dock-open");
      if (wasOpen) animateDockOut(host);
      else if (host) {
        host.hidden = true;
        host.classList.remove("pv-dock-in");
      }
    }
  }

  function dismissDock() {
    try {
      sessionStorage.setItem("pv-es-dock-closed-v1", "1");
    } catch {
      /* private mode */
    }
    writeJson(DOCK_DISMISS_KEY, { dismissed: Date.now(), "*": Date.now() });
    syncExpenseDockClass(false);
    document.documentElement.style.removeProperty("--pv-es-dock-h");
  }

  function reopenDock() {
    if (!expensesSectionVisible()) return false;
    try {
      sessionStorage.removeItem("pv-es-dock-closed-v1");
    } catch {
      /* private mode */
    }
    writeJson(DOCK_DISMISS_KEY, {});
    // Close the other tools dock so only one sheet is visible.
    try {
      window.__pvAppSuite?.dismissDock?.();
    } catch {
      /* ignore */
    }
    const host = expensePortal();
    ensureToolbarMounted(host);
    syncExpenseDockClass(true);
    placeExpensePortal();
    return Boolean(document.body.classList.contains("pv-es-dock-open"));
  }

  function expensesSectionVisible() {
    // Only the active tab — React keeps other tab panels in the DOM, so heading
    // lookups would keep the Spese dock stuck open over Itinerario/cover.
    const tab = document.querySelector('[role=tab][data-state=active], [role=tab][aria-selected="true"]');
    const label = (tab?.textContent || "").trim().toLowerCase();
    return /spese/.test(label);
  }

  /* ---------- Toolbar: export / notify / member currencies ---------- */
  function expensesHost() {
    // Prefer portal host — never inject into React-managed parents.
    if (!expensesSectionVisible()) return null;
    return expensePortal();
  }

  function ensureToolbarMounted(host) {
    if (host.querySelector(".pv-es-bar")) {
      refreshOnlineHint();
      return;
    }
    const bar = document.createElement("div");
    bar.className = "pv-es-bar";
    bar.innerHTML = `
      <button type="button" class="primary" data-es="export-csv">Esporta CSV</button>
      <button type="button" data-es="export-pdf">Esporta riepilogo</button>
      <button type="button" data-es="members-fx">Valute compagni</button>
      <button type="button" data-es="notify">${notifyEnabled() ? "Notifiche on" : "Attiva notifiche"}</button>
      <span class="pv-es-hint" id="pv-es-online-hint"></span>
    `;
    const title = host.querySelector(".pv-es-dock-title");
    if (title) title.insertAdjacentElement("afterend", bar);
    else host.insertAdjacentElement("afterbegin", bar);
    bar.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-es]");
      if (!btn) return;
      const act = btn.getAttribute("data-es");
      if (act === "export-csv") void exportCsv();
      if (act === "export-pdf") void exportPdf();
      if (act === "members-fx") injectMemberCurrencyPanel(true);
      if (act === "notify") void toggleNotify(btn);
    });
    refreshOnlineHint();
  }

  function injectToolbar() {
    if (!expensesSectionVisible()) {
      if (document.body.classList.contains("pv-es-dock-open")) syncExpenseDockClass(false);
      return;
    }
    const host = expensePortal();
    ensureToolbarMounted(host);
    // Closed by default — open only from Menu → Strumenti (or reopenDock).
    if (isDockDismissed()) {
      if (document.body.classList.contains("pv-es-dock-open")) syncExpenseDockClass(false);
      return;
    }
    // Already open: don't re-trigger enter animation every MutationObserver tick.
    if (!document.body.classList.contains("pv-es-dock-open")) syncExpenseDockClass(true);
    else placeExpensePortal();
  }

  function refreshOnlineHint() {
    const el = document.querySelector("#pv-es-online-hint");
    if (!el) return;
    if (navigator.onLine) {
      el.textContent = "Tassi aggiornabili · spese e saldi funzionano anche offline";
      el.classList.remove("pv-es-offline-fx");
    } else {
      el.textContent = "Offline: usiamo l’ultimo tasso salvato su questo dispositivo";
      el.classList.add("pv-es-offline-fx");
    }
  }

  async function toggleNotify(btn) {
    if (notifyEnabled()) {
      setNotifyEnabled(false);
      btn.textContent = "Attiva notifiche";
      return;
    }
    const ok = await ensureNotifyPermission();
    if (!ok) {
      btn.textContent = "Notifiche bloccate";
      return;
    }
    setNotifyEnabled(true);
    btn.textContent = "Notifiche on";
    notifyExpense("Notifiche attive", "Ti avviseremo quando aggiungi o vedi nuove spese su questo dispositivo.");
  }

  function currencyOptions(selected) {
    const opts = [
      "EUR",
      "USD",
      "GBP",
      "CHF",
      "ETB",
      "ISK",
      "NOK",
      "SEK",
      "DKK",
      "JPY",
      "CAD",
      "AUD",
      "TRY",
      "THB",
      "INR",
      "BRL",
      "MXN",
      "ZAR",
      "AED",
      "KES",
      "EGP",
      "MAD",
    ];
    const sel = String(selected || "EUR").toUpperCase();
    if (!opts.includes(sel)) opts.unshift(sel);
    return opts
      .map((c) => `<option value="${c}"${c === sel ? " selected" : ""}>${c}</option>`)
      .join("");
  }

  function injectMemberCurrencyPanel(forceOpen) {
    const host = expensesHost();
    if (!host) return;
    let panel = host.querySelector(".pv-es-member-fx");
    if (panel && !forceOpen) return;
    if (panel && forceOpen) {
      panel.hidden = !panel.hidden;
      return;
    }
    const auth = tripAuth();
    if (!auth) return;
    void (async () => {
      let members = [];
      try {
        const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
          headers: { Authorization: `Bearer ${auth.key}` },
          cache: "no-store",
        });
        const data = await res.json();
        members = data?.trip?.members || [];
        const localCode =
          (typeof window.__pvResolveTripLocalCurrency === "function"
            ? await window.__pvResolveTripLocalCurrency(data.trip)
            : null)?.code || "EUR";
        const home =
          (typeof window.__pvHomeCurrency === "function" ? window.__pvHomeCurrency() : null) || {
            code: "EUR",
          };
        void warmFxCache(localCode, home.code);
      } catch {
        members = [];
      }
      if (!members.length) return;
      const meta = tripMeta(auth.id);
      panel = document.createElement("div");
      panel.className = "pv-es-member-fx";
      panel.innerHTML = `
        <strong>Valuta di casa per ciascun compagno</strong>
        <p class="pv-es-hint">Utile se siete di paesi diversi: i saldi restano in euro, ma vedi anche l’equivalente nella valuta di ciascuno.</p>
        ${members
          .map((m) => {
            const cur = meta.memberCurrencies?.[m.id]?.code || "EUR";
            return `<div class="row"><span>${escapeHtml(m.name)}</span>
              <select data-member="${escapeHtml(m.id)}" aria-label="Valuta di ${escapeHtml(m.name)}">${currencyOptions(
                cur
              )}</select></div>`;
          })
          .join("")}
      `;
      const bar = host.querySelector(".pv-es-bar");
      if (bar) bar.insertAdjacentElement("afterend", panel);
      else host.insertBefore(panel, host.firstChild);
      panel.addEventListener("change", (ev) => {
        const sel = ev.target?.closest?.("select[data-member]");
        if (!sel) return;
        const id = sel.getAttribute("data-member");
        meta.memberCurrencies[id] = { code: sel.value, name: sel.value };
        saveTripMeta(auth.id, meta);
        enrichExpenseList();
        enrichBalances();
      });
    })();
  }

  async function loadTripData() {
    const auth = tripAuth();
    if (!auth) return null;
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "trip");
    return { auth, trip: data.trip, revision: data.revision };
  }

  async function exportCsv() {
    try {
      const { auth, trip } = await loadTripData();
      const meta = tripMeta(auth.id);
      const localFx =
        typeof window.__pvResolveTripLocalCurrency === "function"
          ? await window.__pvResolveTripLocalCurrency(trip)
          : null;
      const rows = [["Titolo", "Data", "Pagato da", "Categoria", "EUR", "Valuta locale", "Importo locale", "Tasso", "Quote"]];
      const nameOf = (id) => trip.members.find((m) => m.id === id)?.name || id;
      for (const e of trip.expenses || []) {
        const tag = parseFxTag(e.title) || meta.expenses[e.id] || {};
        const localCode = tag.localCode || localFx?.code || "";
        const euros = window.ProntiPlatform.expenseAmountCents(e) / 100;
        const localAmount = tag.localAmount ?? (tag.rate ? euros * tag.rate : "");
        rows.push([
          String(e.title || "").replace(/\s*\([0-9].*$/, ""),
          e.date || "",
          nameOf(e.payer),
          e.category || "",
          euros.toFixed(2),
          localCode,
          localAmount === "" ? "" : String(localAmount),
          tag.rate || meta.expenses[e.id]?.rateLocalPerEur || "",
          (e.shares || []).map((s) => `${nameOf(s.member)} ${((s.amount || 0) / 100).toFixed(2)}`).join(" | "),
        ]);
      }
      rows.push([]);
      rows.push(["Rimborsi"]);
      rows.push(["Da", "A", "EUR", "Data"]);
      for (const t of trip.transfers || []) {
        rows.push([nameOf(t.from), nameOf(t.to), ((t.amount || 0) / 100).toFixed(2), t.date || ""]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      downloadBlob(csv, `spese-${(trip.title || "viaggio").replace(/\s+/g, "-")}.csv`, "text/csv;charset=utf-8");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export non riuscito");
    }
  }

  async function exportPdf() {
    try {
      const { auth, trip } = await loadTripData();
      const meta = tripMeta(auth.id);
      const nameOf = (id) => trip.members.find((m) => m.id === id)?.name || id;
      const lines = [];
      lines.push(`<h1>Spese di gruppo — ${escapeHtml(trip.title)}</h1>`);
      lines.push(`<p>${escapeHtml(trip.destination || "")} · ${escapeHtml(trip.start)} → ${escapeHtml(trip.end)}</p>`);
      lines.push("<h2>Spese</h2><ul>");
      for (const e of trip.expenses || []) {
        const tag = parseFxTag(e.title) || meta.expenses[e.id] || {};
        const local =
          tag.localAmount && tag.localCode
            ? ` · ${escapeHtml(String(tag.localAmount))} ${escapeHtml(tag.localCode)}`
            : "";
        lines.push(
          `<li><strong>${escapeHtml(String(e.title || "").replace(/\s*\([0-9].*$/, ""))}</strong> — ${formatEuro(
            e.amount
          )}${local} · pagato da ${escapeHtml(nameOf(e.payer))} · ${escapeHtml(e.date || "")}</li>`
        );
      }
      lines.push("</ul><h2>Rimborsi</h2><ul>");
      for (const t of trip.transfers || []) {
        lines.push(
          `<li>${escapeHtml(nameOf(t.from))} → ${escapeHtml(nameOf(t.to))}: ${formatEuro(t.amount)} · ${escapeHtml(
            t.date || ""
          )}</li>`
        );
      }
      lines.push("</ul>");
      const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Spese</title>
        <style>body{font:14px/1.45 system-ui,sans-serif;padding:24px;color:#16353b}h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:1.4em}</style>
        </head><body>${lines.join("\n")}<script>onload=()=>print()<\/script></body></html>`;
      const w = window.open("", "_blank");
      if (!w) {
        downloadBlob(html, "spese-riepilogo.html", "text/html;charset=utf-8");
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export non riuscito");
    }
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- Expense form extras: templates, receipt, historical rate, rounding ---------- */
  function findExpenseFormHost() {
    const heading = [...document.querySelectorAll("h2,h3,h4")].find((h) =>
      /Aggiungi una spesa|Modifica spesa/i.test(h.textContent || "")
    );
    if (heading) {
      const shell =
        heading.closest("form") ||
        heading.closest("[role='dialog']") ||
        heading.closest("section") ||
        heading.parentElement;
      if (shell) return shell;
    }
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in|^Importo della spesa/i.test((span.textContent || "").trim());
    });
    return amountLabel?.closest("form") || amountLabel?.closest(".form-grid")?.parentElement || null;
  }

  function setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function enhanceExpenseFormExtras() {
    const form = findExpenseFormHost();
    if (!form || form.dataset.pvEsExtras) return;
    const titleLabel = [...form.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /Per cosa avete speso/i.test((span.textContent || "").trim());
    });
    if (!titleLabel) return;
    form.dataset.pvEsExtras = "1";

    const templates = document.createElement("div");
    templates.className = "pv-es-templates";
    templates.innerHTML = `<span class="pv-es-hint" style="width:100%">Scorciatoie:</span>${TEMPLATES.map(
      (t) => `<button type="button" class="pv-es-chip" data-tpl="${t.id}">${escapeHtml(t.title)}</button>`
    ).join("")}`;
    titleLabel.insertAdjacentElement("beforebegin", templates);
    templates.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-tpl]");
      if (!btn) return;
      const tpl = TEMPLATES.find((t) => t.id === btn.getAttribute("data-tpl"));
      if (!tpl) return;
      const titleInput = titleLabel.querySelector("input");
      if (titleInput) setNativeInputValue(titleInput, tpl.title);
      const catSelect = [...form.querySelectorAll("label.field")].find((label) => {
        const span = label.querySelector(":scope > span");
        return span && /^Categoria/i.test((span.textContent || "").trim());
      })?.querySelector("select,button,[role=combobox]");
      // Best-effort: click matching category option if native select
      const select = [...form.querySelectorAll("select")].find((s) =>
        [...s.options].some((o) => o.value === tpl.category || o.textContent === tpl.category)
      );
      if (select) {
        select.value = [...select.options].find((o) => o.value === tpl.category || o.textContent === tpl.category)?.value || select.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      void catSelect;
    });

    const fxBox = form.querySelector(".pv-expense-fx");
    const receipt = document.createElement("div");
    receipt.className = "field pv-es-receipt";
    receipt.innerHTML = `
      <span>Scontrino (opzionale, resta su questo dispositivo)</span>
      <input type="file" accept="image/*,application/pdf" id="pv-es-receipt-file" />
      <div class="pv-es-receipt-preview" id="pv-es-receipt-preview" hidden></div>
      <p class="pv-es-hint">La foto non viene caricata sul cloud: utile come promemoria offline.</p>
    `;
    (fxBox || titleLabel).insertAdjacentElement("afterend", receipt);
    const fileInput = receipt.querySelector("#pv-es-receipt-file");
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      const preview = receipt.querySelector("#pv-es-receipt-preview");
      if (!file || !preview) return;
      if (file.size > 1.8e6) {
        alert("Scegli un’immagine sotto i 1,5 MB.");
        fileInput.value = "";
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      preview.hidden = false;
      preview.innerHTML = file.type.startsWith("image/")
        ? `<img src="${dataUrl}" alt="Scontrino" /><span class="pv-es-hint">${escapeHtml(file.name)}</span>`
        : `<span class="pv-es-hint">PDF allegato: ${escapeHtml(file.name)}</span>`;
      preview.dataset.receipt = dataUrl;
      preview.dataset.receiptName = file.name;
      preview.dataset.receiptType = file.type;
    });

    // Historical rate: when date changes, refresh rates used by FX box if possible
    const dateInput = [...form.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Data$/i.test((span.textContent || "").trim());
    })?.querySelector("input[type=date],input");
    if (dateInput && !dateInput.dataset.pvEsDateBound) {
      dateInput.dataset.pvEsDateBound = "1";
      dateInput.addEventListener("change", () => {
        void refreshHistoricalRateHint(form, dateInput.value);
      });
      void refreshHistoricalRateHint(form, dateInput.value);
    }

    injectRoundingHint(form);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  async function refreshHistoricalRateHint(form, isoDate) {
    const hint = form.querySelector("#pv-expense-fx-hint");
    const state = window.__pvExpenseFxState;
    if (!hint || !state?.localCode || state.localCode === "EUR") return;
    const day = String(isoDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    try {
      const fx = await fetchRate("EUR", state.localCode, day);
      const digits = fx.rate >= 100 ? 0 : 2;
      const offline = fx.offline ? " · da cache offline" : "";
      const badge = form.querySelector("#pv-es-hist-rate") || document.createElement("p");
      badge.id = "pv-es-hist-rate";
      badge.className = "pv-es-hint";
      badge.textContent = `Tasso del ${day}: 1 EUR = ${fx.rate.toLocaleString("it-IT", {
        maximumFractionDigits: digits,
      })} ${state.localCode}${offline}`;
      if (!badge.parentElement) hint.insertAdjacentElement("afterend", badge);
      // Update live conversion to historical rate when online result available
      if (typeof window.__pvSetExpenseFxRate === "function") {
        window.__pvSetExpenseFxRate(fx.rate, day);
      } else {
        state.rateLocalPerEur = fx.rate;
        state.rateDate = day;
      }
    } catch {
      /* keep latest */
    }
  }

  function injectRoundingHint(form) {
    if (form.querySelector(".pv-es-round")) return;
    const update = () => {
      const amountLabel = [...form.querySelectorAll("label.field")].find((label) => {
        const span = label.querySelector(":scope > span");
        return span && /^Totale in/i.test((span.textContent || "").trim());
      });
      const native = amountLabel?.querySelector("input");
      const eur = parseFxAmount(native?.value);
      const checked = [...form.querySelectorAll('input[type=checkbox]')].filter((c) => c.checked);
      // Fallback: count participant rows in split UI
      const people =
        checked.length ||
        [...form.querySelectorAll(".share-inputs, .split-detail, label")].filter((el) =>
          /€|quote|%/i.test(el.textContent || "")
        ).length ||
        2;
      let box = form.querySelector(".pv-es-round");
      if (!box) {
        box = document.createElement("p");
        box.className = "pv-es-round";
        const splitLabel = [...form.querySelectorAll("label.field")].find((label) => {
          const span = label.querySelector(":scope > span");
          return span && /Come dividiamo/i.test((span.textContent || "").trim());
        });
        (splitLabel || amountLabel)?.insertAdjacentElement("afterend", box);
      }
      if (eur == null) {
        box.textContent = "";
        return;
      }
      box.textContent = roundingHint(Math.round(eur * 100), Math.max(people, 2));
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    setTimeout(update, 300);
  }

  /* ---------- Persist FX meta on submit ---------- */
  function capturePendingExpenseMeta() {
    const auth = tripAuth();
    if (!auth) return;
    const state = window.__pvExpenseFxState || {};
    const localInput = document.querySelector("#pv-expense-local");
    const homeInput = document.querySelector("#pv-expense-home");
    const titleLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /Per cosa avete speso/i.test((span.textContent || "").trim());
    });
    const title = titleLabel?.querySelector("input")?.value || "";
    const dateLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Data$/i.test((span.textContent || "").trim());
    });
    const date = dateLabel?.querySelector("input")?.value || "";
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    });
    const eur = parseFxAmount(amountLabel?.querySelector("input")?.value);
    const localAmt = parseFxAmount(localInput?.value);
    const homeAmt = parseFxAmount(homeInput?.value);
    const preview = document.querySelector("#pv-es-receipt-preview");
    const meta = tripMeta(auth.id);
    meta.pending = {
      title: title.replace(/\s*\([0-9].*$/, "").trim(),
      date,
      eurCents: eur != null ? Math.round(eur * 100) : null,
      localCode: state.localCode || null,
      localAmount: localAmt,
      homeCode: state.homeCode || "EUR",
      homeAmount: homeAmt,
      rateLocalPerEur: state.rateLocalPerEur || null,
      rateDate: state.rateDate || date || new Date().toISOString().slice(0, 10),
      receipt: preview?.dataset?.receipt || null,
      receiptName: preview?.dataset?.receiptName || null,
      at: Date.now(),
    };
    saveTripMeta(auth.id, meta);

    // Enrich title tag with rate for cross-device readability
    const titleInput = titleLabel?.querySelector("input");
    if (titleInput && localAmt != null && state.localCode && state.localCode !== "EUR") {
      const rate = state.rateLocalPerEur;
      const tag =
        rate && rate > 0
          ? `(${formatFxAmount(localAmt, state.localCode)} ${state.localCode} @ ${Number(rate).toFixed(
              rate >= 100 ? 1 : 4
            )})`
          : `(${formatFxAmount(localAmt, state.localCode)} ${state.localCode})`;
      const cleaned = titleInput.value.replace(/\s*\([0-9]+(?:[.,][0-9]+)?\s*[A-Z]{3}[^)]*\)\s*$/, "").trim();
      if (!new RegExp(`\\b${state.localCode}\\b`).test(cleaned)) {
        setNativeInputValue(titleInput, `${cleaned} ${tag}`);
      } else if (!/@/.test(titleInput.value) && rate) {
        setNativeInputValue(titleInput, `${cleaned} ${tag}`);
      }
    }
  }

  async function settlePendingExpenseMeta() {
    const auth = tripAuth();
    if (!auth) return;
    const meta = tripMeta(auth.id);
    if (!meta.pending) return;
    try {
      const { trip } = await loadTripData();
      const pending = meta.pending;
      const match = [...(trip.expenses || [])].reverse().find((e) => {
        const t = String(e.title || "").replace(/\s*\([0-9].*$/, "").trim();
        return (
          t === pending.title &&
          (pending.eurCents == null || e.amount === pending.eurCents) &&
          (!pending.date || e.date === pending.date)
        );
      });
      if (match) {
        meta.expenses[match.id] = {
          localCode: pending.localCode,
          localAmount: pending.localAmount,
          homeCode: pending.homeCode,
          homeAmount: pending.homeAmount,
          rateLocalPerEur: pending.rateLocalPerEur,
          rateDate: pending.rateDate,
          receipt: pending.receipt,
          receiptName: pending.receiptName,
        };
        const key = `${match.id}:${match.amount}:${match.date}`;
        if (!meta.seenExpenseKeys.includes(key)) {
          meta.seenExpenseKeys = [key, ...meta.seenExpenseKeys].slice(0, 200);
          notifyExpense(
            "Spesa salvata",
            `${match.title.replace(/\s*\([0-9].*$/, "")} · ${formatEuro(match.amount)}`
          );
        }
        meta.pending = null;
        saveTripMeta(auth.id, meta);
      }
    } catch {
      /* ignore */
    }
  }

  /* ---------- Enrich list & balances ---------- */
  function enrichExpenseList() {
    const auth = tripAuth();
    if (!auth) return;
    const meta = tripMeta(auth.id);
    const items = document.querySelectorAll(".expense-columns li, .expense-list li, [class*='expense'] li");
    const candidates =
      items.length > 0
        ? items
        : [...document.querySelectorAll("li, article, .card")].filter((el) =>
            /€|EUR/.test(el.textContent || "")
          );
    for (const el of candidates) {
      if (el.querySelector(".pv-es-local-tag")) continue;
      const text = el.textContent || "";
      const tag = parseFxTag(text);
      let info = tag;
      if (!info) {
        // try match by title against meta
        for (const [id, fx] of Object.entries(meta.expenses || {})) {
          if (fx.localCode && fx.localAmount != null && text.includes(String(fx.localAmount))) {
            info = fx;
            void id;
            break;
          }
        }
      }
      if (!info?.localCode || !info.localAmount) continue;
      if (info.localCode === "EUR") continue;
      const strong = el.querySelector("strong, h3, h4") || el;
      const span = document.createElement("span");
      span.className = "pv-es-local-tag";
      span.textContent = `${formatFxAmount(info.localAmount, info.localCode)} ${info.localCode}`;
      strong.appendChild(span);
      if (meta.expenses) {
        const withReceipt = Object.values(meta.expenses).find(
          (fx) => fx.receipt && fx.localAmount === info.localAmount && fx.localCode === info.localCode
        );
        if (withReceipt?.receipt && !el.querySelector(".pv-es-receipt-link")) {
          const a = document.createElement("button");
          a.type = "button";
          a.className = "pv-es-chip pv-es-receipt-link";
          a.textContent = "Scontrino";
          a.addEventListener("click", () => {
            const w = window.open("");
            if (!w) return;
            if (String(withReceipt.receipt).startsWith("data:image")) {
              w.document.write(
                `<img src="${withReceipt.receipt}" style="max-width:100%" alt="Scontrino" />`
              );
            } else {
              w.location.href = withReceipt.receipt;
            }
          });
          el.appendChild(a);
        }
      }
    }
  }

  /* ---------- Transfer / rimborso dual currency ---------- */
  let transferFxState = null;

  function enhanceTransferCurrencyField() {
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      const t = (span?.textContent || "").trim();
      return /^Importo/i.test(t) && !label.closest(".pv-expense-fx") && !label.closest(".pv-transfer-fx");
    });
    // Prefer rimborso forms: look for "Chi paga" / "Chi riceve" nearby
    const forms = [...document.querySelectorAll("form")].filter((f) =>
      /rimbors|chi paga|chi riceve|da chi|a chi/i.test(f.textContent || "")
    );
    const form =
      forms.find((f) => f.querySelector("label.field span") && /Importo|Totale/i.test(f.textContent || "")) ||
      null;
    if (!form || form.querySelector(".pv-transfer-fx")) return;
    const label =
      [...form.querySelectorAll("label.field")].find((l) =>
        /^Importo|^Totale/i.test((l.querySelector(":scope > span")?.textContent || "").trim())
      ) || amountLabel;
    if (!label || !form.contains(label)) return;

    void (async () => {
      const auth = tripAuth();
      if (!auth) return;
      let localFx = null;
      let home = { code: "EUR", name: "Euro" };
      let rateLocalPerEur = 1;
      let rateLocalPerHome = 1;
      try {
        const { trip } = await loadTripData();
        localFx =
          typeof window.__pvResolveTripLocalCurrency === "function"
            ? await window.__pvResolveTripLocalCurrency(trip)
            : null;
        home =
          (typeof window.__pvHomeCurrency === "function" ? window.__pvHomeCurrency() : null) || home;
        if (localFx && localFx.code !== "EUR") {
          rateLocalPerEur = (await fetchRate("EUR", localFx.code, null)).rate;
        }
        if (localFx && localFx.code !== home.code) {
          rateLocalPerHome = (await fetchRate(home.code, localFx.code, null)).rate;
        }
      } catch {
        localFx = null;
      }
      if (form.querySelector(".pv-transfer-fx")) return;
      if (!localFx || localFx.code === "EUR") return;

      const native = label.querySelector("input");
      if (!native) return;
      label.classList.add("pv-expense-amount-native-hidden");
      const box = document.createElement("div");
      box.className = "field pv-transfer-fx";
      box.innerHTML = `
        <span>Importo del rimborso</span>
        <p class="pv-es-hint">Valuta del posto: <strong>${escapeHtml(localFx.name)} (${escapeHtml(
          localFx.code
        )})</strong> · salvato in euro</p>
        <div class="pv-expense-fx-rows">
          <label class="pv-expense-fx-row"><input type="text" inputmode="decimal" id="pv-transfer-local" /><span class="code">${escapeHtml(
            localFx.code
          )}</span></label>
          <label class="pv-expense-fx-row"><input type="text" inputmode="decimal" id="pv-transfer-home" /><span class="code">${escapeHtml(
            home.code
          )}</span></label>
        </div>
        <p class="pv-es-hint" id="pv-transfer-fx-hint"></p>
      `;
      label.insertAdjacentElement("afterend", box);
      transferFxState = { localCode: localFx.code, homeCode: home.code, rateLocalPerEur, rateLocalPerHome };
      const localInput = box.querySelector("#pv-transfer-local");
      const homeInput = box.querySelector("#pv-transfer-home");
      const hint = box.querySelector("#pv-transfer-fx-hint");
      let syncing = false;
      const applyLocal = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          homeInput.value = "";
          setNativeInputValue(native, "");
          return;
        }
        homeInput.value = formatFxAmount(
          localFx.code === home.code ? n : n / rateLocalPerHome,
          home.code
        );
        const eur = localFx.code === "EUR" ? n : n / rateLocalPerEur;
        setNativeInputValue(native, String(Math.round(eur * 100) / 100));
        hint.textContent = `≈ ${formatEuro(Math.round(eur * 100))} · 1 EUR = ${rateLocalPerEur.toLocaleString(
          "it-IT",
          { maximumFractionDigits: rateLocalPerEur >= 100 ? 0 : 2 }
        )} ${localFx.code}`;
      };
      const applyHome = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          localInput.value = "";
          setNativeInputValue(native, "");
          return;
        }
        const loc = localFx.code === home.code ? n : n * rateLocalPerHome;
        localInput.value = formatFxAmount(loc, localFx.code);
        applyLocal(localInput.value);
      };
      localInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        applyLocal(localInput.value);
        syncing = false;
      });
      homeInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        applyHome(homeInput.value);
        syncing = false;
      });
    })();
  }

  function convertTransferBeforeSubmit() {
    if (!document.querySelector("#pv-transfer-local") || !transferFxState) return;
    const localAmt = parseFxAmount(document.querySelector("#pv-transfer-local")?.value);
    if (localAmt == null) return;
    const eur =
      transferFxState.localCode === "EUR"
        ? localAmt
        : Math.round((localAmt / (transferFxState.rateLocalPerEur || 1)) * 100) / 100;
    const label = [...document.querySelectorAll("label.field")].find((l) => {
      const span = l.querySelector(":scope > span");
      return span && /^Importo|^Totale/i.test((span.textContent || "").trim()) && l.querySelector("input");
    });
    const input = label?.querySelector("input");
    if (input) setNativeInputValue(input, String(eur));
    const auth = tripAuth();
    if (auth) {
      const meta = tripMeta(auth.id);
      meta.pendingTransfer = {
        localCode: transferFxState.localCode,
        localAmount: localAmt,
        rateLocalPerEur: transferFxState.rateLocalPerEur,
        eurCents: Math.round(eur * 100),
        at: Date.now(),
      };
      saveTripMeta(auth.id, meta);
    }
  }

  /* ---------- Watch new expenses for notifications ---------- */
  let lastExpenseFingerprint = "";
  async function watchExpenseChanges() {
    const auth = tripAuth();
    if (!auth || !notifyEnabled()) return;
    try {
      const { trip } = await loadTripData();
      const fp = (trip.expenses || []).map((e) => `${e.id}:${e.amount}`).join("|");
      if (!lastExpenseFingerprint) {
        lastExpenseFingerprint = fp;
        return;
      }
      if (fp === lastExpenseFingerprint) return;
      const prev = new Set(lastExpenseFingerprint.split("|"));
      lastExpenseFingerprint = fp;
      for (const e of trip.expenses || []) {
        const key = `${e.id}:${e.amount}`;
        if (!prev.has(key)) {
          notifyExpense("Nuova spesa nel viaggio", `${e.title} · ${formatEuro(e.amount)}`);
        }
      }
    } catch {
      /* offline ok */
    }
  }

  /* ---------- Tick ---------- */
  function tick() {
    ensureStyles();
    ensureDockStartsClosed();
    // Always sync portal visibility from the active tab (never from page text).
    injectToolbar();
    if (!expensesSectionVisible()) {
      // Form extras may still run if an expense modal is open on top.
      if (!document.querySelector(".pv-expense-fx")) return;
    }
    enhanceExpenseFormExtras();
    enhanceTransferCurrencyField();
    enrichExpenseList();
    void enrichBalancesFixed();
    void settlePendingExpenseMeta();
    refreshOnlineHint();
  }

  async function enrichBalancesFixed() {
    const auth = tripAuth();
    if (!auth) return;
    const meta = tripMeta(auth.id);
    const memberMap = meta.memberCurrencies || {};
    const codes = [...new Set(Object.values(memberMap).map((c) => c.code).filter((c) => c && c !== "EUR"))];
    if (!codes.length) return;
    const rateByCode = {};
    for (const code of codes) {
      try {
        rateByCode[code] = (await fetchRate("EUR", code, null)).rate;
      } catch {
        /* ignore */
      }
    }
    const rows = document.querySelectorAll("li, .card, article");
    for (const row of rows) {
      if (row.querySelector(".pv-es-member-equiv")) continue;
      if (!/in pari|deve|credito|€/.test(row.textContent || "")) continue;
      const eurMatch = (row.textContent || "").match(/(-?\d+[.,]\d{2})\s*€/);
      if (!eurMatch) continue;
      const eur = parseFxAmount(eurMatch[1]);
      if (eur == null) continue;
      const parts = codes
        .filter((c) => rateByCode[c])
        .map((c) => formatMoney(Math.abs(eur) * rateByCode[c], c));
      if (!parts.length) continue;
      const tip = document.createElement("div");
      tip.className = "pv-es-hint pv-es-member-equiv";
      tip.textContent = `≈ ${parts.join(" · ")}`;
      row.appendChild(tip);
    }
  }

  /** Parse it-IT currency / decimal into cents. */
  function parseMoneyToCents(raw) {
    const t = String(raw || "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=.*,)/g, "")
      .replace(",", ".");
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  /**
   * Splitpay guard: in «Importi personalizzati» le quote devono sommare il totale.
   * Lo schema Zod già rifiuta, ma mostriamo un toast chiaro prima del submit.
   */
  function validateCustomSplitOrBlock(ev) {
    const rem = [...document.querySelectorAll(".split-remaining")].find((el) =>
      /Da assegnare/i.test(el.textContent || "")
    );
    if (!rem || rem.offsetParent === null) return true;
    const cents = parseMoneyToCents(rem.querySelector("b")?.textContent || rem.textContent);
    if (cents == null || cents === 0) return true;
    ev.preventDefault();
    ev.stopPropagation();
    const msg =
      cents > 0
        ? `Mancano ${(cents / 100).toFixed(2).replace(".", ",")} € da assegnare nelle quote.`
        : `Hai assegnato ${Math.abs(cents / 100)
            .toFixed(2)
            .replace(".", ",")} € in più rispetto al totale.`;
    if (typeof window.__pvToast === "function") window.__pvToast(msg, "warn");
    else if (typeof window.__pvSaveToast === "function") window.__pvSaveToast(msg);
    else alert(msg);
    return false;
  }

  // Bind submit capture for meta + transfer FX + custom-split guard
  if (!window.__pvExpenseSuiteBound) {
    window.__pvExpenseSuiteBound = true;
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.("button[type='submit']");
        if (!btn) return;
        if (!validateCustomSplitOrBlock(ev)) return;
        if (document.querySelector(".pv-expense-fx #pv-expense-local")) {
          // after magic-extras converts, capture meta
          setTimeout(capturePendingExpenseMeta, 0);
        }
        if (document.querySelector("#pv-transfer-local")) {
          convertTransferBeforeSubmit();
        }
      },
      true
    );
    document.addEventListener(
      "submit",
      (ev) => {
        if (!validateCustomSplitOrBlock(ev)) return;
        if (document.querySelector(".pv-expense-fx #pv-expense-local")) {
          setTimeout(capturePendingExpenseMeta, 0);
        }
        if (document.querySelector("#pv-transfer-local")) convertTransferBeforeSubmit();
      },
      true
    );
    window.addEventListener("online", refreshOnlineHint);
    window.addEventListener("offline", refreshOnlineHint);
  }

  // Expose for magic-extras + Menu → Strumenti
  window.__pvExpenseSuite = {
    fetchRate,
    warmFxCache,
    capturePendingExpenseMeta,
    fairSplitCents,
    ASSET_VER,
    reopenDock,
    dismissDock,
    isActive: expensesSectionVisible,
  };

  const obs = new MutationObserver(() => {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 220);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  const schedulePlace = () => {
    if (placeExpensePortal._raf) return;
    placeExpensePortal._raf = requestAnimationFrame(() => {
      placeExpensePortal._raf = 0;
      placeExpensePortal();
    });
  };
  addEventListener("scroll", schedulePlace, { passive: true });
  addEventListener("resize", schedulePlace);
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && document.body.classList.contains("pv-es-dock-open")) dismissDock();
  });
  setTimeout(tick, 500);
  setTimeout(tick, 1600);
  setInterval(() => void watchExpenseChanges(), 8000);

  // Register service worker for offline shell
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`./sw.js?v=${ASSET_VER}`).catch(() => {});
    });
  }
})();
