/**
 * Spese condivise — parità Splitwise (sidecar).
 * Non riscrive lo SPA: saldi, «chi deve a chi», settle one-tap, filtri,
 * note sulle spese, feed attività su trip.meta.expenseActivity.
 */
(() => {
  const STYLE_ID = "pv-splitwise-css";
  const BOARD_ID = "pv-splitwise-board";
  const ASSET_VER = "20261111d";
  const ACTIVITY_MAX = 80;

  let lastTripSnap = null;
  let renderBusy = false;
  let filterState = { member: "", category: "", q: "" };

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

  function euro(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
      (Number(cents) || 0) / 100
    );
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

  function nameOf(trip, id) {
    const m = (trip.members || []).find((x) => x.id === id);
    return m?.name || m?.username || id || "?";
  }

  function expensesSectionVisible() {
    const tab = document.querySelector(
      '[role=tab][data-state=active], [role=tab][aria-selected="true"]'
    );
    const label = (tab?.textContent || "").trim().toLowerCase();
    return /spese/.test(label);
  }

  function computeShareBalances(trip) {
    const plat = window.ProntiPlatform;
    if (plat?.computeShareBalances) return plat.computeShareBalances(trip);
    const bal = Object.fromEntries((trip.members || []).map((m) => [m.id, 0]));
    for (const e of trip.expenses || []) {
      const cents = Math.trunc(
        Number.isFinite(e.amountCents) ? e.amountCents : Number(e.amount) || 0
      );
      const payer = e.payer || e.paidBy;
      if (payer && payer in bal) bal[payer] += cents;
      for (const s of e.shares || []) {
        const mid = s.member || s.memberId;
        if (mid && mid in bal) bal[mid] -= Math.trunc(Number(s.amount) || 0);
      }
    }
    for (const t of trip.transfers || []) {
      const cents = Math.trunc(
        Number.isFinite(t.amountCents) ? t.amountCents : Number(t.amount) || 0
      );
      if (t.from && t.from in bal) bal[t.from] += cents;
      if (t.to && t.to in bal) bal[t.to] -= cents;
    }
    return bal;
  }

  function settleSuggestions(balances) {
    if (window.ProntiPlatform?.settleBalances) {
      return window.ProntiPlatform.settleBalances(balances).map((t) => ({
        from: t.from,
        to: t.to,
        amount: t.amountCents ?? t.amount,
      }));
    }
    const debtors = [];
    const creditors = [];
    for (const [id, v] of Object.entries(balances || {})) {
      const n = Math.trunc(v);
      if (n < 0) debtors.push({ id, amount: -n });
      else if (n > 0) creditors.push({ id, amount: n });
    }
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const out = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amount, creditors[j].amount);
      if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
      if (debtors[i].amount === 0) i += 1;
      if (creditors[j].amount === 0) j += 1;
    }
    return out;
  }

  function toast(msg, kind) {
    if (typeof window.__pvToast === "function") window.__pvToast(msg, kind || "ok");
    else if (typeof window.__pvSaveToast === "function") window.__pvSaveToast(msg);
  }

  async function fetchTripBundle() {
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

  async function putTrip(trip, revision, actorMemberId) {
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.key}`,
    };
    if (actorMemberId) headers["X-Pronti-Member-Id"] = actorMemberId;
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ trip, revision, actorMemberId: actorMemberId || undefined }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.status === 409) throw new Error("Versione non aggiornata. Ricarica e riprova.");
    if (!res.ok) throw new Error(out.error || "Salvataggio non riuscito");
    return out;
  }

  function snapshotExpenses(trip) {
    return {
      expenses: (trip.expenses || []).map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        payer: e.payer,
        category: e.category,
        shares: e.shares,
      })),
      transfers: (trip.transfers || []).map((t) => ({
        id: t.id,
        from: t.from,
        to: t.to,
        amount: t.amount,
      })),
    };
  }

  function diffActivity(prev, next, actor) {
    const events = [];
    const at = new Date().toISOString();
    const prevE = new Map((prev?.expenses || []).map((e) => [e.id, e]));
    const nextE = new Map((next?.expenses || []).map((e) => [e.id, e]));
    for (const [id, e] of nextE) {
      if (!prevE.has(id)) {
        events.push({
          at,
          actor,
          type: "add",
          expenseId: id,
          summary: `Ha aggiunto «${e.title || "spesa"}» · ${euro(e.amount)}`,
        });
      } else {
        const o = prevE.get(id);
        if (
          o.amount !== e.amount ||
          o.payer !== e.payer ||
          JSON.stringify(o.shares) !== JSON.stringify(e.shares) ||
          o.title !== e.title
        ) {
          events.push({
            at,
            actor,
            type: "edit",
            expenseId: id,
            summary: `Ha modificato «${e.title || "spesa"}»`,
          });
        }
      }
    }
    for (const [id, e] of prevE) {
      if (!nextE.has(id)) {
        events.push({
          at,
          actor,
          type: "delete",
          expenseId: id,
          summary: `Ha eliminato «${e.title || "spesa"}»`,
        });
      }
    }
    const prevT = new Map((prev?.transfers || []).map((t) => [t.id, t]));
    const nextT = new Map((next?.transfers || []).map((t) => [t.id, t]));
    for (const [id, t] of nextT) {
      if (!prevT.has(id)) {
        events.push({
          at,
          actor,
          type: "settle",
          transferId: id,
          summary: `Rimborso registrato · ${euro(t.amount)}`,
        });
      }
    }
    for (const [id] of prevT) {
      if (!nextT.has(id)) {
        events.push({ at, actor, type: "settle-delete", transferId: id, summary: "Rimborso rimosso" });
      }
    }
    return events;
  }

  function installActivityHook() {
    if (window.__pvSplitwiseHook) return;
    window.__pvSplitwiseHook = true;
    const prevFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      let nextInit = init;
      try {
        const url = String(typeof input === "string" ? input : input?.url || "");
        const method = String(init?.method || "GET").toUpperCase();
        if (method === "PUT" && /\/api\/trips\/[^/?#]+$/.test(url) && init?.body) {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
          if (body?.trip) {
            const actor =
              body.actorMemberId ||
              memberIdForTrip(body.trip) ||
              currentIdentity() ||
              "qualcuno";
            const snap = snapshotExpenses(body.trip);
            const events = lastTripSnap ? diffActivity(lastTripSnap, snap, actor) : [];
            if (events.length) {
              body.trip.meta = body.trip.meta && typeof body.trip.meta === "object" ? body.trip.meta : {};
              const prev = Array.isArray(body.trip.meta.expenseActivity)
                ? body.trip.meta.expenseActivity
                : [];
              body.trip.meta.expenseActivity = [...prev, ...events].slice(-ACTIVITY_MAX);
              nextInit = { ...init, body: JSON.stringify(body) };
            }
            lastTripSnap = snap;
          }
        }
      } catch {
        /* never block writes */
      }
      const res = await prevFetch(input, nextInit);
      try {
        if (expensesSectionVisible()) scheduleRender();
      } catch {
        /* ignore */
      }
      return res;
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${BOARD_ID}{
        margin: 12px 0 18px; padding: 14px 14px 12px; border-radius: 18px;
        border: 1px solid rgba(20,52,58,.14);
        background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(236,245,247,.96));
        box-shadow: 0 10px 28px rgba(16,42,48,.07);
        color: #102f36;
      }
      #${BOARD_ID} .pv-sw-head{
        display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:space-between;
        margin-bottom: 10px;
      }
      #${BOARD_ID} .pv-sw-kicker{
        margin:0; font:700 .72rem/1.2 inherit; letter-spacing:.04em; text-transform:uppercase; color:#007d82;
      }
      #${BOARD_ID} h3{ margin:2px 0 0; font:800 1.05rem/1.25 inherit; color:#102f36 }
      #${BOARD_ID} .pv-sw-me{
        margin: 0 0 12px; padding: 12px 14px; border-radius: 14px;
        background: color-mix(in srgb, #007d82 10%, #fff);
        border: 1px solid color-mix(in srgb, #007d82 22%, transparent);
        font: 700 .95rem/1.35 inherit;
      }
      #${BOARD_ID} .pv-sw-me.owe{ background:#fff4e8; border-color:#f0d2b0; color:#7a3e00 }
      #${BOARD_ID} .pv-sw-me.ok{ background:#e8f7ef; border-color:#b7e4c7; color:#0f5c38 }
      #${BOARD_ID} .pv-sw-filters{
        display:flex; flex-wrap:wrap; gap:8px; margin: 0 0 12px;
      }
      #${BOARD_ID} .pv-sw-filters input, #${BOARD_ID} .pv-sw-filters select{
        border:1px solid #c9dbdb; border-radius:12px; padding:8px 10px; font:600 .85rem inherit;
        background:#fff; color:#102f36; min-width:0;
      }
      #${BOARD_ID} .pv-sw-filters input{ flex:1 1 140px }
      #${BOARD_ID} .pv-sw-section{ margin-top: 12px }
      #${BOARD_ID} .pv-sw-section h4{
        margin:0 0 8px; font:800 .88rem/1.2 inherit; color:#16353b;
      }
      #${BOARD_ID} .pv-sw-bal{
        display:grid; gap:8px;
      }
      #${BOARD_ID} .pv-sw-bal-row{
        display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center;
      }
      #${BOARD_ID} .pv-sw-bal-row .bar{
        height:8px; border-radius:99px; background:rgba(20,52,58,.08); overflow:hidden; margin-top:4px;
      }
      #${BOARD_ID} .pv-sw-bal-row .bar > i{
        display:block; height:100%; border-radius:99px; background:#007d82;
      }
      #${BOARD_ID} .pv-sw-bal-row.neg .bar > i{ background:#b45309 }
      #${BOARD_ID} .pv-sw-settle{ display:grid; gap:8px }
      #${BOARD_ID} .pv-sw-settle-row{
        display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;
        padding:10px 12px; border-radius:14px; background:#fff; border:1px solid #d9e7e7;
      }
      #${BOARD_ID} .pv-sw-settle-row p{ margin:0; font:600 .88rem/1.35 inherit }
      #${BOARD_ID} .pv-sw-settle-row button, #${BOARD_ID} .pv-sw-actions button, #${BOARD_ID} .pv-sw-note-btn{
        appearance:none; border:0; border-radius:999px; padding:8px 12px; font:700 .8rem inherit;
        background:#007d82; color:#fff; cursor:pointer;
      }
      #${BOARD_ID} .pv-sw-actions{ display:flex; flex-wrap:wrap; gap:8px; margin-top:12px }
      #${BOARD_ID} .pv-sw-actions button.ghost{
        background:#eef5f5; color:#16353b;
      }
      #${BOARD_ID} .pv-sw-activity{ list-style:none; margin:0; padding:0; display:grid; gap:6px }
      #${BOARD_ID} .pv-sw-activity li{
        margin:0; padding:8px 10px; border-radius:12px; background:#fff; border:1px solid #e3eeee;
        font:600 .8rem/1.35 inherit; color:#3a545b;
      }
      #${BOARD_ID} .pv-sw-activity time{ display:block; font-size:.72rem; color:#6a8187; font-weight:700 }
      #${BOARD_ID} .pv-sw-muted{ margin:0; color:#5b7076; font:600 .82rem/1.4 inherit }
      .pv-sw-expense-tools{
        display:inline-flex; gap:6px; margin-left:8px; vertical-align:middle;
      }
      .pv-sw-expense-tools button{
        appearance:none; border:1px solid #c9dbdb; background:#fff; color:#16353b;
        border-radius:999px; padding:3px 8px; font:700 .72rem inherit; cursor:pointer;
      }
      .expense-columns li[data-pv-sw-hide="1"],
      .expense-list li[data-pv-sw-hide="1"]{ display:none !important }
    `;
    document.head.appendChild(s);
  }

  function findSpeseMount() {
    const h2 = [...document.querySelectorAll("h2")].find((el) =>
      /Spese di gruppo/i.test(el.textContent || "")
    );
    if (!h2) return null;
    // Prefer inserting after the heading block / before "Chi ha pagato".
    const paid = [...document.querySelectorAll("h3")].find((el) =>
      /Chi ha pagato cosa/i.test(el.textContent || "")
    );
    if (paid?.parentElement) return { before: paid.parentElement };
    return { after: h2 };
  }

  function ensureBoard() {
    ensureStyles();
    let board = document.getElementById(BOARD_ID);
    if (board) return board;
    const mount = findSpeseMount();
    if (!mount) return null;
    board = document.createElement("section");
    board.id = BOARD_ID;
    board.setAttribute("aria-label", "Spese condivise stile Splitwise");
    if (mount.before) mount.before.parentElement.insertBefore(board, mount.before);
    else mount.after.insertAdjacentElement("afterend", board);
    board.addEventListener("click", onBoardClick);
    board.addEventListener("change", onBoardChange);
    board.addEventListener("input", onBoardChange);
    return board;
  }

  function onBoardChange(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches("[data-sw-filter]")) {
      filterState = {
        member: boardValue("member"),
        category: boardValue("category"),
        q: boardValue("q"),
      };
      applyExpenseFilters();
    }
  }

  function boardValue(name) {
    const el = document.querySelector(`#${BOARD_ID} [data-sw-filter="${name}"]`);
    return String(el?.value || "").trim();
  }

  async function onBoardClick(ev) {
    const btn = ev.target?.closest?.("button[data-sw]");
    if (!btn) return;
    const act = btn.getAttribute("data-sw");
    if (act === "refresh") {
      await renderBoard(true);
      return;
    }
    if (act === "settle") {
      const from = btn.getAttribute("data-from");
      const to = btn.getAttribute("data-to");
      const amount = Number(btn.getAttribute("data-amount") || 0);
      await recordSettlement(from, to, amount, btn);
      return;
    }
    if (act === "goto-add") {
      const addBtn = [...document.querySelectorAll("button")].find((b) =>
        /Aggiungi una spesa/i.test(b.textContent || "")
      );
      addBtn?.click();
      return;
    }
    if (act === "goto-transfer") {
      const tBtn = [...document.querySelectorAll("button")].find((b) =>
        /Registra un rimborso|Registra rimborso/i.test(b.textContent || "")
      );
      tBtn?.click();
      return;
    }
  }

  async function recordSettlement(from, to, amount, btn) {
    if (!from || !to || !(amount > 0)) return;
    const note = window.prompt(
      "Nota sul rimborso (opzionale). Confermi la registrazione? Il denaro resta fuori dall'app — qui aggiorniamo solo i saldi.",
      ""
    );
    if (note === null) return; // cancelled
    btn.disabled = true;
    try {
      const bundle = await fetchTripBundle();
      if (!bundle) throw new Error("Apri un viaggio");
      if (bundle.data.canEdit === false) throw new Error("Solo lettura");
      const trip = structuredClone
        ? structuredClone(bundle.trip)
        : JSON.parse(JSON.stringify(bundle.trip));
      trip.transfers = Array.isArray(trip.transfers) ? trip.transfers : [];
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `tr_${Date.now().toString(36)}`;
      const transfer = {
        id,
        from,
        to,
        amount: Math.trunc(amount),
        date: new Date().toISOString().slice(0, 10),
      };
      if (String(note || "").trim()) transfer.notes = String(note).trim().slice(0, 200);
      trip.transfers.push(transfer);
      trip.meta = trip.meta && typeof trip.meta === "object" ? trip.meta : {};
      const actor = memberIdForTrip(trip) || currentIdentity() || "tu";
      const prev = Array.isArray(trip.meta.expenseActivity) ? trip.meta.expenseActivity : [];
      trip.meta.expenseActivity = [
        ...prev,
        {
          at: new Date().toISOString(),
          actor,
          type: "settle",
          transferId: id,
          summary: `${nameOf(trip, from)} → ${nameOf(trip, to)} · ${euro(amount)}${
            transfer.notes ? ` · ${transfer.notes}` : ""
          }`,
        },
      ].slice(-ACTIVITY_MAX);
      lastTripSnap = snapshotExpenses(trip);
      await putTrip(trip, bundle.data.revision, actor);
      toast("Rimborso registrato — saldi aggiornati", "ok");
      // Soft refresh SPA: hash poke or reload trip view
      try {
        window.dispatchEvent(new CustomEvent("pv:trip-mutated", { detail: { reason: "settle" } }));
      } catch {
        /* ignore */
      }
      await renderBoard(true);
      // Nudge React: many builds refetch on focus
      window.dispatchEvent(new Event("focus"));
    } catch (err) {
      toast(err?.message || "Rimborso non salvato", "warn");
    } finally {
      btn.disabled = false;
    }
  }

  async function addExpenseComment(expenseId, expenseTitle) {
    const text = window.prompt(`Nota su «${expenseTitle || "spesa"}»`, "");
    if (text == null || !String(text).trim()) return;
    try {
      const bundle = await fetchTripBundle();
      if (!bundle) throw new Error("Apri un viaggio");
      if (bundle.data.canEdit === false) throw new Error("Solo lettura");
      const trip = structuredClone
        ? structuredClone(bundle.trip)
        : JSON.parse(JSON.stringify(bundle.trip));
      trip.meta = trip.meta && typeof trip.meta === "object" ? trip.meta : {};
      const map = trip.meta.expenseComments && typeof trip.meta.expenseComments === "object"
        ? trip.meta.expenseComments
        : {};
      const list = Array.isArray(map[expenseId]) ? map[expenseId] : [];
      const actor = memberIdForTrip(trip) || currentIdentity() || "tu";
      list.push({
        at: new Date().toISOString(),
        author: actor,
        text: String(text).trim().slice(0, 280),
      });
      map[expenseId] = list.slice(-20);
      trip.meta.expenseComments = map;
      const prev = Array.isArray(trip.meta.expenseActivity) ? trip.meta.expenseActivity : [];
      trip.meta.expenseActivity = [
        ...prev,
        {
          at: new Date().toISOString(),
          actor,
          type: "comment",
          expenseId,
          summary: `Nota su «${expenseTitle || "spesa"}»`,
        },
      ].slice(-ACTIVITY_MAX);
      await putTrip(trip, bundle.data.revision, actor);
      toast("Nota salvata", "ok");
      await renderBoard(true);
      decorateExpenseRows(trip);
    } catch (err) {
      toast(err?.message || "Nota non salvata", "warn");
    }
  }

  function decorateExpenseRows(trip) {
    const comments = trip?.meta?.expenseComments || {};
    const items = document.querySelectorAll(".expense-columns li, .expense-list li");
    for (const li of items) {
      if (li.closest(`#${BOARD_ID}`)) continue;
      if (li.querySelector(".pv-sw-expense-tools")) continue;
      const titleEl = li.querySelector("strong, h4, .title") || li;
      const title = (titleEl.textContent || "").trim().slice(0, 80);
      // Match expense by title + amount text when id not in DOM
      const match = (trip.expenses || []).find((e) => {
        const t = String(e.title || "");
        return t && title.includes(t);
      });
      if (!match) continue;
      const tools = document.createElement("span");
      tools.className = "pv-sw-expense-tools";
      const n = (comments[match.id] || []).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = n ? `💬 ${n}` : "💬 Nota";
      btn.title = "Aggiungi nota (stile Splitwise)";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void addExpenseComment(match.id, match.title);
      });
      tools.appendChild(btn);
      const anchor = li.querySelector("strong, h4") || li.firstChild;
      if (anchor?.parentElement) anchor.parentElement.appendChild(tools);
      else li.appendChild(tools);
      li.dataset.pvSwExpenseId = match.id;
      li.dataset.pvSwCategory = match.category || "";
      li.dataset.pvSwPayer = match.payer || "";
      li.dataset.pvSwTitle = match.title || "";
    }
    applyExpenseFilters();
  }

  function applyExpenseFilters() {
    const { member, category, q } = filterState;
    const qn = q.toLowerCase();
    const items = document.querySelectorAll(".expense-columns li, .expense-list li");
    for (const li of items) {
      const id = li.dataset.pvSwExpenseId || "";
      const cat = li.dataset.pvSwCategory || "";
      const payer = li.dataset.pvSwPayer || "";
      const title = (li.dataset.pvSwTitle || li.textContent || "").toLowerCase();
      let hide = false;
      if (member && payer !== member && id) hide = true;
      if (category && cat !== category) hide = true;
      if (qn && !title.includes(qn)) hide = true;
      li.dataset.pvSwHide = hide ? "1" : "0";
    }
  }

  function meSummary(trip, bal) {
    const mid = memberIdForTrip(trip);
    if (!mid || !(mid in bal)) {
      return {
        className: "",
        text: "Apri un viaggio e aggiungi i compagni per vedere il tuo saldo personale.",
      };
    }
    const v = Math.trunc(bal[mid] || 0);
    if (v > 0) return { className: "ok", text: `Tu: ti devono ${euro(v)}` };
    if (v < 0) return { className: "owe", text: `Tu: devi ${euro(-v)}` };
    return { className: "ok", text: "Tu: in pari con il gruppo" };
  }

  function renderHtml(trip) {
    const bal = computeShareBalances(trip);
    const me = meSummary(trip, bal);
    const maxAbs = Math.max(1, ...Object.values(bal).map((v) => Math.abs(v)));
    const members = trip.members || [];
    const cats = [
      ...new Set((trip.expenses || []).map((e) => e.category || "Altro").filter(Boolean)),
    ];
    const settles = settleSuggestions(bal);
    const activity = [...(trip.meta?.expenseActivity || [])].reverse().slice(0, 12);
    const balRows = members
      .map((m) => {
        const v = Math.trunc(bal[m.id] || 0);
        const pct = Math.round((Math.abs(v) / maxAbs) * 100);
        const label =
          v > 0 ? `credito ${euro(v)}` : v < 0 ? `debito ${euro(-v)}` : "in pari";
        return `<div class="pv-sw-bal-row${v < 0 ? " neg" : ""}">
          <div>
            <strong>${escapeHtml(m.name || m.id)}</strong>
            <div class="bar"><i style="width:${pct}%"></i></div>
          </div>
          <span>${escapeHtml(label)}</span>
        </div>`;
      })
      .join("");
    const settleRows = settles.length
      ? settles
          .map(
            (t) => `<div class="pv-sw-settle-row">
          <p><strong>${escapeHtml(nameOf(trip, t.from))}</strong> deve
            <strong>${euro(t.amount)}</strong> a
            <strong>${escapeHtml(nameOf(trip, t.to))}</strong></p>
          <button type="button" data-sw="settle" data-from="${escapeHtml(t.from)}"
            data-to="${escapeHtml(t.to)}" data-amount="${t.amount}">Registra rimborso</button>
        </div>`
          )
          .join("")
      : `<p class="pv-sw-muted">Tutti in pari — niente da saldare.</p>`;
    const actRows = activity.length
      ? activity
          .map((a) => {
            const when = String(a.at || "").slice(0, 16).replace("T", " ");
            const who = nameOf(trip, a.actor) !== "?" ? nameOf(trip, a.actor) : a.actor;
            return `<li><time datetime="${escapeHtml(a.at || "")}">${escapeHtml(when)}</time>
              <span>${escapeHtml(who)} · ${escapeHtml(a.summary || a.type || "")}</span></li>`;
          })
          .join("")
      : `<p class="pv-sw-muted">Le prossime spese e rimborsi compariranno qui (come il feed di Splitwise).</p>`;

    return `
      <div class="pv-sw-head">
        <div>
          <p class="pv-sw-kicker">Spese condivise</p>
          <h3>Come Splitwise, nel viaggio</h3>
        </div>
      </div>
      <div class="pv-sw-me ${me.className}">${escapeHtml(me.text)}</div>
      <div class="pv-sw-filters">
        <input data-sw-filter="q" type="search" placeholder="Cerca spesa…" value="${escapeHtml(filterState.q)}" />
        <select data-sw-filter="member">
          <option value="">Tutti i compagni</option>
          ${members
            .map(
              (m) =>
                `<option value="${escapeHtml(m.id)}" ${
                  filterState.member === m.id ? "selected" : ""
                }>${escapeHtml(m.name || m.id)}</option>`
            )
            .join("")}
        </select>
        <select data-sw-filter="category">
          <option value="">Tutte le categorie</option>
          ${cats
            .map(
              (c) =>
                `<option value="${escapeHtml(c)}" ${
                  filterState.category === c ? "selected" : ""
                }>${escapeHtml(c)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="pv-sw-section">
        <h4>Il saldo di ciascuno</h4>
        <div class="pv-sw-bal">${balRows || '<p class="pv-sw-muted">Nessun membro.</p>'}</div>
      </div>
      <div class="pv-sw-section">
        <h4>Come pareggiare i conti</h4>
        <div class="pv-sw-settle">${settleRows}</div>
      </div>
      <div class="pv-sw-section">
        <h4>Attività recente</h4>
        <ul class="pv-sw-activity">${actRows}</ul>
      </div>
      <div class="pv-sw-actions">
        <button type="button" data-sw="goto-add">Aggiungi spesa</button>
        <button type="button" class="ghost" data-sw="goto-transfer">Altro rimborso</button>
        <button type="button" class="ghost" data-sw="refresh">Aggiorna saldi</button>
      </div>
      <p class="pv-sw-muted" style="margin-top:10px">
        Divisione equa, %, quote e importi personalizzati restano nel modulo sotto
        («Come dividiamo?»). Qui trovi saldi, settle semplificato, note e cronologia.
      </p>
    `;
  }

  async function renderBoard(force) {
    if (!expensesSectionVisible()) {
      document.getElementById(BOARD_ID)?.remove();
      return;
    }
    if (renderBusy && !force) return;
    renderBusy = true;
    try {
      const board = ensureBoard();
      if (!board) return;
      if (!tripAuth()) {
        board.innerHTML = `<p class="pv-sw-muted">Apri un viaggio per gestire le spese condivise.</p>`;
        return;
      }
      const bundle = await fetchTripBundle();
      if (!bundle) return;
      lastTripSnap = snapshotExpenses(bundle.trip);
      board.innerHTML = renderHtml(bundle.trip);
      decorateExpenseRows(bundle.trip);
    } catch (err) {
      const board = document.getElementById(BOARD_ID);
      if (board) {
        board.innerHTML = `<p class="pv-sw-muted">${escapeHtml(err?.message || "Saldi non disponibili")}</p>`;
      }
    } finally {
      renderBusy = false;
    }
  }

  function scheduleRender() {
    clearTimeout(scheduleRender._t);
    scheduleRender._t = setTimeout(() => void renderBoard(false), 280);
  }

  // Expose helpers for Hub Numeri / tests
  window.__pvSplitwise = {
    ASSET_VER,
    computeShareBalances,
    settleSuggestions,
    renderBoard,
    diffActivity,
  };

  installActivityHook();
  const obs = new MutationObserver(() => scheduleRender());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => scheduleRender());
  setTimeout(() => void renderBoard(true), 700);
  setTimeout(() => void renderBoard(true), 1800);
})();
