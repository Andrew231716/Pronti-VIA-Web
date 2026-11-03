/**
 * App-wide UX suite — proposte su tutte le sezioni, intuitive e usabili anche offline.
 * Homegrown overlays: non modifica lo schema React (sidecar localStorage + UI).
 */
(() => {
  const VER = "20261102x";
  const STYLE_ID = "pv-app-suite-css";
  const FAV_KEY = "viavia-place-favs-v1";
  const STOP_META_KEY = "viavia-stop-meta-v1";
  const BOOKING_META_KEY = "viavia-booking-meta-v1";
  const DOC_META_KEY = "viavia-doc-meta-v1";
  const NOTE_HIST_KEY = "viavia-notes-hist-v1";
  const PACK_ASSIGN_KEY = "viavia-pack-assign-v1";
  const ACCOUNT_EXTRA_KEY = "viavia-account-extra-v1";
  const DATA_SAVER_KEY = "viavia-data-saver-v1";
  const SYNC_QUEUE_KEY = "viavia-sync-queue-v1";
  const HOME_FILTER_KEY = "viavia-home-filter-v1";
  const EXPENSE_META_KEY = "viavia-expense-fx-meta-v1";
  const DOCK_DISMISS_KEY = "pv-as-dock-dismissed-v1";
  let currentDockPanelId = null;

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


  function portalHost() {
    let host = document.getElementById("pv-as-portal");
    if (!host) {
      host = document.createElement("div");
      host.id = "pv-as-portal";
      // Outside #root (React-safe). Bottom sheet with clear “Novità” chrome.
      host.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:121500;max-height:min(46vh,480px);overflow:auto;background:#fff;border:2px solid #007d82;border-radius:18px;box-shadow:0 16px 40px rgba(15,45,50,.22)";
      document.body.appendChild(host);
    }
    return host;
  }

  function placePortal() {
    /* bottom sheet — no dynamic top needed */
  }

  function activeTabLabel() {
    const t = document.querySelector('[role=tab][data-state=active], [role=tab][aria-selected="true"]');
    return (t?.textContent || "").trim();
  }

  function tabIs(...patterns) {
    const label = activeTabLabel().toLowerCase();
    if (!label) return false;
    return patterns.some((p) => (p instanceof RegExp ? p.test(label) : label.includes(String(p).toLowerCase())));
  }

  function sectionHeading(re) {
    return [...document.querySelectorAll("h1,h2,h3")].find((h) => re.test((h.textContent || "").trim()));
  }

  function readDismissed() {
    return readJson(DOCK_DISMISS_KEY, {});
  }

  function isDockDismissed(id) {
    if (!id) return false;
    const d = readDismissed();
    return Boolean(d[id] || d["*"]);
  }

  function dismissDock(id) {
    const target = id || currentDockPanelId;
    if (!target) return;
    const d = readDismissed();
    d[target] = Date.now();
    writeJson(DOCK_DISMISS_KEY, d);
    currentDockPanelId = target;
    showOnlyPanel(null, { force: true });
    refreshReopenChip(target);
  }

  function reopenDock(id) {
    const target = id || currentDockPanelId;
    if (!target) return;
    const d = readDismissed();
    delete d[target];
    delete d["*"];
    writeJson(DOCK_DISMISS_KEY, d);
    showOnlyPanel(target, { force: true });
    refreshReopenChip(null);
  }

  function refreshReopenChip(forPanelId) {
    let chip = document.getElementById("pv-as-reopen");
    if (!forPanelId || !isDockDismissed(forPanelId)) {
      chip?.remove();
      document.body.classList.remove("pv-as-reopen-visible");
      return;
    }
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.id = "pv-as-reopen";
      chip.className = "pv-as-reopen";
      chip.textContent = "Strumenti";
      chip.title = "Riapri strumenti extra";
      chip.addEventListener("click", () => reopenDock(chip.dataset.panel));
      document.body.appendChild(chip);
    }
    chip.dataset.panel = forPanelId;
    chip.hidden = false;
    document.body.classList.add("pv-as-reopen-visible");
  }

  function mountSectionPanel(id, html) {
    const host = portalHost();
    if (!host.querySelector(".pv-as-dock-title")) {
      const title = document.createElement("div");
      title.className = "pv-as-dock-title";
      title.innerHTML = `<span>Novità · strumenti extra</span><button type="button" aria-label="Chiudi strumenti" data-as-close>×</button>`;
      title.querySelector("[data-as-close]")?.addEventListener("click", () => dismissDock(currentDockPanelId));
      host.insertBefore(title, host.firstChild);
    }
    let panel = host.querySelector("#" + CSS.escape(id));
    if (!panel) {
      panel = document.createElement("div");
      panel.id = id;
      panel.className = "pv-as-portal-panel";
      panel.style.cssText = "max-width:1100px;margin:0 auto;padding:0 14px 14px";
      host.appendChild(panel);
    }
    if (!panel.dataset.ready) {
      panel.innerHTML = html;
      panel.dataset.ready = "1";
      return { panel, fresh: true };
    }
    return { panel, fresh: false };
  }

  function showOnlyPanel(id, opts = {}) {
    const force = Boolean(opts.force);
    if (id && !force && isDockDismissed(id)) {
      currentDockPanelId = id;
      const host = portalHost();
      host.hidden = true;
      document.body.classList.toggle("pv-as-dock-open", false);
      refreshReopenChip(id);
      return;
    }
    const host = portalHost();
    let any = false;
    [...host.children].forEach((el) => {
      if (el.classList?.contains("pv-as-dock-title")) {
        el.hidden = !id;
        return;
      }
      const on = Boolean(id) && el.id === id;
      el.hidden = !on;
      if (on) any = true;
    });
    host.hidden = !any;
    document.body.classList.toggle("pv-as-dock-open", any);
    if (any) {
      currentDockPanelId = id;
      placePortal(host);
      refreshReopenChip(null);
    } else if (currentDockPanelId && isDockDismissed(currentDockPanelId)) {
      refreshReopenChip(currentDockPanelId);
    } else {
      refreshReopenChip(null);
    }
    const install = document.getElementById("pv-as-install");
    if (install && any) install.classList.remove("show");
  }

  function desiredPanelId() {
    if (!tripAuth()) {
      if (document.getElementById("pv-as-panel-newtrip")) return "pv-as-panel-newtrip";
      if (document.getElementById("pv-as-panel-home")) return "pv-as-panel-home";
      return null;
    }
    if (tabIs("itinerario") || sectionHeading(/itinerario/i) || document.querySelector(".day-strip"))
      return "pv-as-panel-itinerary";
    if (tabIs("esplora", "luoghi", "posti") || sectionHeading(/esplora|luoghi|posti/i))
      return "pv-as-panel-places";
    if (tabIs("preventivo") || sectionHeading(/preventivo/i)) return "pv-as-panel-preventivo";
    if (tabIs("prenotazioni") || sectionHeading(/prenotazioni/i)) return "pv-as-panel-bookings";
    if (tabIs("documenti") || sectionHeading(/documenti/i)) return "pv-as-panel-docs";
    if (tabIs("valigia", "checklist") || sectionHeading(/valigia|da mettere|checklist|cosa mettere/i))
      return "pv-as-panel-pack";
    if (tabIs("note") || sectionHeading(/^note$/i)) return "pv-as-panel-notes";
    if (tabIs("condivid") || sectionHeading(/condivid/i)) return "pv-as-panel-share";
    if (tabIs("spese") || sectionHeading(/spese di gruppo/i)) return null;
    return currentDockPanelId;
  }

  function syncPortalVisibility() {
    const id = desiredPanelId();
    if (id) currentDockPanelId = id;
    showOnlyPanel(id);
  }

  function toast(msg, kind = "ok") {
    if (typeof window.__pvUxToast === "function") return window.__pvUxToast(msg, kind);
    let el = document.getElementById("pv-app-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pv-app-toast";
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:140000;padding:10px 14px;border-radius:999px;background:#0f5a40;color:#fff;font:600 13px/1.3 inherit;opacity:0;transition:opacity .2s;pointer-events:none;max-width:min(92vw,420px);text-align:center";
      document.body.appendChild(el);
    }
    el.style.background = kind === "warn" ? "#7a4b00" : kind === "err" ? "#7a1f1f" : "#0f5a40";
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
    }, 2600);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pv-as-bar{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 12px;align-items:center}
      .pv-as-chip,.pv-as-bar button{
        appearance:none;border:1px solid #c9dbdb;background:#fff;color:#16353b;
        border-radius:999px;padding:7px 12px;font:600 .8rem inherit;cursor:pointer
      }
      .pv-as-chip.on,.pv-as-bar button.primary{background:#007d82;border-color:#007d82;color:#fff}
      .pv-as-hint{margin:0;font-size:.78rem;color:#5b7076;line-height:1.35}
      .pv-as-card{margin:10px 0;padding:12px 14px;border:1px solid #d9e7e7;border-radius:14px;background:#fff;display:grid;gap:8px}
      .pv-as-progress{height:8px;border-radius:999px;background:#e7f0f0;overflow:hidden}
      .pv-as-progress > span{display:block;height:100%;background:#007d82}
      .pv-as-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.72rem;font-weight:700}
      .pv-as-badge.warn{background:#fff4e5;color:#7a4b00}
      .pv-as-badge.ok{background:#e7f6ee;color:#0f5a40}
      .pv-as-badge.err{background:#fdecec;color:#7a1f1f}
      .pv-as-checkin.stop-done{opacity:.72}
      .pv-as-checkin.stop-done::after{content:" · fatto";font-size:.75rem;color:#0f5a40;font-weight:700}
      .pv-as-fav{margin-left:6px;border:0;background:transparent;cursor:pointer;font-size:1rem;line-height:1;color:#c45}
      .pv-as-install{
        position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:120500;display:none;gap:10px;align-items:center;padding:12px 14px;
        border-radius:16px;background:#16353b;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.2)
      }
      .pv-as-install.show{display:flex}
      .pv-as-install button{appearance:none;border:0;border-radius:999px;padding:8px 12px;font:700 .8rem inherit;cursor:pointer}
      .pv-as-install .go{background:#007d82;color:#fff}
      .pv-as-install .no{background:transparent;color:#cfe;border:1px solid #4a6}
      .pv-as-cache{font-size:.75rem;color:#5b7076}
      .pv-as-mention{background:#e7f4f4;border-radius:6px;padding:0 3px}
      .pv-as-sync{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:#7a4b00;background:#fff4e5;border-radius:8px;padding:4px 8px}
      .pv-home-filters{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}
      .recent-trips .pv-as-trip-meta{display:block;margin-top:4px;font-size:.75rem;color:#5b7076;font-weight:600}
      .pv-as-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .pv-as-row select, .pv-as-row input[type=text], .pv-as-row input[type=date], .pv-as-row input[type=url]{
        border:1px solid #c9dbdb;border-radius:10px;padding:8px 10px;font:inherit;background:#fff;color:#16353b
      }
      #pv-as-portal{overscroll-behavior:contain}
      #pv-as-portal .pv-as-portal-panel{padding:4px 0 10px}
      #pv-as-portal .pv-as-dock-title{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        padding:10px 14px 0;font:700 .78rem inherit;color:#007d82;letter-spacing:.02em;text-transform:uppercase
      }
      #pv-as-portal .pv-as-dock-title button{
        appearance:none;border:0;background:#eef5f5;border-radius:999px;width:32px;height:32px;cursor:pointer;font:700 1rem inherit
      }
      #pv-as-portal[hidden]{display:none !important}
      body.pv-as-dock-open{scroll-padding-top:40vh}
      .pv-as-reopen{
        position:fixed;left:12px;right:auto;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:121600;
        appearance:none;border:1px solid #007d82;background:#007d82;color:#fff;border-radius:999px;
        padding:10px 14px;font:700 .78rem inherit;cursor:pointer;box-shadow:0 8px 20px rgba(15,45,50,.18);
        max-width:min(52vw,200px)
      }
      /* Keep Pronty / preventivo FABs clear of the tools dock */
      body.pv-as-dock-open #pv-magic-root .pv-magic-btn,
      body.pv-as-dock-open .pv-prev-launch{
        bottom:calc(min(46vh,480px) + 24px + env(safe-area-inset-bottom,0px))!important
      }
      #pv-as-cache-status{
        position:fixed;left:12px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:120050;
        background:#fff;border:1px solid #d9e7e7;border-radius:999px;padding:6px 10px;
        font:600 .72rem inherit;color:#5b7076;max-width:min(58vw,220px);
        box-shadow:0 4px 14px rgba(15,45,50,.08)
      }
      #pv-as-cache-status[hidden]{display:none!important}
      /* Prefer reopen chip over cache badge when both would sit left */
      body.pv-as-reopen-visible #pv-as-cache-status{display:none!important}
      @media (max-width:720px){
        .pv-as-reopen{padding:9px 12px;font-size:.74rem}
        #pv-as-portal{left:8px;right:8px;max-height:min(42vh,420px)}
      }
      @media (prefers-reduced-motion: reduce){
        .pv-as-install{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadTripSafe() {
    const auth = tripAuth();
    if (!auth) return null;
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) return null;
      return { auth, trip: data.trip, revision: data.revision, data };
    } catch {
      return null;
    }
  }

  async function saveTripSafe(auth, trip, revision) {
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

  function enqueueSync(item) {
    const q = readJson(SYNC_QUEUE_KEY, []);
    q.unshift({ ...item, at: Date.now() });
    writeJson(SYNC_QUEUE_KEY, q.slice(0, 50));
    refreshSyncChip();
  }

  async function flushSyncQueue() {
    if (!navigator.onLine) return;
    const q = readJson(SYNC_QUEUE_KEY, []);
    if (!q.length) return;
    // Best-effort: expense meta already local; try to merge into trip notes block.
    const left = [];
    for (const item of q) {
      try {
        if (item.type === "expense-meta-cloud") await pushExpenseMetaToTrip(item.tripId, item.key);
        else if (item.type === "note-hist") {
          /* already local */
        } else left.push(item);
      } catch {
        left.push(item);
      }
    }
    writeJson(SYNC_QUEUE_KEY, left);
    refreshSyncChip();
    if (q.length && !left.length) toast("Sincronizzazione completata", "ok");
  }

  function refreshSyncChip() {
    const auth = tripAuth();
    let chip = document.getElementById("pv-as-sync-chip");
    const q = readJson(SYNC_QUEUE_KEY, []);
    if (!auth || !q.length) {
      chip?.remove();
      return;
    }
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.id = "pv-as-sync-chip";
      chip.className = "pv-as-sync";
      chip.addEventListener("click", () => void flushSyncQueue());
      document.body.appendChild(chip);
      chip.style.cssText += ";position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:120200;cursor:pointer;border:0";
    }
    chip.textContent = navigator.onLine
      ? `Sync in coda (${q.length}) · tocca`
      : `Offline · ${q.length} in coda`;
  }

  /* ===================== HOME ===================== */
  function enhanceHomeTrips() {
    if (tripAuth()) return;
    const host = document.querySelector(".recent-trips");
    if (!host) return;

    const current = readJson(HOME_FILTER_KEY, { mode: "all" }).mode || "all";
    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-home",
      `<div class="pv-as-card">
        <strong>I tuoi viaggi</strong>
        <div class="pv-home-filters pv-as-bar" id="pv-as-home-filters"></div>
        <p class="pv-as-hint" id="pv-as-home-hint">Filtra e vedi sync cloud / spesa senza toccare le card React.</p>
        <ul id="pv-as-home-meta" class="pv-as-hint" style="padding-left:18px;margin:0"></ul>
      </div>`
    );
    const filters = panel.querySelector("#pv-as-home-filters");
    if (fresh && filters) {
      for (const [mode, label] of [
        ["all", "Tutti"],
        ["upcoming", "Prossimi"],
        ["past", "Passati"],
        ["local", "Solo locale"],
      ]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pv-as-chip";
        b.textContent = label;
        b.dataset.mode = mode;
        b.addEventListener("click", () => {
          writeJson(HOME_FILTER_KEY, { mode });
          enhanceHomeTrips();
        });
        filters.appendChild(b);
      }
    }
    filters?.querySelectorAll("[data-mode]").forEach((b) => {
      b.classList.toggle("on", b.dataset.mode === current);
    });

    const mode = current;
    const today = new Date().toISOString().slice(0, 10);
    const cards = [...host.querySelectorAll("a.booking-card, .pv-recent-trip-open")];
    const metaLines = [];
    for (const card of cards) {
      let id = "";
      let key = "";
      try {
        const href = card.getAttribute("href") || card.closest("a")?.getAttribute("href") || "";
        const q = new URLSearchParams(String(href).replace(/^#/, ""));
        id = q.get("trip") || "";
        key = q.get("key") || "";
      } catch {
        continue;
      }
      const row = card.closest(".pv-recent-row") || card;
      const localOnly =
        typeof window.__pvIsTripLocalOnly === "function" && id
          ? window.__pvIsTripLocalOnly(id)
          : false;
      const metaKey = `viavia-trip-card-meta:${id}`;
      let meta = readJson(metaKey, null);
      if (!meta && id && key) {
        void (async () => {
          try {
            const res = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
              headers: { Authorization: `Bearer ${key}` },
              cache: "no-store",
            });
            const data = await res.json();
            if (!res.ok) return;
            const trip = data.trip || {};
            const spent = (trip.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
            writeJson(metaKey, {
              start: trip.start || "",
              end: trip.end || "",
              spent,
              title: trip.title || "",
              local: Boolean(data.local),
            });
            enhanceHomeTrips();
          } catch {
            /* offline */
          }
        })();
      }

      const title =
        (card.querySelector("strong, h3, .title")?.textContent || card.textContent || "Viaggio")
          .trim()
          .slice(0, 48);
      let tip = localOnly ? "Solo su questo dispositivo" : "Apri per sincronizzare";
      if (meta) {
        const euro = new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
        }).format((meta.spent || 0) / 100);
        tip = `${meta.start || "?"} → ${meta.end || "?"} · spese ${euro}${
          localOnly || meta.local ? " · solo dispositivo" : " · cloud"
        }`;
      }
      // Prefer title attribute over injecting nodes into React cards.
      try {
        card.setAttribute("title", tip);
        card.setAttribute("data-pv-as-meta", tip);
      } catch {
        /* ignore */
      }
      metaLines.push(`<li><strong>${escapeHtml(title)}</strong> · ${escapeHtml(tip)}</li>`);

      const end = meta?.end || "";
      let hide = false;
      if (mode === "upcoming") hide = end && end < today;
      if (mode === "past") hide = !end || end >= today;
      if (mode === "local") hide = !(localOnly || meta?.local);
      row.style.display = hide ? "none" : "";
    }
    const list = panel.querySelector("#pv-as-home-meta");
    if (list) list.innerHTML = metaLines.slice(0, 12).join("") || "<li>Nessun viaggio recente.</li>";
    const hint = panel.querySelector("#pv-as-home-hint");
    if (hint) hint.textContent = `${cards.length} viaggi · filtro “${mode}”`;
    if (!findNewTripForm()) showOnlyPanel("pv-as-panel-home");
  }

  /* ===================== NEW TRIP helpers ===================== */
  function findNewTripForm() {
    const title = [...document.querySelectorAll("label.field > span, label > span")].find((s) =>
      /nome del viaggio|titolo/i.test(s.textContent || "")
    );
    const form =
      title?.closest("form") ||
      [...document.querySelectorAll("form")].find((f) =>
        /destinazione|partenza|ritorno/i.test(f.textContent || "")
      );
    if (!form) return null;
    if (!/destinazione|nuovo viaggio|crea viaggio/i.test(form.textContent || "")) return null;
    if (tripAuth()) return null;
    return form;
  }

  function enhanceNewTripForm() {
    const form = findNewTripForm();
    if (!form) {
      const existing = document.getElementById("pv-as-panel-newtrip");
      if (existing) existing.hidden = true;
      return;
    }

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-newtrip",
      `<div class="pv-as-card">
        <strong>Scorciatoie durata</strong>
        <div class="pv-as-row">
          <button type="button" class="pv-as-chip" data-days="3">Weekend (3g)</button>
          <button type="button" class="pv-as-chip" data-days="7">1 settimana</button>
          <button type="button" class="pv-as-chip" data-days="10">10 giorni</button>
          <button type="button" class="pv-as-chip" data-days="14">2 settimane</button>
        </div>
        <strong>Importa da link (Airbnb / Booking)</strong>
        <div class="pv-as-row">
          <input type="url" id="pv-as-import-url" placeholder="Incolla il link della struttura" style="flex:1;min-width:180px" />
          <button type="button" class="pv-as-chip" id="pv-as-import-go">Usa</button>
        </div>
        <p class="pv-as-hint">Compiliamo titolo/note dal link; date e destinazione le confermi tu.</p>
      </div>`
    );
    showOnlyPanel("pv-as-panel-newtrip");
    if (!fresh) return;

    panel.querySelectorAll("[data-days]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = findNewTripForm();
        if (!f) return;
        const days = Number(btn.getAttribute("data-days")) || 7;
        const dateInputs = [...f.querySelectorAll('input[type="date"]')];
        const start = dateInputs[0];
        const end = dateInputs[1];
        if (!start) return;
        const s = start.value || new Date().toISOString().slice(0, 10);
        start.value = s;
        start.dispatchEvent(new Event("input", { bubbles: true }));
        start.dispatchEvent(new Event("change", { bubbles: true }));
        if (end) {
          const d = new Date(s + "T12:00:00");
          d.setDate(d.getDate() + (days - 1));
          end.value = d.toISOString().slice(0, 10);
          end.dispatchEvent(new Event("input", { bubbles: true }));
          end.dispatchEvent(new Event("change", { bubbles: true }));
        }
        toast(`Durata impostata: ${days} giorni`, "ok");
      });
    });

    panel.querySelector("#pv-as-import-go")?.addEventListener("click", () => {
      const f = findNewTripForm();
      if (!f) return;
      const url = String(panel.querySelector("#pv-as-import-url")?.value || "").trim();
      if (!url) return;
      let hostName = "";
      let path = "";
      try {
        const u = new URL(url);
        hostName = u.hostname.replace(/^www\./, "");
        path = decodeURIComponent(u.pathname.replace(/[-_]/g, " ")).replace(/\//g, " ").trim();
      } catch {
        toast("Link non valido", "err");
        return;
      }
      const titleInput = [...f.querySelectorAll("input[type=text]")].find((i) =>
        /titolo|nome|viaggio/i.test(
          `${i.name}${i.id}${i.placeholder}${i.closest("label")?.textContent || ""}`
        )
      );
      const notes = [...f.querySelectorAll("textarea")][0];
      const guess = path.split(/\s+/).filter(Boolean).slice(0, 6).join(" ") || hostName;
      if (titleInput) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(titleInput, `Soggiorno · ${guess}`);
        else titleInput.value = `Soggiorno · ${guess}`;
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (notes) {
        notes.value = `Prenotazione da ${hostName}\n${url}`;
        notes.dispatchEvent(new Event("input", { bubbles: true }));
      }
      toast("Dati importati dal link — controlla destinazione e date", "ok");
    });
  }

  /* ===================== ACCOUNT ===================== */
  function enhanceAccountChip() {
    const chip = document.getElementById("pv-account-chip");
    if (!chip || chip.dataset.pvAsAcc) return;
    chip.dataset.pvAsAcc = "1";
    const extra = readJson(ACCOUNT_EXTRA_KEY, { avatar: "", devices: [] });
    const menuBtn = chip.querySelector("#pv-account-menu") || chip.querySelector("button");
    if (!menuBtn) return;
    menuBtn.addEventListener(
      "click",
      () => {
        setTimeout(() => injectAccountExtras(extra), 200);
      },
      true
    );
  }

  function injectAccountExtras(extra) {
    const panel =
      document.querySelector("#pv-account-dropdown, .pv-account-menu, [data-account-menu]") ||
      [...document.querySelectorAll("div,section")].find((el) =>
        /esci|profilo|account/i.test(el.textContent || "") && el.querySelector("button")
      );
    if (!panel || panel.querySelector(".pv-as-account-extra")) return;
    const box = document.createElement("div");
    box.className = "pv-as-card pv-as-account-extra";
    box.style.margin = "8px";
    const session = readJson("viavia-account-v1", {});
    const name = session?.user?.displayName || session?.user?.username || "Tu";
    const initial = String(name).trim().charAt(0).toUpperCase() || "?";
    box.innerHTML = `
      <div class="pv-as-row">
        <span class="pv-as-badge ok" style="width:36px;height:36px;justify-content:center;font-size:1rem">${escapeHtml(
          extra.avatar || initial
        )}</span>
        <strong>${escapeHtml(name)}</strong>
      </div>
      <p class="pv-as-hint">Avatar iniziale (locale). Login social e recupero password richiedono il cloud account — in arrivo.</p>
      <div class="pv-as-row">
        <button type="button" class="pv-as-chip" data-av>Cambia iniziale</button>
        <button type="button" class="pv-as-chip" data-export>Esporta dati account</button>
        <button type="button" class="pv-as-chip" data-devices>Dispositivi</button>
      </div>
      <p class="pv-as-hint" id="pv-as-acc-msg"></p>
    `;
    panel.appendChild(box);
    box.querySelector("[data-av]")?.addEventListener("click", () => {
      const v = prompt("Iniziale o emoji per l’avatar", extra.avatar || initial);
      if (v == null) return;
      extra.avatar = String(v).slice(0, 2);
      writeJson(ACCOUNT_EXTRA_KEY, extra);
      box.querySelector(".pv-as-badge").textContent = extra.avatar;
      toast("Avatar aggiornato su questo dispositivo", "ok");
    });
    box.querySelector("[data-export]")?.addEventListener("click", () => {
      const payload = {
        account: session,
        recent: readJson("viavia-recent-links-v1", []),
        extras: extra,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pronti-via-account.json";
      a.click();
    });
    box.querySelector("[data-devices]")?.addEventListener("click", () => {
      const msg = box.querySelector("#pv-as-acc-msg");
      const ua = navigator.userAgent.slice(0, 80);
      extra.devices = [{ label: "Questo browser", ua, at: new Date().toISOString() }];
      writeJson(ACCOUNT_EXTRA_KEY, extra);
      if (msg) msg.textContent = `Dispositivo attuale: ${ua}`;
    });
  }

  /* ===================== ITINERARY ===================== */
  function enhanceItineraryStops() {
    const auth = tripAuth();
    if (!auth) return;
    if (!(tabIs("itinerario") || document.querySelector(".day-strip") || sectionHeading(/itinerario/i))) return;

    const meta = readJson(STOP_META_KEY, {})[auth.id] || { checkins: {} };
    const doneCount = Object.values(meta.checkins || {}).filter(Boolean).length;
    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-itinerary",
      `<div class="pv-as-card">
        <strong>Strumenti giornata</strong>
        <div class="pv-as-bar pv-as-day-tools">
          <button type="button" class="pv-as-chip" data-lunch>Aggiungi pausa pranzo</button>
          <button type="button" class="pv-as-chip" data-tempo>Stima tempi giornata</button>
          <button type="button" class="pv-as-chip pv-as-checkin-btn" data-checkins>Check-in tappe (${doneCount})</button>
        </div>
        <p class="pv-as-hint" id="pv-as-day-hint"></p>
      </div>`
    );
    const btn = panel.querySelector("[data-checkins]");
    if (btn) btn.textContent = `Check-in tappe (${doneCount})`;
    if (fresh) {
      panel.querySelector("[data-lunch]")?.addEventListener("click", () => void addLunchStop());
      panel.querySelector("[data-tempo]")?.addEventListener("click", () => estimateDayTimes());
      panel.querySelector("[data-checkins]")?.addEventListener("click", () => void openCheckinPanel());
    }
    showOnlyPanel("pv-as-panel-itinerary");
  }

  async function openCheckinPanel() {
    const auth = tripAuth();
    if (!auth) return;
    const packed = await loadTripSafe();
    if (!packed) return toast("Viaggio non disponibile", "warn");
    const meta = readJson(STOP_META_KEY, {});
    const tripMeta = meta[auth.id] || { checkins: {} };
    const stops = packed.trip.stops || [];
    const body = stops.length
      ? `<div class="pv-as-card">${stops
          .map((s) => {
            const key = String(s.title || "").toLowerCase();
            const on = Boolean(tripMeta.checkins[key]);
            return `<label class="pv-as-row" style="justify-content:space-between">
              <span>${escapeHtml(s.day || "")} · ${escapeHtml(s.title || "")}</span>
              <input type="checkbox" data-stop="${escapeHtml(key)}" ${on ? "checked" : ""} />
            </label>`;
          })
          .join("")}</div>`
      : "<p>Nessuna tappa.</p>";
    openSimpleModal("Check-in tappe", body);
    document.querySelectorAll("#pv-as-modal-body input[data-stop]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-stop");
        const m = readJson(STOP_META_KEY, {});
        const t = m[auth.id] || { checkins: {} };
        t.checkins[key] = input.checked;
        m[auth.id] = t;
        writeJson(STOP_META_KEY, m);
        const btn = document.querySelector(".pv-as-day-tools [data-checkins]");
        if (btn) {
          const n = Object.values(t.checkins).filter(Boolean).length;
          btn.textContent = `Check-in tappe (${n})`;
        }
      });
    });
  }

  function isoDayFromTrip(trip, dayIndex) {
    const start = String(trip?.start || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
    const d = new Date(`${start}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return "";
    d.setUTCDate(d.getUTCDate() + Math.max(0, dayIndex | 0));
    return d.toISOString().slice(0, 10);
  }

  function selectedStopDay(trip) {
    const buttons = [...document.querySelectorAll(".day-strip button")];
    const selected = document.querySelector(".day-strip button.selected") || buttons[0] || null;
    const fromData = selected?.getAttribute("data-day") || selected?.dataset?.day || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromData)) return fromData;
    const idx = selected ? Math.max(0, buttons.indexOf(selected)) : 0;
    return isoDayFromTrip(trip, idx);
  }

  function isValidStopDay(day, trip) {
    const v = String(day || "");
    if (!v || v === "unscheduled") return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const t = Date.parse(`${v}T12:00:00Z`);
    if (Number.isNaN(t)) return false;
    const start = String(trip?.start || "").slice(0, 10);
    const end = String(trip?.end || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && v < start) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && v > end) return false;
    return true;
  }

  async function repairInvalidStopDays() {
    const packed = await loadTripSafe();
    if (!packed?.trip) return;
    const { auth, trip, revision } = packed;
    let changed = 0;
    trip.stops = Array.isArray(trip.stops) ? trip.stops : [];
    for (const stop of trip.stops) {
      if (isValidStopDay(stop.day, trip)) continue;
      // Legacy bug: "Giorno 1" text instead of ISO date → map to trip day or unscheduled.
      const m = String(stop.day || "").match(/giorno\s*(\d+)/i);
      stop.day = m ? isoDayFromTrip(trip, Number(m[1]) - 1) : "";
      changed += 1;
    }
    if (!changed) return;
    try {
      await saveTripSafe(auth, trip, revision);
      toast(`Corrette ${changed} tappe con data non valida`, "ok");
      setTimeout(() => location.reload(), 350);
    } catch {
      /* keep trying next tick */
    }
  }

  async function addLunchStop() {
    const packed = await loadTripSafe();
    if (!packed) return toast("Apri un viaggio modificabile", "warn");
    const { auth, trip, revision } = packed;
    const day = selectedStopDay(trip);
    trip.stops = Array.isArray(trip.stops) ? trip.stops : [];
    trip.stops.push({
      id: crypto.randomUUID(),
      title: "Pausa pranzo",
      day,
      time: "",
      notes: "Inserita come giornata tipo — sposta pure orario e posto.",
      category: "Cibo",
      address: "",
      lat: null,
      lng: null,
    });
    try {
      await saveTripSafe(auth, trip, revision);
      toast("Pausa pranzo aggiunta all’itinerario", "ok");
      setTimeout(() => location.reload(), 400);
    } catch (err) {
      toast(err.message || "Non riuscito", "err");
    }
  }

  function estimateDayTimes() {
    const hops = [...document.querySelectorAll(".pv-dist-note, .route-hop")];
    const hint = document.querySelector("#pv-as-day-hint");
    if (!hops.length) {
      if (hint) hint.textContent = "Aggiungi coordinate alle tappe per stimare i tempi.";
      return;
    }
    // Parse "12 km" style notes → ~3 min/km walking + buffer
    let km = 0;
    for (const el of hops) {
      const m = (el.textContent || "").match(/([\d.,]+)\s*km/i);
      if (m) km += Number(String(m[1]).replace(",", ".")) || 0;
    }
    const walkMin = Math.round(km * 12 + 15);
    const taxiMin = Math.round(km * 2.2 + 10);
    if (hint) {
      hint.textContent = `Spostamenti ≈ ${km.toFixed(1)} km · a piedi ~${walkMin} min · taxi/auto ~${taxiMin} min (stima).`;
    }
  }

  /* ===================== EXPLORE / PLACES ===================== */
  function enhancePlaces() {
    if (!(tabIs("esplora", "luoghi", "posti") || sectionHeading(/esplora|luoghi|posti/i) || document.querySelector(".pv-place-card")))
      return;
    const favs = readJson(FAV_KEY, {});
    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-places",
      `<div class="pv-as-card">
        <strong>Filtri luoghi & preferiti</strong>
        <div class="pv-as-bar pv-as-place-filters">
          <button type="button" class="pv-as-chip on" data-f="all">Tutti</button>
          <button type="button" class="pv-as-chip" data-f="fav">Preferiti (${Object.keys(favs).length})</button>
          <button type="button" class="pv-as-chip" data-f="food">Cibo</button>
          <button type="button" class="pv-as-chip" data-f="nature">Natura</button>
          <button type="button" class="pv-as-chip" data-f="culture">Cultura</button>
          <button type="button" class="pv-as-chip" data-f="budget">Low budget</button>
          <button type="button" class="pv-as-chip" data-favsave>Salva primo risultato nei preferiti</button>
        </div>
        <p class="pv-as-hint">I filtri nascondono le card visibili; i preferiti restano sul dispositivo tra i viaggi.</p>
      </div>`
    );
    const favBtn = panel.querySelector("[data-f=fav]");
    if (favBtn) favBtn.textContent = `Preferiti (${Object.keys(readJson(FAV_KEY, {})).length})`;
    if (fresh) {
      panel.addEventListener("click", (ev) => {
        const bar = panel.querySelector(".pv-as-place-filters");
        const saveBtn = ev.target?.closest?.("[data-favsave]");
        if (saveBtn) {
          const card = document.querySelector(".pv-place-card strong, .pv-card strong");
          const title = (card?.textContent || "").trim();
          if (!title) return toast("Nessun luogo visibile", "warn");
          const f = readJson(FAV_KEY, {});
          f[title.toLowerCase()] = { title, at: Date.now() };
          writeJson(FAV_KEY, f);
          toast(`Preferito: ${title}`, "ok");
          const fb = panel.querySelector("[data-f=fav]");
          if (fb) fb.textContent = `Preferiti (${Object.keys(f).length})`;
          return;
        }
        const btn = ev.target?.closest?.("[data-f]");
        if (!btn || !bar) return;
        bar.querySelectorAll("[data-f]").forEach((c) => c.classList.remove("on"));
        btn.classList.add("on");
        const f = btn.getAttribute("data-f");
        const latestFavs = readJson(FAV_KEY, {});
        document.querySelectorAll(".pv-place-card, .pv-card").forEach((card) => {
          const text = (card.textContent || "").toLowerCase();
          const title = (card.querySelector("strong")?.textContent || "").toLowerCase();
          const isFav = Boolean(latestFavs[title]);
          let show = true;
          if (f === "fav") show = isFav;
          if (f === "food") show = /ristor|cibo|food|cafe|bar|pizza|cena/.test(text);
          if (f === "nature") show = /natura|park|lago|montagna|spiaggia|trail|escurs/.test(text);
          if (f === "culture") show = /museo|chiesa|cattedrale|storico|cultura|galleria/.test(text);
          if (f === "budget") show = /gratis|free|econom|budget|low/.test(text) || isFav;
          card.style.display = show ? "" : "none";
        });
      });
    }
    showOnlyPanel("pv-as-panel-places");
  }

  /* ===================== MAP labels ===================== */
  function enhanceMapFrame() {
    const iframe = document.querySelector("iframe[src*='map'], iframe#pv-map, .map-frame iframe");
    if (!iframe || iframe.dataset.pvAsMap) return;
    iframe.dataset.pvAsMap = "1";
    // Ask map to show time labels when we post points (magic-extras already posts).
    try {
      iframe.contentWindow?.postMessage({ type: "viavia-map-options", timeLabels: true, cluster: true }, location.origin);
    } catch {
      /* ignore */
    }
  }

  /* ===================== PREVENTIVO ===================== */
  function enhancePreventivo() {
    if (!(tabIs("preventivo") || document.getElementById("pv-preventivo-root") || sectionHeading(/preventivo/i)))
      return;
    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-preventivo",
      `<div class="pv-as-card pv-as-prev-tools">
        <strong>Confronta scenari & alert</strong>
        <div class="pv-as-row">
          <button type="button" class="pv-as-chip" data-cmp>Apri confronto</button>
          <button type="button" class="pv-as-chip" data-pdf>PDF preventivo</button>
        </div>
        <p class="pv-as-hint" id="pv-as-prev-alert"></p>
      </div>`
    );
    if (fresh) {
      panel.querySelector("[data-cmp]")?.addEventListener("click", () => {
        const raw = readJson("viavia-preventivo-v2", null) || {};
        const scenarios = raw.scenarios || raw || {};
        const keys = Object.keys(scenarios).filter((k) => scenarios[k]?.totals || scenarios[k]?.groupCents);
        const lines =
          keys.length > 0
            ? keys
                .map((k) => {
                  const t = scenarios[k];
                  const cents = t.totals?.groupCents ?? t.groupCents ?? 0;
                  return `<li><strong>${escapeHtml(k)}</strong>: ${(cents / 100).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}</li>`;
                })
                .join("")
            : "<li>Nessuno scenario salvato nel preventivo locale.</li>";
        openSimpleModal("Confronto scenari", `<ul>${lines}</ul>`);
      });
      panel.querySelector("[data-pdf]")?.addEventListener("click", () => {
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(
          `<html><head><title>Preventivo</title><style>body{font:14px sans-serif;padding:24px}</style></head><body><h1>Preventivo Pronti? VIA!</h1><p>Apri il preventivo nel viaggio e usa Stampa del browser.</p><script>print()<\/script></body></html>`
        );
        w.document.close();
      });
    }
    void refreshPreventivoAlert(panel.querySelector("#pv-as-prev-alert"));
    showOnlyPanel("pv-as-panel-preventivo");
  }

  async function refreshPreventivoAlert(el) {
    if (!el) return;
    const packed = await loadTripSafe();
    if (!packed) return;
    const spent = (packed.trip.expenses || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const budget = Number(packed.trip.budget || 0);
    const prev = packed.trip.meta?.preventivo?.totals?.groupCents;
    const cap = prev || budget;
    if (!cap) {
      el.textContent = "Imposta un budget o salva un preventivo per gli alert.";
      return;
    }
    if (spent > cap) {
      el.innerHTML = `<span class="pv-as-badge err">Oltre preventivo</span> spese ${(spent / 100).toLocaleString(
        "it-IT",
        { style: "currency", currency: "EUR" }
      )} su ${(cap / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`;
    } else {
      el.innerHTML = `<span class="pv-as-badge ok">In linea</span> usato ${Math.round(
        (spent / cap) * 100
      )}% del tetto`;
    }
  }

  /* ===================== BOOKINGS ===================== */
  function enhanceBookings() {
    const auth = tripAuth();
    if (!auth) return;
    if (!(tabIs("prenotazioni") || sectionHeading(/prenotazioni/i))) return;

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-bookings",
      `<div class="pv-as-card pv-as-book-panel">
        <strong>Stato prenotazioni</strong>
        <p class="pv-as-hint">Registra stato, scadenza cancellazione e promemoria allegato (sul dispositivo).</p>
        <div class="pv-as-row">
          <input type="text" id="pv-as-book-title" placeholder="Nome prenotazione (es. Hotel Addis)" style="flex:1;min-width:160px" />
          <select id="pv-as-book-status" aria-label="Stato">
            <option value="todo">Da prenotare</option>
            <option value="confirmed">Confermato</option>
            <option value="paid">Pagato</option>
          </select>
          <input type="date" id="pv-as-book-cancel" aria-label="Scadenza cancellazione" />
          <button type="button" class="pv-as-chip primary" id="pv-as-book-save">Salva stato</button>
        </div>
        <ul id="pv-as-book-list" style="margin:8px 0 0;padding-left:18px"></ul>
      </div>`
    );
    const list = panel.querySelector("#pv-as-book-list");
    const render = () => {
      const data = readJson(BOOKING_META_KEY, {})[auth.id] || {};
      const rows = Object.entries(data);
      if (!list) return;
      list.innerHTML = rows.length
        ? rows
            .map(
              ([k, v]) =>
                `<li><strong>${escapeHtml(v.title || k)}</strong> · ${
                  v.status === "paid" ? "Pagato" : v.status === "confirmed" ? "Confermato" : "Da prenotare"
                }${v.cancelBy ? ` · canc. entro ${escapeHtml(v.cancelBy)}` : ""}</li>`
            )
            .join("")
        : "<li>Nessuno stato salvato ancora.</li>";
    };
    if (fresh) {
      panel.querySelector("#pv-as-book-save")?.addEventListener("click", () => {
        const title = String(panel.querySelector("#pv-as-book-title")?.value || "").trim();
        if (!title) return toast("Scrivi il nome della prenotazione", "warn");
        const status = panel.querySelector("#pv-as-book-status")?.value || "todo";
        const cancelBy = panel.querySelector("#pv-as-book-cancel")?.value || "";
        const all = readJson(BOOKING_META_KEY, {});
        const t = all[auth.id] || {};
        t[title.toLowerCase()] = { status, cancelBy, title };
        all[auth.id] = t;
        writeJson(BOOKING_META_KEY, all);
        enqueueSync({ type: "booking-meta", tripId: auth.id });
        render();
        toast("Stato prenotazione salvato", "ok");
        if (cancelBy) toast(`Reminder cancellazione: ${cancelBy}`, "warn");
      });
    }
    render();
    showOnlyPanel("pv-as-panel-bookings");
  }

  /* ===================== DOCUMENTS ===================== */
  function enhanceDocuments() {
    const auth = tripAuth();
    if (!auth) return;
    if (!(tabIs("documenti") || sectionHeading(/documenti/i))) return;

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-docs",
      `<div class="pv-as-card pv-as-docs">
        <strong>Cartelle documenti & scadenze</strong>
        <div class="pv-as-bar">
          ${["Voli", "Hotel", "Assicurazione", "Visti", "Altro"]
            .map((f) => `<button type="button" class="pv-as-chip" data-folder="${f}">${f}</button>`)
            .join("")}
        </div>
        <div class="pv-as-row">
          <input type="text" id="pv-as-doc-title" placeholder="Nome documento" />
          <input type="date" id="pv-as-doc-exp" aria-label="Scadenza" />
          <button type="button" class="pv-as-chip primary" id="pv-as-doc-add">Aggiungi</button>
        </div>
        <ul class="pv-as-hint" id="pv-as-doc-list" style="padding-left:18px"></ul>
        <p class="pv-as-hint">Scanner: usa la fotocamera del telefono sull’allegato in Prenotazioni o qui in note.</p>
      </div>`
    );
    let folder = panel.dataset.folder || "Altro";
    const render = () => {
      const list = panel.querySelector("#pv-as-doc-list");
      const items = (readJson(DOC_META_KEY, {})[auth.id] || []).slice().reverse();
      if (!list) return;
      list.innerHTML = items.length
        ? items
            .map(
              (d) =>
                `<li><strong>${escapeHtml(d.folder)}</strong> · ${escapeHtml(d.title)}${
                  d.exp ? ` · scade ${escapeHtml(d.exp)}` : ""
                }</li>`
            )
            .join("")
        : "<li>Nessun documento annotato.</li>";
    };
    if (fresh) {
      panel.querySelectorAll("[data-folder]").forEach((b) =>
        b.addEventListener("click", () => {
          folder = b.getAttribute("data-folder") || "Altro";
          panel.dataset.folder = folder;
          panel.querySelectorAll("[data-folder]").forEach((x) => x.classList.toggle("on", x === b));
        })
      );
      panel.querySelector("#pv-as-doc-add")?.addEventListener("click", () => {
        const title = String(panel.querySelector("#pv-as-doc-title")?.value || "").trim();
        const exp = panel.querySelector("#pv-as-doc-exp")?.value || "";
        if (!title) return;
        const db = readJson(DOC_META_KEY, {});
        const arr = db[auth.id] || [];
        arr.push({ title, exp, folder: panel.dataset.folder || folder, at: Date.now() });
        db[auth.id] = arr.slice(-40);
        writeJson(DOC_META_KEY, db);
        panel.querySelector("#pv-as-doc-title").value = "";
        render();
        if (exp && exp < new Date(Date.now() + 864e5 * 60).toISOString().slice(0, 10)) {
          toast("Attenzione: scadenza entro 60 giorni", "warn");
        }
      });
    }
    render();
    showOnlyPanel("pv-as-panel-docs");
  }

  /* ===================== PACKING ===================== */
  function enhancePacking() {
    const auth = tripAuth();
    if (!auth) return;
    if (!(tabIs("valigia", "checklist") || sectionHeading(/valigia|da mettere|checklist|cosa mettere/i))) return;

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-pack",
      `<div class="pv-as-card pv-as-pack">
        <strong>Valigia smart</strong>
        <div class="pv-as-row">
          <button type="button" class="pv-as-chip" data-gen>Suggerisci da meteo/destinazione</button>
          <button type="button" class="pv-as-chip" data-assign>Assegna oggetti</button>
        </div>
        <div class="pv-as-progress" title="Progresso"><span id="pv-as-pack-bar" style="width:0%"></span></div>
        <p class="pv-as-hint" id="pv-as-pack-hint"></p>
      </div>`
    );
    const refresh = async () => {
      const packed = await loadTripSafe();
      if (!packed) return;
      const list = packed.trip.checklist || [];
      const done = list.filter((c) => c.done).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const bar = panel.querySelector("#pv-as-pack-bar");
      if (bar) bar.style.width = `${pct}%`;
      const hint = panel.querySelector("#pv-as-pack-hint");
      const assign = readJson(PACK_ASSIGN_KEY, {})[auth.id] || {};
      const assigned = Object.entries(assign)
        .slice(0, 8)
        .map(([title, who]) => `${who}: ${title}`)
        .join(" · ");
      if (hint) {
        hint.textContent = list.length
          ? `${done}/${list.length} pronti (${pct}%)${assigned ? ` · ${assigned}` : ""}`
          : "Lista vuota";
      }
    };
    if (fresh) {
      panel.querySelector("[data-gen]")?.addEventListener("click", () => void generatePacking());
      panel.querySelector("[data-assign]")?.addEventListener("click", () => void assignPacking());
    }
    void refresh();
    showOnlyPanel("pv-as-panel-pack");
  }

  async function generatePacking() {
    const packed = await loadTripSafe();
    if (!packed) return toast("Apri un viaggio", "warn");
    const { auth, trip, revision } = packed;
    const dest = String(trip.destination || "").toLowerCase();
    const items = ["Documento d’identità", "Caricabatterie", "Medicine base"];
    if (/etiop|kenya|tanzania|thailand|bali|india/.test(dest)) items.push("Repellente", "Cappello sole");
    if (/island|norveg|svezia|finland|canada|alpi/.test(dest)) items.push("Giacca antivento", "Strati termici");
    if (/mare|spiaggia|maldives|sardegna|sicilia/.test(dest)) items.push("Costume", "Crema solare");
    trip.checklist = Array.isArray(trip.checklist) ? trip.checklist : [];
    const existing = new Set(trip.checklist.map((c) => String(c.title || "").toLowerCase()));
    let added = 0;
    for (const title of items) {
      if (existing.has(title.toLowerCase())) continue;
      trip.checklist.push({ id: crypto.randomUUID(), title, done: false });
      added++;
    }
    try {
      await saveTripSafe(auth, trip, revision);
      toast(added ? `Aggiunti ${added} oggetti` : "Lista già aggiornata", "ok");
      setTimeout(() => location.reload(), 350);
    } catch (err) {
      toast(err.message || "Errore", "err");
    }
  }

  async function assignPacking() {
    const packed = await loadTripSafe();
    if (!packed?.auth) return;
    const members = packed.trip.members || [];
    if (!members.length) return;
    const assign = readJson(PACK_ASSIGN_KEY, {});
    const map = assign[packed.auth.id] || {};
    (packed.trip.checklist || []).forEach((c, i) => {
      const m = members[i % members.length];
      map[String(c.title || "").toLowerCase()] = m.name;
    });
    assign[packed.auth.id] = map;
    writeJson(PACK_ASSIGN_KEY, assign);
    toast("Oggetti assegnati a turno ai compagni", "ok");
    enhancePacking();
  }

  /* ===================== NOTES ===================== */
  function enhanceNotes() {
    const auth = tripAuth();
    if (!auth) return;
    if (!(tabIs(/^note$/i) || sectionHeading(/^note$/i))) return;

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-notes",
      `<div class="pv-as-card">
        <strong>Note & versioni</strong>
        <div class="pv-as-bar pv-as-notes-bar">
          <button type="button" class="pv-as-chip" data-snap>Salva versione</button>
          <button type="button" class="pv-as-chip" data-hist>Cronologia</button>
        </div>
        <p class="pv-as-hint">Scrivi @nome nella nota per menzionare un compagno. Le versioni restano su questo dispositivo.</p>
      </div>`
    );
    if (fresh) {
      panel.querySelector("[data-snap]")?.addEventListener("click", async () => {
        const packed = await loadTripSafe();
        const text = packed?.trip?.notes || "";
        const db = readJson(NOTE_HIST_KEY, {});
        const arr = db[auth.id] || [];
        arr.unshift({ at: Date.now(), text });
        db[auth.id] = arr.slice(0, 20);
        writeJson(NOTE_HIST_KEY, db);
        toast("Versione note salvata sul dispositivo", "ok");
      });
      panel.querySelector("[data-hist]")?.addEventListener("click", () => {
        const arr = readJson(NOTE_HIST_KEY, {})[auth.id] || [];
        openSimpleModal(
          "Cronologia note",
          arr.length
            ? `<ul>${arr
                .map(
                  (v) =>
                    `<li><strong>${new Date(v.at).toLocaleString("it-IT")}</strong><pre style="white-space:pre-wrap;font:inherit">${escapeHtml(
                      (v.text || "").slice(0, 500)
                    )}</pre></li>`
                )
                .join("")}</ul>`
            : "<p>Nessuna versione salvata.</p>"
        );
      });
    }
    showOnlyPanel("pv-as-panel-notes");
  }

  /* ===================== SHARE ===================== */
  function enhanceShare() {
    // Only when share UI is the focus (dialog/section), not merely because the header button exists.
    const shareDialog = [...document.querySelectorAll('[role="dialog"], section, aside, .card')].find((el) =>
      /link di modifica|copia link|condividi questo viaggio|chiunque abbia il link/i.test(el.textContent || "")
    );
    const shareHeading = sectionHeading(/condivid/i);
    if (!shareDialog && !shareHeading && !tabIs("condivid")) return;

    const { panel, fresh } = mountSectionPanel(
      "pv-as-panel-share",
      `<div class="pv-as-card pv-as-share-card">
        <strong>Condivisione chiara</strong>
        <p class="pv-as-hint">Link di modifica = tutti possono cambiare. Per sola lettura usa il link view se disponibile.</p>
        <div class="pv-as-row">
          <button type="button" class="pv-as-chip" data-preview>Anteprima ospite</button>
          <button type="button" class="pv-as-chip" data-revoke>Revoca su questo device</button>
        </div>
      </div>`
    );
    if (fresh) {
      panel.querySelector("[data-preview]")?.addEventListener("click", () => {
        openSimpleModal(
          "Anteprima ospite",
          `<p>Chi apre il link vede itinerario, spese, documenti e note del viaggio. Non vede il tuo budget privato né scontrini/FX salvati solo su questo dispositivo.</p>`
        );
      });
      panel.querySelector("[data-revoke]")?.addEventListener("click", () => {
        try {
          const auth = tripAuth();
          if (!auth) return;
          const db = readJson("viavia-share-blobs-v1", {});
          Object.keys(db).forEach((k) => {
            if (k.startsWith(auth.id)) delete db[k];
          });
          writeJson("viavia-share-blobs-v1", db);
          toast("Snapshot condivisione rimossi da questo dispositivo", "ok");
        } catch {
          toast("Revoca non riuscita", "err");
        }
      });
    }
    showOnlyPanel("pv-as-panel-share");
  }

  /* ===================== PRONTY ===================== */
  function enhancePronty() {
    const panel = document.querySelector("#pv-magic-panel");
    if (!panel || panel.querySelector(".pv-as-pronty")) return;
    const box = document.createElement("div");
    box.className = "pv-as-card pv-as-pronty";
    const saver = Boolean(readJson(DATA_SAVER_KEY, { on: false }).on);
    box.innerHTML = `
      <strong>Pronty contestuale</strong>
      <div class="pv-as-row">
        <button type="button" class="pv-as-chip" data-day>Idee per il giorno selezionato</button>
        <button type="button" class="pv-as-chip" data-morning>Aggiungi mattina tipo</button>
        <button type="button" class="pv-as-chip ${saver ? "on" : ""}" data-saver>Risparmio dati</button>
      </div>
    `;
    panel.querySelector(".pv-magic-body, .pv-chat, #pv-chat-log")?.insertAdjacentElement("beforebegin", box) ||
      panel.insertAdjacentElement("afterbegin", box);
    box.querySelector("[data-day]")?.addEventListener("click", () => {
      const day =
        document.querySelector(".day-strip button.selected > span:first-child")?.textContent ||
        "oggi";
      const input = document.querySelector("#pv-chat-input");
      if (input) {
        input.value = `Suggerisci 3 tappe realistiche per ${day} con pausa pranzo, a piedi se possibile.`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      toast("Prompt pronto: invia a Pronty", "ok");
    });
    box.querySelector("[data-morning]")?.addEventListener("click", () => {
      const input = document.querySelector("#pv-chat-input");
      if (input) {
        input.value =
          "Proponi una mattina completa (colazione zona, 2 tappe, caffè) e aggiungile all’itinerario del giorno selezionato.";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
    });
    box.querySelector("[data-saver]")?.addEventListener("click", (ev) => {
      const on = !readJson(DATA_SAVER_KEY, { on: false }).on;
      writeJson(DATA_SAVER_KEY, { on });
      ev.currentTarget.classList.toggle("on", on);
      document.documentElement.dataset.pvDataSaver = on ? "1" : "0";
      toast(on ? "Risparmio dati on: meno foto/mappe automatiche" : "Risparmio dati off", "ok");
    });
    if (saver) document.documentElement.dataset.pvDataSaver = "1";
  }

  /* ===================== EXPENSE META CLOUD SYNC ===================== */
  async function pushExpenseMetaToTrip(tripId, key) {
    const auth = tripId && key ? { id: tripId, key } : tripAuth();
    if (!auth) return;
    const meta = readJson(EXPENSE_META_KEY, {})[auth.id];
    if (!meta) return;
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error("trip");
    const trip = data.trip;
    const marker = "<!--pv-fx-meta:";
    const payload = marker + btoa(unescape(encodeURIComponent(JSON.stringify(meta)))) + "-->";
    let notes = String(trip.notes || "");
    notes = notes.replace(/<!--pv-fx-meta:.*?-->/s, "").trim();
    trip.notes = notes ? `${notes}\n\n${payload}` : payload;
    await saveTripSafe(auth, trip, data.revision);
  }

  function enhanceExpenseCloudSync() {
    if (!document.querySelector(".pv-es-bar")) return;
    if (document.querySelector("[data-es-cloud]")) return;
    const bar = document.querySelector(".pv-es-bar");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pv-as-chip";
    btn.dataset.esCloud = "1";
    btn.setAttribute("data-es-cloud", "1");
    btn.textContent = "Sync FX sul viaggio";
    btn.title = "Salva meta valute/scontrini nelle note del viaggio (condivise)";
    btn.addEventListener("click", async () => {
      try {
        if (!navigator.onLine) {
          const auth = tripAuth();
          enqueueSync({ type: "expense-meta-cloud", tripId: auth?.id, key: auth?.key });
          toast("Offline: sync messo in coda", "warn");
          return;
        }
        await pushExpenseMetaToTrip();
        toast("Meta valute salvate nel viaggio condiviso", "ok");
      } catch (err) {
        toast(err.message || "Sync non riuscita", "err");
      }
    });
    bar.appendChild(btn);

    // OCR stub
    if (!document.querySelector("[data-es-ocr]")) {
      const ocr = document.createElement("button");
      ocr.type = "button";
      ocr.className = "pv-as-chip";
      ocr.dataset.esOcr = "1";
      ocr.setAttribute("data-es-ocr", "1");
      ocr.textContent = "OCR scontrino";
      ocr.addEventListener("click", () => {
        openSimpleModal(
          "OCR scontrino",
          `<p>Carica lo scontrino nel form spesa: l’importo locale resta manuale (OCR automatico completo arriverà con il cloud). Per ora usa la foto come promemoria.</p>`
        );
      });
      bar.appendChild(ocr);
    }
  }

  /* ===================== PWA / OFFLINE ===================== */
  let deferredInstall = null;
  function setupPwa() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstall = e;
      showInstallBanner();
    });
    if (!navigator.onLine) refreshSyncChip();
    window.addEventListener("online", () => {
      refreshSyncChip();
      void flushSyncQueue();
      toast("Di nuovo online", "ok");
    });
    window.addEventListener("offline", () => {
      refreshSyncChip();
      toast("Modalità offline attiva", "warn");
    });
    injectCacheStatus();
  }

  function showInstallBanner() {
    if (sessionStorage.getItem("pv-as-install-dismissed")) return;
    let bar = document.getElementById("pv-as-install");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "pv-as-install";
      bar.className = "pv-as-install";
      bar.innerHTML = `
        <div style="flex:1;font:600 13px/1.35 inherit">Installa Pronti? VIA! per usarla anche offline</div>
        <button type="button" class="go">Installa</button>
        <button type="button" class="no">Non ora</button>
      `;
      document.body.appendChild(bar);
      bar.querySelector(".go")?.addEventListener("click", async () => {
        if (!deferredInstall) {
          openSimpleModal(
            "Installa su iPhone/iPad",
            `<p>Su iOS: Condividi → <strong>Aggiungi a Home</strong>. Su Android usa il banner Installa o il menu del browser.</p>`
          );
          return;
        }
        deferredInstall.prompt();
        await deferredInstall.userChoice;
        deferredInstall = null;
        bar.classList.remove("show");
      });
      bar.querySelector(".no")?.addEventListener("click", () => {
        sessionStorage.setItem("pv-as-install-dismissed", "1");
        bar.classList.remove("show");
      });
    }
    bar.classList.add("show");
  }

  async function injectCacheStatus() {
    if (!("caches" in window)) return;
    let el = document.getElementById("pv-as-cache-status");
    // Don't crowd the trip UI when online — only nudge when offline.
    if (!tripAuth() || navigator.onLine) {
      el?.remove();
      return;
    }
    const keys = await caches.keys();
    if (!el) {
      el = document.createElement("div");
      el.id = "pv-as-cache-status";
      el.className = "pv-as-cache";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.textContent = keys.length
      ? `Offline · cache ${keys[0].replace(/^pv-shell-/, "")}`
      : "Offline · apri online una volta per la cache";
  }

  function openSimpleModal(title, html) {
    let root = document.getElementById("pv-as-modal");
    if (!root) {
      root = document.createElement("div");
      root.id = "pv-as-modal";
      root.style.cssText =
        "position:fixed;inset:0;z-index:130000;display:grid;place-items:end center;background:rgba(12,32,40,.45)";
      root.innerHTML = `<div style="background:#fff;width:min(100%,520px);max-height:85vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 16px 24px;position:relative">
        <button type="button" data-close style="position:absolute;top:10px;right:10px;border:0;width:36px;height:36px;border-radius:999px;background:#eef5f5;cursor:pointer">×</button>
        <h2 id="pv-as-modal-title" style="margin:0 0 10px;font-size:1.2rem"></h2>
        <div id="pv-as-modal-body"></div>
      </div>`;
      document.body.appendChild(root);
      root.addEventListener("click", (ev) => {
        if (ev.target === root || ev.target?.closest?.("[data-close]")) root.remove();
      });
    }
    root.querySelector("#pv-as-modal-title").textContent = title;
    root.querySelector("#pv-as-modal-body").innerHTML = html;
  }

  /* ===================== TICK ===================== */
  function safe(fn) {
    try {
      fn();
    } catch (err) {
      console.warn("[app-suite]", err);
    }
  }

  function tick() {
    ensureStyles();
    safe(enhanceHomeTrips);
    safe(enhanceNewTripForm);
    safe(enhanceAccountChip);
    if (tripAuth()) {
      safe(enhanceItineraryStops);
      safe(() => {
        void repairInvalidStopDays();
      });
      safe(enhancePlaces);
      safe(enhanceMapFrame);
      safe(enhancePreventivo);
      safe(enhanceBookings);
      safe(enhanceDocuments);
      safe(enhancePacking);
      safe(enhanceNotes);
      safe(enhanceShare);
      safe(enhancePronty);
      safe(enhanceExpenseCloudSync);
      safe(refreshSyncChip);
      safe(syncPortalVisibility);
      void injectCacheStatus().catch(() => {});
    }
    // Outside a trip, home/new-trip enhancers own portal visibility.
  }

  setupPwa();
  const obs = new MutationObserver(() => {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 400);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => setTimeout(tick, 500));
  addEventListener("scroll", () => placePortal(), { passive: true });
  addEventListener("resize", () => placePortal());
  setTimeout(tick, 700);
  setTimeout(tick, 2000);
  setTimeout(tick, 4500);

  window.__pvAppSuite = { ver: VER, tick, flushSyncQueue, enqueueSync, placePortal, dismissDock, reopenDock };
})();
