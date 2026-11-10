/**
 * Pronti? VIA! — free UX suite (layout-safe).
 * Tools live in a modal from the account chip — no sticky strips over the trip.
 */
(() => {
  if (window.__pvUxSuiteBound) return;
  window.__pvUxSuiteBound = true;

  const STYLE_ID = "pv-ux-suite-css";
  const ACTIVITY_KEY = "viavia-activity-v1";
  const REVISIONS_KEY = "viavia-trip-revisions-v1";
  const ONBOARD_KEY = "viavia-onboard-v1";
  const INVITE_LOCAL_KEY = "viavia-invite-codes-v1";

  const TEMPLATES = [
    {
      id: "congresso",
      title: "Congresso / evento",
      days: 5,
      notes: "Hotel vicino al venue, trasferimenti, networking.",
      checklist: ["Badge / biglietto evento", "Biglietti viaggio", "Hotel confermato", "eSIM / roaming"],
    },
    {
      id: "weekend",
      title: "Weekend fuori porta",
      days: 3,
      notes: "Ritmi leggeri, 1–2 tappe al giorno.",
      checklist: ["Alloggio", "Trasporto", "Lista posti da vedere"],
    },
    {
      id: "road",
      title: "Road trip",
      days: 8,
      notes: "Tappe guida, pause, rifornimenti.",
      checklist: ["Auto / noleggio", "Assicurazione", "Mappe offline", "Perni di ricarica"],
    },
  ];

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root{
        --pv-ink:#12343c; --pv-muted:#526e76; --pv-line:#d2e2e5; --pv-teal:#007d82;
        --pv-teal-deep:#00656a; --pv-surface:#ffffff; --pv-wash:#f3f8f8;
        --pv-ease:cubic-bezier(.22,.8,.22,1);
        --pv-ease-out:cubic-bezier(.16,1,.3,1);
        --pv-motion:.32s;
        --pv-shadow:0 10px 28px rgba(16,42,48,.08);
      }
      html{scroll-behavior:smooth}
      @media (prefers-reduced-motion:reduce){
        html{scroll-behavior:auto}
        *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
      }
      /* Fluid shell: soft padding shifts, smoother taps */
      .app-shell{
        transition:padding-bottom var(--pv-motion) var(--pv-ease);
      }
      button,.button,[role="tab"],.pv-as-chip,.pv-es-bar button,.pv-menu-grid button{
        transition:transform .18s var(--pv-ease-out),background-color .2s ease,border-color .2s ease,box-shadow .2s ease,opacity .18s ease,color .18s ease;
      }
      button:active:not(:disabled),.button:active:not(:disabled),[role="tab"]:active{
        transform:scale(.97);
      }
      /* Capsule sotto dialog/select: non intercetta i tap (split spese, menu Radix) */
      body:has([role="dialog"][data-state="open"]) #pv-primary-nav,
      body:has([data-radix-select-content][data-state="open"]) #pv-primary-nav,
      body:has([role="listbox"]) #pv-primary-nav,
      body:has(.pv-ux-modal.pv-open) #pv-primary-nav,
      body.pv-magic-open #pv-primary-nav,
      body.pv-plat-open #pv-primary-nav{pointer-events:none}
      [data-slot="dialog-overlay"],[data-radix-dialog-overlay]{z-index:120180!important}
      [role="dialog"][data-slot="dialog-content"],[role="dialog"][data-state="open"],[data-radix-dialog-content]{z-index:120200!important}
      [data-radix-popper-content-wrapper],[data-radix-select-content],[role="listbox"],[data-slot="select-content"]{
        z-index:130050!important
      }
      /* Compact + fluid mobile tabs */
      @media (max-width:720px){
        [role="tablist"]{
          scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;
          overscroll-behavior-x:contain;
        }
        [role="tablist"] [role="tab"]{
          font-size:12px!important;padding-inline:10px!important;scroll-snap-align:start;
        }
      }
      /* Day cards / horizontal strips */
      .day-strip,[class*="day-strip"],[class*="DayStrip"]{
        scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;
      }
      /*
        Right-side FAB stack:
        - Senza primary nav: Pronty in basso, Preventivo sopra
        - Con primary nav: Pronty nascosto (IA in capsule), Preventivo sopra la nav
      */
      #pv-magic-root .pv-magic-btn{
        bottom:calc(18px + env(safe-area-inset-bottom,0px))!important;
        right:calc(14px + env(safe-area-inset-right,0px))!important;
        z-index:120050!important;
      }
      .pv-prev-launch{
        bottom:calc(90px + env(safe-area-inset-bottom,0px))!important;
        right:calc(14px + env(safe-area-inset-right,0px))!important;
        z-index:120060!important;
      }
      body.pv-primary-nav-ready .pv-prev-launch{
        bottom:calc(82px + env(safe-area-inset-bottom,0px))!important;
      }
      body.pv-primary-nav-ready #pv-magic-root .pv-magic-btn{
        display:none!important;
      }
      #pv-ux-toast{
        position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(8px);z-index:130000;max-width:min(440px,92vw);
        background:rgba(18,52,60,.94);color:#fff;padding:12px 16px;border-radius:16px;
        font:600 13px/1.35 inherit;box-shadow:0 14px 36px rgba(12,40,48,.28);
        opacity:0;pointer-events:none;
        transition:opacity .24s ease,transform .28s var(--pv-ease-out);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)
      }
      body.pv-primary-nav-ready #pv-ux-toast{
        bottom:calc(88px + env(safe-area-inset-bottom,0px));
      }
      #pv-ux-toast.show{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
      #pv-ux-toast.ok{background:rgba(15,90,64,.95)}
      #pv-ux-toast.warn{background:rgba(122,75,0,.95)}
      #pv-ux-toast.err{background:rgba(122,31,31,.95)}
      .pv-empty-state{
        margin:12px 0 18px;padding:18px 16px;border:1px dashed var(--pv-line);
        border-radius:16px;background:#f7fbfb;text-align:center
      }
      .pv-empty-state h3{margin:0 0 6px;font-size:1.05rem}
      .pv-empty-state p{margin:0 0 12px;color:var(--pv-muted);font-size:.9rem}
      .pv-empty-state button{
        appearance:none;border:0;border-radius:999px;padding:10px 14px;font:700 13px inherit;
        background:var(--pv-teal);color:#fff;cursor:pointer
      }
      .members-list .pv-role-badge{
        display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;
        font-size:.68rem;font-weight:700;background:#e8f4f4;color:#0f5a5e
      }
      .members-list .pv-role-badge.guest{background:#fff3cd;color:#7a5b00}
      /* Offline chip: top bar under account chrome (Hub no longer occupies bottom-left). */
      #pv-offline-chip{
        position:fixed;
        top:calc(54px + env(safe-area-inset-top,0px));
        left:50%;transform:translateX(-50%);
        z-index:99980;padding:6px 12px;border-radius:999px;display:none;
        font:700 11px/1.2 inherit;background:#7a1f1f;color:#fff;
        box-shadow:0 6px 16px rgba(0,0,0,.12)
      }
      #pv-offline-chip.show{display:inline-flex}
      body.pv-plat-open #pv-offline-chip{opacity:.85}
      .pv-menu-section{margin:0 0 16px}
      .pv-menu-section h3{
        margin:0 0 10px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:#6a828a;font-weight:750
      }
      .pv-menu-context{
        display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px;padding:12px 14px;
        border-radius:16px;background:linear-gradient(160deg,#eef7f7,#e6f2f2);
        border:1px solid rgba(0,125,130,.12);color:#16353b
      }
      .pv-menu-context strong{font-size:.82rem}
      .pv-menu-context em{
        font-style:normal;font-size:.7rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
        color:var(--pv-teal-deep);background:#fff;border:1px solid rgba(0,125,130,.16);
        border-radius:999px;padding:5px 11px;box-shadow:0 1px 0 rgba(0,125,130,.06)
      }
      .pv-menu-context p{margin:0;flex:1 1 100%;font-size:.78rem;color:#5b7380;line-height:1.4}
      .pv-menu-grid{display:grid;gap:9px}
      .pv-menu-grid button{
        appearance:none;border:1px solid rgba(18,52,60,.08);border-radius:16px;padding:13px 14px;
        background:var(--pv-surface);color:var(--pv-ink);font:650 14px/1.35 inherit;cursor:pointer;text-align:left;
        box-shadow:0 4px 14px rgba(16,42,48,.04)
      }
      .pv-menu-grid button:hover{border-color:rgba(0,125,130,.22);box-shadow:0 8px 20px rgba(16,42,48,.07)}
      .pv-menu-grid button strong{display:block;font-weight:800;margin-bottom:3px;letter-spacing:-.01em}
      .pv-menu-grid button span{display:block;color:#5b7380;font-size:.82rem;font-weight:500;line-height:1.35}
      .pv-menu-grid button.pv-menu-tools{
        border-color:rgba(0,125,130,.35);background:linear-gradient(165deg,#f5fcfc,#e8f5f5);
        box-shadow:0 6px 16px rgba(0,125,130,.08)
      }
      .pv-menu-grid button.pv-menu-tools strong{color:var(--pv-teal-deep)}
      .pv-menu-grid button.danger{border-color:#efcdc8;background:#fdf4f2;color:#7a2e28;box-shadow:none}
      .pv-trip-manage-list{display:grid;gap:10px;margin:4px 0 12px}
      .pv-trip-manage-row{
        display:flex;align-items:center;gap:10px;padding:12px;
        border:1px solid var(--pv-line);border-radius:14px;background:#f7fbfb
      }
      .pv-trip-manage-row .grow{flex:1;min-width:0}
      .pv-trip-manage-row strong{display:block;font-size:.95rem;color:var(--pv-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pv-trip-manage-row span{display:block;font-size:.78rem;color:var(--pv-muted);margin-top:2px}
      .pv-trip-manage-row .pv-ux-ghost{flex:0 0 auto}
      .pv-trip-manage-row button.danger{
        appearance:none;flex:0 0 auto;width:36px;height:36px;padding:0;border-radius:10px;
        border:1px solid #f0c4c0;background:#fff5f4;color:#c62828;
        display:inline-flex;align-items:center;justify-content:center;cursor:pointer
      }
      .recent-trips .booking-card.pv-recent-trip-row,
      .recent-trips .pv-recent-trip-row{
        display:flex;align-items:center;gap:8px;padding:10px 12px
      }
      .recent-trips .pv-recent-trip-open{
        display:flex;align-items:center;gap:12px;flex:1;min-width:0;
        color:inherit;text-decoration:none
      }
      .recent-trips .pv-recent-trip-open .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
      .recent-trips .pv-recent-trash,
      .recent-trips .pv-delete-trip,
      .pv-trash-icon-btn{
        appearance:none;flex:0 0 auto;width:36px;height:36px;border-radius:10px;
        border:1px solid #f0c4c0;background:#fff5f4;color:#c62828;
        display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0
      }
      .recent-trips .pv-recent-trash:hover,
      .recent-trips .pv-delete-trip:hover,
      .pv-trash-icon-btn:hover{background:#ffe8e6;color:#b71c1c}
      .recent-trips a.booking-card{display:flex;align-items:center;gap:12px}
      .recent-trips a.booking-card .pv-delete-trip{margin-left:auto;order:5}
      .recent-trips .pv-recent-row{
        display:flex;align-items:center;gap:8px;margin:0 0 10px
      }
      .recent-trips .pv-recent-row > a.booking-card{margin:0;flex:1;min-width:0}
      .recent-trips .pv-recent-row > .pv-delete-trip{flex:0 0 auto}
      /* Home trip cards — mockup-inspired */
      .recent-trips.pv-home-cards{
        display:grid;gap:14px;margin-top:10px
      }
      .recent-trips .pv-home-seg{
        display:flex;flex-wrap:wrap;gap:4px;padding:5px;margin:0 0 12px;border-radius:999px;
        background:rgba(0,125,130,.08);max-width:100%
      }
      .recent-trips .pv-home-seg button{
        appearance:none;border:0;border-radius:999px;padding:9px 13px;min-height:40px;
        font:700 12px/1 inherit;cursor:pointer;background:transparent;color:#5b7380
      }
      .recent-trips .pv-home-seg button.on{
        background:#fff;color:var(--pv-teal-deep);box-shadow:0 2px 8px rgba(0,80,90,.1)
      }
      .recent-trips .pv-trip-card{
        display:flex;gap:12px;align-items:stretch;padding:0;overflow:hidden;
        border:1px solid rgba(18,52,60,.08);border-radius:20px;background:var(--pv-surface);
        box-shadow:var(--pv-shadow);text-decoration:none;color:inherit;
        transition:transform .2s var(--pv-ease-out),box-shadow .22s ease
      }
      .recent-trips .pv-trip-card:active{transform:scale(.985)}
      .recent-trips .pv-trip-card .pv-trip-thumb{
        flex:0 0 96px;min-height:96px;
        background:
          linear-gradient(155deg,rgba(0,125,130,.5),rgba(10,50,55,.4)),
          radial-gradient(circle at 28% 28%,#8fd8db,#007d82 52%,#084a4e);
      }
      .recent-trips .pv-trip-card .pv-trip-body{
        flex:1;min-width:0;padding:14px 14px 14px 0;display:flex;flex-direction:column;justify-content:center;gap:5px
      }
      .recent-trips .pv-trip-card strong{font-size:1.02rem;line-height:1.25;letter-spacing:-.01em}
      .recent-trips .pv-trip-card .pv-trip-meta{font-size:.78rem;color:#5b7380}
      .recent-trips .pv-recent-row[hidden]{display:none!important}
      .recent-trips .pv-trip-sync{font-weight:700}
      .recent-trips .pv-recent-row.pv-card-wrap{margin:0;align-items:stretch}
      .recent-trips .pv-recent-row.pv-card-wrap > .pv-delete-trip{
        align-self:center;margin-right:8px
      }
      .recent-trips .pv-recent-row[hidden],
      .recent-trips .pv-trip-card[hidden]{display:none!important}
      .toolbar-actions .pv-delete-trip-btn,
      .pv-delete-trip-btn{
        appearance:none;border:1px solid #f0c4c0;background:#fff5f4;color:#c62828;
        border-radius:10px;width:36px;height:36px;padding:0;
        display:inline-flex;align-items:center;justify-content:center;cursor:pointer;min-height:36px
      }
      .toolbar-actions .pv-delete-trip-btn:hover{background:#ffe8e6;color:#b71c1c}
      .pv-home-trash-wrap{
        display:inline-flex;align-items:center;gap:8px;margin-left:8px;vertical-align:middle
      }
      .pv-ux-modal{position:fixed;inset:0;z-index:125000;display:grid;place-items:end center;padding:0}
      .pv-ux-modal[hidden]{display:none!important}
      .pv-ux-modal .pv-ux-back{
        position:absolute;inset:0;background:rgba(10,28,34,.42);
        opacity:0;transition:opacity var(--pv-motion) ease;
        backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)
      }
      .pv-ux-modal.pv-open .pv-ux-back{opacity:1}
      .pv-ux-modal .pv-ux-sheet{
        position:relative;z-index:1;width:min(560px,100%);max-height:min(88vh,840px);overflow:auto;
        background:linear-gradient(180deg,#fbfdfd 0%,#f4f8f9 100%);
        border-radius:24px 24px 0 0;padding:18px 16px calc(28px + env(safe-area-inset-bottom,0px));
        box-shadow:0 -20px 56px rgba(12,40,48,.2);color:var(--pv-ink);
        transform:translateY(22px);opacity:0;
        transition:transform var(--pv-motion) var(--pv-ease-out),opacity .24s ease;
        overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
        border-top:1px solid rgba(255,255,255,.7)
      }
      body.pv-primary-nav-ready .pv-ux-modal .pv-ux-sheet{
        padding-bottom:calc(108px + env(safe-area-inset-bottom,0px));
        max-height:min(78vh,840px);
      }
      .pv-ux-modal.pv-open .pv-ux-sheet{transform:translateY(0);opacity:1}
      /* Shared dock enter/leave (app + expense portals) */
      #pv-as-portal,#pv-es-portal{
        transform:translateY(16px);opacity:0;pointer-events:none;
        transition:transform var(--pv-motion) var(--pv-ease),opacity .2s ease,bottom .24s var(--pv-ease);
        will-change:transform,opacity;
      }
      #pv-as-portal.pv-dock-in,#pv-es-portal.pv-dock-in{
        transform:translateY(0);opacity:1;pointer-events:auto;
      }
      #pv-magic-root .pv-magic-btn,.pv-prev-launch{
        transition:bottom .28s var(--pv-ease),transform .16s var(--pv-ease),box-shadow .2s ease!important;
      }
      .pv-ux-modal .pv-ux-sheet h2{margin:0 0 10px;font-size:1.28rem;letter-spacing:-.02em}
      .pv-ux-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
      .pv-ux-list li,.pv-ux-card{
        background:var(--pv-surface);border:1px solid rgba(18,52,60,.08);border-radius:16px;padding:13px;
        box-shadow:0 3px 12px rgba(16,42,48,.03)
      }
      .pv-ux-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .pv-ux-actions button,#pv-ux-search-go{
        appearance:none;border:0;border-radius:999px;padding:11px 15px;font:700 13px inherit;cursor:pointer
      }
      .pv-ux-primary,#pv-ux-search-go{
        background:linear-gradient(180deg,#069199,var(--pv-teal-deep));color:#fff;
        box-shadow:0 6px 16px rgba(0,125,130,.22)
      }
      .pv-ux-ghost{background:#eef5f5;color:var(--pv-ink)}
      .pv-ux-close{
        position:absolute;top:12px;right:12px;border:0;width:36px;height:36px;border-radius:999px;
        background:#eef5f5;font-size:1.2rem;cursor:pointer;color:var(--pv-ink)
      }
      .pv-compare-bar{height:10px;border-radius:999px;background:#e8f0f0;overflow:hidden;margin:8px 0}
      .pv-compare-bar > span{display:block;height:100%;background:linear-gradient(90deg,#007d82,#2aa3a8)}
      .pv-compare-bar.warn > span{background:linear-gradient(90deg,#b45309,#d97706)}
      .pv-onboard-steps{display:grid;gap:10px;margin:12px 0}
      .pv-onboard-steps div{padding:12px;border-radius:14px;background:#fff;border:1px solid var(--pv-line)}
      .pv-onboard-steps strong{display:block;margin-bottom:4px}
      #pv-ux-search-input{
        width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;
        border:1px solid var(--pv-line);font:inherit;margin:8px 0
      }
      .pv-ux-hit{outline:2px solid rgba(0,125,130,.45);outline-offset:2px;border-radius:8px}
      @media (min-width:720px){
        .pv-ux-modal{place-items:center;padding:24px 16px}
        .pv-ux-modal .pv-ux-sheet{
          border-radius:22px;
          width:min(600px,94vw);
          max-height:min(86vh,880px);
          padding-bottom:28px;
        }
        body.pv-primary-nav-ready .pv-ux-modal .pv-ux-sheet{
          padding-bottom:28px;
          max-height:min(86vh,880px);
        }
        .recent-trips.pv-home-cards{
          grid-template-columns:1fr 1fr;gap:16px
        }
      }
      @media (min-width:768px){
        .pv-menu-grid{grid-template-columns:1fr 1fr;gap:10px}
        .pv-menu-grid button.pv-menu-tools,
        .pv-menu-grid button.danger{grid-column:1 / -1}
        #pv-ux-toast{bottom:calc(28px + env(safe-area-inset-bottom,0px))}
        body.pv-primary-nav-ready #pv-ux-toast{bottom:calc(100px + env(safe-area-inset-bottom,0px))}
      }
      @media (min-width:1100px){
        .pv-ux-modal{padding:32px 24px}
        .pv-ux-modal .pv-ux-sheet{
          width:min(680px,92vw);border-radius:24px;padding:22px 22px 30px
        }
        .recent-trips.pv-home-cards{
          grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;max-width:1100px
        }
        .pv-empty-state{padding:22px 20px;max-width:720px;margin-inline:auto}
      }
      @media (min-width:1400px){
        .pv-ux-modal .pv-ux-sheet{width:min(720px,90vw)}
      }
      /* Spese / split: side-by-side on tablet+ */
      @media (min-width:900px){
        .expense-columns{
          display:grid!important;
          grid-template-columns:minmax(0,1.25fr) minmax(280px,.9fr);
          gap:22px;align-items:start
        }
        .expense-columns .split-panel{
          position:sticky;top:calc(64px + env(safe-area-inset-top,0px))
        }
      }
      @media (min-width:1100px){
        .app-shell{
          max-width:1390px;margin-inline:auto
        }
      }
      .pv-ux-modal button:focus-visible,#pv-account-chip #pv-account-menu:focus-visible{
        outline:3px solid rgba(0,125,130,.45);outline-offset:2px
      }
      @media print{
        #pv-account-chip,#pv-primary-nav,#pv-magic-root,#pv-ux-toast,#pv-offline-chip,.pv-prev-launch{display:none!important}
      }
    `;
  }

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

  function toast(msg, kind = "") {
    let el = document.getElementById("pv-ux-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pv-ux-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.className = "show" + (kind ? " " + kind : "");
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 4200);
  }
  window.__pvToast = toast;

  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function logActivity(tripId, text) {
    if (!tripId || !text) return;
    const db = readJson(ACTIVITY_KEY, {});
    const list = Array.isArray(db[tripId]) ? db[tripId] : [];
    list.unshift({ at: new Date().toISOString(), text: String(text).slice(0, 180) });
    db[tripId] = list.slice(0, 40);
    writeJson(ACTIVITY_KEY, db);
  }

  function pushRevision(tripId, revision, trip) {
    if (!tripId || !trip) return;
    const db = readJson(REVISIONS_KEY, {});
    const list = Array.isArray(db[tripId]) ? db[tripId] : [];
    const last = list[0];
    if (last && Number(last.revision) === Number(revision)) return;
    list.unshift({
      at: new Date().toISOString(),
      revision: Number(revision) || 0,
      trip: JSON.parse(JSON.stringify(trip)),
    });
    db[tripId] = list.slice(0, 8);
    writeJson(REVISIONS_KEY, db);
  }

  async function loadTrip() {
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio");
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Viaggio non disponibile");
    return { auth, data };
  }

  async function saveTrip(auth, trip, revision) {
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({ trip, revision }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new Error(
        (typeof window.__pvSaveMsg?.CONFLICT === "string" && window.__pvSaveMsg.CONFLICT) ||
          "Versione non aggiornata. Ricarica e riprova: le modifiche più recenti non sono state sovrascritte."
      );
    }
    if (!res.ok) throw new Error(data.error || "Salvataggio non riuscito");
    pushRevision(auth.id, data.revision, data.trip || trip);
    logActivity(auth.id, "Viaggio salvato");
    const msg =
      typeof window.__pvSaveToast === "function"
        ? window.__pvSaveToast(data)
        : data.local || data.source === "memory"
          ? "Salvato su questo dispositivo. In attesa di sincronizzazione"
          : "Salvato e sincronizzato";
    toast(msg, data.local || data.source === "memory" ? "warn" : "ok");
    return data;
  }

  function readRecentLinks() {
    try {
      const raw = JSON.parse(localStorage.getItem("viavia-recent-links-v1") || "[]");
      return Array.isArray(raw)
        ? raw.filter((e) => e && typeof e.id === "string" && typeof e.key === "string")
        : [];
    } catch {
      return [];
    }
  }

  function writeRecentLinks(list) {
    try {
      localStorage.setItem("viavia-recent-links-v1", JSON.stringify((list || []).slice(0, 20)));
    } catch {
      /* quota */
    }
  }

  async function deleteTripById(id, key, { title = "questo viaggio", leavePage = false } = {}) {
    const tripId = String(id || "").trim();
    const tripKey = String(key || "").trim();
    if (!tripId || !tripKey) throw new Error("Viaggio non valido");
    const ok = confirm(
      `Eliminare definitivamente «${title}»?\n\nVerrà rimosso da questo dispositivo e, se possibile, anche dal cloud. L’azione non si può annullare.`
    );
    if (!ok) return false;

    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tripKey}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Eliminazione non riuscita");

    if (typeof window.__pvPurgeLocalTrip === "function") {
      window.__pvPurgeLocalTrip(tripId);
    } else {
      writeRecentLinks(readRecentLinks().filter((e) => e.id !== tripId));
      try {
        const db = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
        if (db && db[tripId]) {
          delete db[tripId];
          localStorage.setItem("viavia-local-trips-v1", JSON.stringify(db));
        }
      } catch {
        /* ignore */
      }
    }

    // Drop local revision/activity leftovers for this trip.
    try {
      const revs = readJson(REVISIONS_KEY, {});
      if (revs[tripId]) {
        delete revs[tripId];
        writeJson(REVISIONS_KEY, revs);
      }
      const acts = readJson(ACTIVITY_KEY, {});
      if (acts[tripId]) {
        delete acts[tripId];
        writeJson(ACTIVITY_KEY, acts);
      }
    } catch {
      /* ignore */
    }

    toast("Viaggio eliminato", "ok");
    if (leavePage) {
      location.hash = "";
      setTimeout(() => location.reload(), 250);
    }
    return true;
  }

  window.__pvDeleteTrip = deleteTripById;

  window.__pvDeleteTripFromRecent = async function deleteTripFromRecent(entry) {
    const id = entry?.id;
    const key = entry?.key;
    const title = entry?.title || "viaggio";
    if (!id || !key) {
      toast("Viaggio non valido", "err");
      return;
    }
    try {
      const current = tripAuth();
      const done = await deleteTripById(id, key, {
        title,
        leavePage: Boolean(current && current.id === id),
      });
      if (done && !(current && current.id === id)) {
        // Remove the row immediately from the open sheet.
        const host = document.querySelector(".recent-trips");
        host?.querySelectorAll(".pv-recent-trip-row, .pv-recent-row, a.booking-card").forEach((el) => {
          const href = el.getAttribute?.("href") || el.querySelector?.("a")?.getAttribute("href") || "";
          if (href.includes(`trip=${encodeURIComponent(id)}`) || href.includes(`trip=${id}`)) {
            const wrap = el.classList?.contains("pv-recent-row") ? el : el.closest?.(".pv-recent-row");
            (wrap || el).remove();
          }
        });
        if (host && !host.querySelector(".pv-recent-trip-row, .pv-recent-row, a.booking-card") && !host.querySelector(".pv-empty-recent")) {
          const p = document.createElement("p");
          p.className = "small-note pv-empty-recent";
          p.textContent = "Non hai ancora aperto un viaggio salvato.";
          host.appendChild(p);
        }
      }
    } catch (err) {
      toast(err.message || "Eliminazione non riuscita", "err");
    }
  };

  function trashIconSvg(size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  async function deleteCurrentTrip() {
    const auth = tripAuth();
    if (!auth) {
      toast("Apri un viaggio per eliminarlo", "warn");
      return;
    }
    let title = "questo viaggio";
    try {
      const { data } = await loadTrip();
      title = data?.trip?.title || title;
    } catch {
      /* use default title */
    }
    try {
      await deleteTripById(auth.id, auth.key, { title, leavePage: true });
    } catch (err) {
      toast(err.message || "Eliminazione non riuscita", "err");
    }
  }

  function openManageTrips() {
    const links = readRecentLinks();
    const body =
      links.length === 0
        ? `<div class="pv-empty-state" style="margin:4px 0 8px">
             <h3>Nessun viaggio ancora</h3>
             <p>Crea il primo dalla home con «Nuovo viaggio», oppure apri un link condiviso.</p>
           </div>
           <div class="pv-ux-actions"><button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button></div>`
        : `<p style="margin:0 0 10px;color:#5b7380;font-size:.9rem">Apri un viaggio o rimuovilo da questo dispositivo (e dal cloud se disponibile).</p>
           <div class="pv-trip-manage-list">
             ${links
               .map((t, i) => {
                 const dest = t.destination || t.meta?.destination || "";
                 const when = [t.start || t.meta?.start, t.end || t.meta?.end].filter(Boolean).join(" → ");
                 const meta = [dest, when].filter(Boolean).join(" · ") || "Salvato su questo dispositivo";
                 return `<div class="pv-trip-manage-row" data-idx="${i}">
                   <div class="grow">
                     <strong>${escapeHtml(t.title || "Viaggio")}</strong>
                     <span class="pv-trip-meta">${escapeHtml(meta)}</span>
                   </div>
                   <a class="pv-ux-ghost" href="#${new URLSearchParams({ trip: t.id, key: t.key })}">Apri</a>
                   <button type="button" class="danger pv-trash-icon-btn" data-del="${i}" aria-label="Rimuovi ${escapeHtml(t.title || "viaggio")}" title="Rimuovi viaggio">${trashIconSvg(15)}</button>
                 </div>`;
               })
               .join("")}
           </div>
           <div class="pv-ux-actions"><button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button></div>`;

    openModal("I tuoi viaggi", body, {
      onMount: (root) => {
        root.querySelectorAll("button[data-del]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const idx = Number(btn.getAttribute("data-del"));
            const trip = readRecentLinks()[idx];
            if (!trip) return;
            btn.disabled = true;
            try {
              const current = tripAuth();
              const leave = Boolean(current && current.id === trip.id);
              const done = await deleteTripById(trip.id, trip.key, {
                title: trip.title || "viaggio",
                leavePage: leave,
              });
              if (done && !leave) openManageTrips();
            } catch (err) {
              btn.disabled = false;
              toast(err.message || "Eliminazione non riuscita", "err");
            }
          });
        });
      },
    });
  }

  function enhanceHomeTripCards() {
    const host = document.querySelector(".recent-trips");
    if (!host || tripAuth()) return;
    host.classList.add("pv-home-cards");

    if (!host.querySelector(".pv-home-seg")) {
      const seg = document.createElement("div");
      seg.className = "pv-home-seg";
      seg.setAttribute("aria-label", "Filtra viaggi");
      seg.innerHTML = `
        <button type="button" data-seg="all" aria-pressed="true" class="on">Tutti</button>
        <button type="button" data-seg="active" aria-pressed="false">In corso</button>
        <button type="button" data-seg="upcoming" aria-pressed="false">Futuri</button>
        <button type="button" data-seg="past" aria-pressed="false">Conclusi</button>`;
      host.prepend(seg);
      seg.addEventListener("click", event => {
        const selected = event.target.closest("button[data-seg]");
        if (!selected) return;
        seg.querySelectorAll("button").forEach(button => {
          button.classList.toggle("on", button === selected);
          button.setAttribute("aria-pressed", String(button === selected));
        });
        enhanceHomeTripCards();
      });
    }

    const links = [...host.querySelectorAll("a.booking-card, a.pv-recent-trip-open")];
    for (const card of links) {
      if (card.dataset.pvCarded === "1") continue;
      card.dataset.pvCarded = "1";
      card.classList.add("pv-trip-card");
      const title = (card.querySelector("strong")?.textContent || card.textContent || "Viaggio").trim();
      const metaText = (card.innerText || "").replace(title, "").replace(/\s+/g, " ").trim();
      if (!card.querySelector(".pv-trip-thumb")) {
        const thumb = document.createElement("div");
        thumb.className = "pv-trip-thumb";
        thumb.setAttribute("aria-hidden", "true");
        const body = document.createElement("div");
        body.className = "pv-trip-body";
        const strong = document.createElement("strong");
        strong.textContent = title || "Viaggio";
        const meta = document.createElement("span");
        meta.className = "pv-trip-meta";
        meta.textContent = metaText || "Apri per continuare";
        body.appendChild(strong);
        body.appendChild(meta);
        // Clear original dense content but keep href
        card.textContent = "";
        card.appendChild(thumb);
        card.appendChild(body);
      }
      let row = card.closest(".pv-recent-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "pv-recent-row pv-card-wrap";
        card.parentNode?.insertBefore(row, card);
        row.appendChild(card);
      } else {
        row.classList.add("pv-card-wrap");
      }
    }
    const mode = host.querySelector(".pv-home-seg .on")?.dataset.seg || "all";
    const today = new Date().toLocaleDateString("sv-SE");
    for (const card of links) {
      const id = new URLSearchParams(new URL(card.href, location.href).hash.slice(1)).get("trip");
      if (!id) continue;
      const meta = readJson(`viavia-trip-card-meta:${id}`, null);
      const when = meta?.start > today ? "upcoming" : meta?.end && meta.end < today ? "past" : meta?.start && meta?.end ? "active" : "";
      const row = card.closest(".pv-recent-row") || card;
      row.hidden = mode !== "all" && mode !== when;
      const local = window.__pvIsTripLocalOnly?.(id) || meta?.local;
      const offlinePending = (readJson("viavia-platform-outbox-v1", []) || []).some(item => item.tripId === id);
      const label = offlinePending ? "In attesa di sincronizzazione" : local ? "Solo sul dispositivo" : meta ? "Sincronizzato" : "Da verificare";
      let badge = card.querySelector(".pv-trip-sync");
      if (!badge && card.querySelector(".pv-trip-body")) {
        badge = document.createElement("span");
        badge.className = "pv-trip-meta pv-trip-sync";
        card.querySelector(".pv-trip-body").append(badge);
      }
      if (badge && badge.textContent !== label) badge.textContent = label;
    }
  }

  function polishLocalOnlyBanner() {
    const banner = document.getElementById("pv-local-only-banner");
    if (!banner) return;
    banner.classList.add("pv-banner-compact");
    // Drop magic-extras inline slab styles so account.css chip rules win.
    if (banner.dataset.pvStyleCleared !== "1") {
      banner.style.padding = "";
      banner.style.background = "";
      banner.style.borderBottom = "";
      banner.style.margin = "";
      banner.style.font = "";
      banner.style.gap = "";
      banner.style.alignItems = "";
      banner.style.justifyContent = "";
      banner.style.textAlign = "";
      banner.dataset.pvStyleCleared = "1";
    }
    if (banner.dataset.pvTextPolished === "1") return;
    const span = banner.querySelector("span");
    if (!span) return; // wait until magic-extras fills content
    if (/solo su questo dispositivo/i.test(span.textContent || "")) {
      span.innerHTML =
        "Salvato solo qui. <strong>Condividi viaggio</strong> per il gruppo.";
    }
    banner.dataset.pvTextPolished = "1";
    banner.dataset.pvCompact = "1";
  }

  function enhanceRecentTripsDelete() {
    const host = document.querySelector(".recent-trips");
    if (!host) return;

    enhanceHomeTripCards();
    polishLocalOnlyBanner();

    // Native React rows already include .pv-recent-trash — nothing else needed.
    if (host.querySelector(".pv-recent-trash")) return;

    // Inject a trash icon beside each trip card (sibling, not inside the <a>).
    const cards = [...host.querySelectorAll("a.booking-card, a.pv-trip-card")].filter(
      (a) => !a.classList.contains("pv-recent-trip-open") || a.classList.contains("pv-trip-card")
    );
    for (const card of cards) {
      if (card.closest(".pv-recent-row")?.querySelector(".pv-delete-trip, .pv-recent-trash")) continue;
      if (card.querySelector(".pv-delete-trip")) {
        card.querySelector(".pv-delete-trip")?.remove();
      }
      let id = "";
      let key = "";
      try {
        const href = card.getAttribute("href") || "";
        const q = new URLSearchParams(String(href).replace(/^#/, ""));
        id = q.get("trip") || "";
        key = q.get("key") || "";
      } catch {
        continue;
      }
      if (!id || !key) continue;
      const title = (card.querySelector("strong")?.textContent || "viaggio").trim();

      let row = card.closest(".pv-recent-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "pv-recent-row pv-card-wrap";
        card.parentNode?.insertBefore(row, card);
        row.appendChild(card);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-delete-trip";
      btn.innerHTML = trashIconSvg(15);
      btn.setAttribute("aria-label", `Rimuovi ${title}`);
      btn.title = "Rimuovi viaggio";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        btn.disabled = true;
        try {
          await window.__pvDeleteTripFromRecent({ id, key, title });
        } catch (err) {
          btn.disabled = false;
          toast(err.message || "Eliminazione non riuscita", "err");
        }
      });
      row.appendChild(btn);
    }
  }

  function injectTripDeleteButton() {
    // Toolbar no longer shows a text "Elimina" control — use Menu (bottom) or the trash icon.
    document.getElementById("pv-delete-trip-toolbar")?.remove();
  }

  function injectHomeDeleteEntry() {
    document.getElementById("pv-home-delete-bar")?.remove();
    // Home CTA "I tuoi viaggi" (exact label) — show a small red trash beside it, no "Elimina" text.
    const anchor =
      [...document.querySelectorAll("button")].find((b) =>
        /^i tuoi viaggi$/i.test((b.textContent || "").trim())
      ) || null;
    if (!anchor) {
      document.getElementById("pv-home-trash-btn")?.closest?.(".pv-home-trash-wrap")?.remove();
      document.getElementById("pv-home-trash-btn")?.remove();
      return;
    }
    if (document.getElementById("pv-home-trash-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "pv-home-trash-btn";
    btn.className = "pv-trash-icon-btn";
    btn.innerHTML = trashIconSvg(15);
    btn.setAttribute("aria-label", "Rimuovi un viaggio salvato");
    btn.title = "Rimuovi un viaggio";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openManageTrips();
    });

    const wrap = document.createElement("span");
    wrap.className = "pv-home-trash-wrap";
    wrap.appendChild(btn);
    anchor.insertAdjacentElement("afterend", wrap);
  }

  function openModal(title, bodyHtml, { onMount } = {}) {
    let modal = document.getElementById("pv-ux-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pv-ux-modal";
      modal.className = "pv-ux-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="pv-ux-back" data-ux-close></div>
        <div class="pv-ux-sheet" role="dialog" aria-modal="true" aria-labelledby="pv-ux-title">
          <button type="button" class="pv-ux-close" data-ux-close aria-label="Chiudi">×</button>
          <h2 id="pv-ux-title"></h2>
          <div id="pv-ux-body"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("[data-ux-close]")) closeModal();
      });
      document.addEventListener("keydown", (ev) => {
        if (modal.hidden) return;
        if (ev.key === "Escape") closeModal();
        if (ev.key !== "Tab") return;
        const controls = [...modal.querySelectorAll("button, a[href], input, select, textarea")]
          .filter(element => !element.disabled && element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (!first) return;
        if (ev.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          ev.preventDefault(); last.focus();
        } else if (!ev.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          ev.preventDefault(); first.focus();
        }
      });
    }
    clearTimeout(modal._closeT);
    if (!modal.contains(document.activeElement)) modal._opener = document.activeElement;
    modal.querySelector("#pv-ux-title").textContent = title;
    modal.querySelector("#pv-ux-body").innerHTML = bodyHtml;
    modal.hidden = false;
    modal.classList.remove("pv-open");
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => modal.classList.add("pv-open"));
    });
    const sheet = modal.querySelector(".pv-ux-sheet");
    sheet.querySelector("button, [href], input, select, textarea")?.focus?.();
    onMount?.(modal.querySelector("#pv-ux-body"), modal);
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById("pv-ux-modal");
    if (!modal || modal.hidden) {
      document.documentElement.style.overflow = "";
      document.getElementById("pv-account-menu")?.setAttribute("aria-expanded", "false");
      return;
    }
    modal.classList.remove("pv-open");
    document.documentElement.style.overflow = "";
    document.getElementById("pv-account-menu")?.setAttribute("aria-expanded", "false");
    clearTimeout(modal._closeT);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    modal._closeT = setTimeout(
      () => {
        modal.hidden = true;
        if (modal._opener?.isConnected) modal._opener.focus();
      },
      reduce ? 0 : 220
    );
  }

  function cleanupLegacyChrome() {
    document.getElementById("pv-ux-toolbar")?.remove();
    document.getElementById("pv-ux-tools-fab")?.remove();
    document.getElementById("pv-link-role-chip")?.remove();
    document.body.classList.remove("pv-ux-toolbar-on");
    cleanupChipExtras();
  }

  function cleanupChipExtras() {
    document.getElementById("pv-ux-tools-btn")?.remove();
    document.getElementById("pv-ux-companions-btn")?.remove();
    // Legacy buttons if an older account.js chip is still in memory somehow.
    document.getElementById("pv-account-logout")?.remove();
    document.getElementById("pv-account-delete")?.remove();
  }

  function activeSectionMeta() {
    // Prefer SPA trip tabs inside #root (ignore Hub/account chrome).
    const raw = (
      document.querySelector(
        '#root [role=tab][data-state=active], #root [role=tab][aria-selected="true"], [role=tab][data-state=active], [role=tab][aria-selected="true"]'
      )?.textContent || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const label = raw || "Itinerario";
    const key = label.toLowerCase();
    const catalog = [
      {
        match: /itinerario/,
        title: "Strumenti di Itinerario",
        hint: "Pausa pranzo, check-in tappe, stima tempi — cambiano se passi a un’altra tab",
        toast: "Strumenti di Itinerario aperti in basso",
      },
      {
        match: /esplora|luoghi|posti/,
        title: "Strumenti di Esplora / Luoghi",
        hint: "Preferiti e scorciatoie per i posti — diversi da Itinerario o Spese",
        toast: "Strumenti luoghi aperti in basso",
      },
      {
        match: /prenotaz/,
        title: "Strumenti di Prenotazioni",
        hint: "Stato hotel/voli e note prenotazione per questa tab",
        toast: "Strumenti prenotazioni aperti in basso",
      },
      {
        match: /document/,
        title: "Strumenti di Documenti",
        hint: "Elenco documenti e meta rapide di questa sezione",
        toast: "Strumenti documenti aperti in basso",
      },
      {
        match: /valigia|checklist/,
        title: "Strumenti di Valigia",
        hint: "Assegnazioni e scorciatoie packing di questa tab",
        toast: "Strumenti valigia aperti in basso",
      },
      {
        match: /^note$/,
        title: "Strumenti di Note",
        hint: "Scorciatoie e cronologia note per la tab Note",
        toast: "Strumenti note aperti in basso",
      },
      {
        match: /spese/,
        title: "Strumenti di Spese",
        hint: "Export CSV, valute compagni, notifiche — solo in Spese di gruppo",
        toast: "Strumenti spese aperti in basso",
      },
      {
        match: /preventivo/,
        title: "Strumenti di Preventivo",
        hint: "Azioni extra del preventivo in questa tab",
        toast: "Strumenti preventivo aperti in basso",
      },
    ];
    const hit = catalog.find((c) => c.match.test(key));
    return {
      label,
      title: hit?.title || `Strumenti di ${label}`,
      hint:
        hit?.hint ||
        `Azioni extra per la tab «${label}». Cambia tab e riapri qui per strumenti diversi.`,
      toast: hit?.toast || `Strumenti di ${label} aperti in basso`,
    };
  }

  function openAccountMenu() {
    const inTrip = Boolean(tripAuth());
    const menuBtn = document.getElementById("pv-account-menu");
    menuBtn?.setAttribute("aria-expanded", "true");
    if (typeof window.__pvSetPrimaryNav === "function") window.__pvSetPrimaryNav("profile");
    const section = inTrip ? activeSectionMeta() : null;
    openModal(
      inTrip && section ? `Profilo · ${section.label}` : "Profilo e strumenti",
      `${
        inTrip
          ? `<div class="pv-menu-section">
              <div class="pv-menu-context">
                <strong>Sei in</strong>
                <em>${escapeHtml(section.label)}</em>
                <p>Le azioni rapide qui sotto valgono per questa sezione. Le tab in alto (Itinerario, Spese…) restano la navigazione principale del viaggio.</p>
              </div>
              <h3>Azioni rapide</h3>
              <div class="pv-menu-grid">
                <button type="button" class="pv-menu-tools" data-ux="section-tools">
                  <strong>${escapeHtml(section.title)}</strong>
                  <span>${escapeHtml(section.hint)}</span>
                </button>
                <button type="button" data-ux="search"><strong>Cerca nel viaggio</strong><span>Trova tappe, spese e note</span></button>
              </div>
            </div>
            <div class="pv-menu-section">
              <h3>Organizza</h3>
              <div class="pv-menu-grid">
                <button type="button" data-ux="companions"><strong>Compagni di viaggio</strong><span>Chi partecipa e gestione ospiti</span></button>
                <button type="button" data-ux="invite"><strong>Invita con codice</strong><span>Condividi un codice a 6 caratteri</span></button>
                <button type="button" data-ux="checklist"><strong>Checklist partenza</strong><span>Cose da fare prima di partire</span></button>
              </div>
            </div>
            <div class="pv-menu-section">
              <h3>Soldi</h3>
              <div class="pv-menu-grid">
                <button type="button" data-ux="compare"><strong>Preventivo e spese</strong><span>Confronta stima e spese reali</span></button>
              </div>
            </div>
            <div class="pv-menu-section">
              <h3>Altro</h3>
              <div class="pv-menu-grid">
                <button type="button" data-ux="more"><strong>Altri strumenti</strong><span>Attività, template, versioni, export</span></button>
                <button type="button" data-ux="hub"><strong>Funzioni di gruppo (HUB)</strong><span>Anche dalla barra in basso · voti, preparazione, backup</span></button>
              </div>
            </div>`
          : `<div class="pv-menu-section">
              <h3>I tuoi viaggi</h3>
              <div class="pv-menu-grid">
                <button type="button" data-ux="manage-trips"><strong>Elenco viaggi</strong><span>Apri o gestisci i viaggi salvati</span></button>
                <button type="button" data-ux="home-hint"><strong>Torna alla home</strong><span>Crea un viaggio con «Nuovo viaggio»</span></button>
              </div>
            </div>
            <div class="pv-menu-section">
              <h3>Altro</h3>
              <div class="pv-menu-grid">
                <button type="button" data-ux="hub"><strong>Funzioni di gruppo (HUB)</strong><span>Anche dalla barra in basso</span></button>
              </div>
            </div>`
      }
       <div class="pv-menu-section">
         <h3>Il tuo account</h3>
         <div class="pv-menu-grid">
           <button type="button" data-ux="logout"><strong>Esci</strong><span>Torna alla schermata di accesso</span></button>
         </div>
       </div>
       <div class="pv-menu-section">
         <h3>Zona pericolosa</h3>
         <div class="pv-menu-grid">
           ${
             inTrip
               ? `<button type="button" class="danger" data-ux="delete-trip"><strong>Elimina viaggio</strong><span>Cancellalo da questo dispositivo e dal cloud</span></button>`
               : `<button type="button" class="danger" data-ux="manage-trips"><strong>Elimina un viaggio</strong><span>Scegli un viaggio salvato da rimuovere</span></button>`
           }
           <button type="button" class="danger" data-ux="delete-account"><strong>Elimina account</strong><span>Cancella il login su questo dispositivo/cloud</span></button>
         </div>
       </div>`,
      {
        onMount: (body) => {
          body.querySelectorAll("button[data-ux]").forEach((b) => {
            b.addEventListener("click", () => {
              const act = b.getAttribute("data-ux");
              const sectionNow = activeSectionMeta();
              closeModal();
              menuBtn?.setAttribute("aria-expanded", "false");
              if (act === "companions") void openCompanionsManager();
              else if (act === "hub") {
                if (typeof window.ProntiPlatform?.open === "function") window.ProntiPlatform.open();
                else if (document.getElementById("pv-hub-nav")) document.getElementById("pv-hub-nav").click();
                else document.getElementById("pv-plat-fab")?.click();
              } else if (act === "section-tools") {
                let opened = false;
                if (typeof window.__pvAppSuite?.reopenDock === "function") {
                  opened = Boolean(window.__pvAppSuite.reopenDock());
                } else if (typeof window.__pvExpenseSuite?.reopenDock === "function") {
                  opened = Boolean(window.__pvExpenseSuite.reopenDock());
                }
                if (opened) toast(`${sectionNow.toast} — chiudi con ×`, "ok");
                else toast(`Nessuno strumento per «${sectionNow.label}» in questa vista`, "warn");
              } else if (act === "search") openSearchSheet();
              else if (act === "more") openMoreTools();
              else if (act === "manage-trips") openManageTrips();
              else if (act === "delete-trip") void deleteCurrentTrip();
              else if (act === "home-hint") {
                if (typeof window.__pvNavHome === "function") window.__pvNavHome();
                else toast("Usa «Nuovo viaggio» in homepage", "ok");
              }
              else if (act === "logout") {
                if (typeof window.__pvAccountLogout === "function") window.__pvAccountLogout();
              } else if (act === "delete-account") {
                if (typeof window.__pvAccountDelete === "function") window.__pvAccountDelete();
              } else runUxAction(act);
            });
          });
        },
      }
    );
  }
  window.__pvOpenAccountMenu = openAccountMenu;

  function navGoHome() {
    if (typeof window.__pvSetPrimaryNav === "function") window.__pvSetPrimaryNav("home");
    document.querySelector("#pv-plat-panel [data-plat=close]")?.click();
    document.querySelectorAll(".pv-ux-modal .pv-ux-close, .pv-ux-modal [data-ux-close]").forEach((el) => el.click());
    // Home = landing: esci dal viaggio e mostra crea/apri
    if (tripAuth()) {
      location.hash = "";
      toast("Home — crea un viaggio o aprine uno recente", "ok");
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    const createBtn = [...document.querySelectorAll("button, a")].find((el) =>
      /nuovo viaggio/i.test((el.textContent || "").trim())
    );
    createBtn?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }

  function navGoTrips() {
    if (typeof window.__pvSetPrimaryNav === "function") window.__pvSetPrimaryNav("trips");
    document.querySelector("#pv-plat-panel [data-plat=close]")?.click();
    if (tripAuth()) {
      // In viaggio: workspace (itinerario)
      const tab = [...document.querySelectorAll("button, [role=tab], a")].find((el) =>
        /^Itinerario$/i.test((el.textContent || "").trim())
      );
      tab?.click();
      const stop = [...document.querySelectorAll("h2, h3, button")].find((el) =>
        /Il nostro itinerario|Aggiungi tappa/i.test(el.textContent || "")
      );
      stop?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      return;
    }
    // Fuori viaggio: elenco / apri
    openManageTrips();
  }

  function navGoAi() {
    if (typeof window.__pvSetPrimaryNav === "function") window.__pvSetPrimaryNav("ai");
    document.querySelector("#pv-plat-panel [data-plat=close]")?.click();
    const aiBtn = document.getElementById("pv-nav-ai");
    aiBtn?.setAttribute("aria-expanded", "true");
    // Bacchetta può essere display:none con primary nav — click() resta valido
    const magic = document.getElementById("pv-magic-open");
    if (magic) {
      magic.style.display = "inline-flex";
      magic.click();
      return;
    }
    toast(tripAuth() ? "Assistente in caricamento…" : "Apri un viaggio per usare l’assistente IA", "warn");
  }

  window.__pvNavHome = navGoHome;
  window.__pvNavTrips = navGoTrips;
  window.__pvNavAi = navGoAi;

  function openSearchSheet() {
    openModal(
      "Cerca nel viaggio",
      `<label for="pv-ux-search-input" style="font:700 12px inherit">Parola da cercare</label>
       <input id="pv-ux-search-input" type="search" placeholder="Es. hotel, volo, museo…" />
       <div class="pv-ux-actions">
         <button type="button" id="pv-ux-search-go">Cerca</button>
         <button type="button" class="pv-ux-ghost" id="pv-ux-search-clear">Azzera</button>
         <button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button>
       </div>`,
      {
        onMount: (body) => {
          body.querySelector("#pv-ux-search-go")?.addEventListener("click", () => {
            const q = body.querySelector("#pv-ux-search-input")?.value || "";
            const n = highlightSearch(q);
            if (n) closeModal();
            toast(n ? `${n} risultati evidenziati` : "Nessun risultato in questa schermata. Prova un’altra parola.", n ? "ok" : "warn");
          });
          body.querySelector("#pv-ux-search-clear")?.addEventListener("click", () => {
            highlightSearch("");
            toast("Ricerca azzerata", "ok");
          });
          body.querySelector("#pv-ux-search-input")?.focus();
        },
      }
    );
  }

  function openMoreTools() {
    openModal(
      "Altri strumenti",
      `<div class="pv-menu-grid">
         <button type="button" data-ux="activity"><strong>Attività recente</strong><span>Cose fatte su questo dispositivo</span></button>
         <button type="button" data-ux="templates"><strong>Template viaggio</strong><span>Parti da uno schema pronto</span></button>
         <button type="button" data-ux="revisions"><strong>Versioni locali</strong><span>Ripristina una copia salvata qui</span></button>
         <button type="button" data-ux="export"><strong>Export testo</strong><span>Scarica un riepilogo .txt</span></button>
       </div>`,
      {
        onMount: (body) => {
          body.querySelectorAll("button[data-ux]").forEach((b) => {
            b.addEventListener("click", () => {
              closeModal();
              runUxAction(b.getAttribute("data-ux"));
            });
          });
        },
      }
    );
  }

  async function openCompanionsManager() {
    try {
      const { data } = await loadTrip();
      const trip = data.trip || {};
      const members = Array.isArray(trip.members) ? trip.members : [];
      const me = (() => {
        try {
          const a = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
          return {
            displayName: String(a?.user?.displayName || "").trim(),
            username: String(a?.user?.username || "").trim(),
            guest: Boolean(a?.guest),
          };
        } catch {
          return { displayName: "", username: "", guest: true };
        }
      })();
      const creator = members[0];
      const isCreator =
        !me.guest &&
        creator &&
        [me.displayName, me.username].some(
          (n) => n && String(creator.name || "").trim().toLowerCase() === n.toLowerCase()
        );
      const canEdit = data.canEdit !== false;
      openModal(
        "Gestione compagni",
        `<p style="margin:0 0 10px;color:#3d5a62;font-size:.9rem">
          Qui gestisci chi è <strong>nel viaggio</strong> (incluso Ospite dal link).<br>
          Il tuo login personale si gestisce in alto con <strong>Esci</strong> / <strong>Elimina account</strong>.
         </p>
         <ul class="pv-ux-list">${
           members
             .map((m, i) => {
               const name = escapeHtml(m.name || "—");
               const role =
                 i === 0 ? "Creatore" : /^ospite/i.test(m.name || "") ? "Dal link" : "Partecipante";
               const canDelete = isCreator && canEdit && i > 0;
               return `<li style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
                 <div><strong>${name}</strong> · ${role}</div>
                 ${
                   canDelete
                     ? `<button type="button" class="pv-ux-danger" data-rm-name="${escapeHtml(m.name || "")}">Elimina</button>`
                     : i === 0
                       ? `<span style="color:#5b7380;font-size:.8rem">non eliminabile</span>`
                       : ""
                 }
               </li>`;
             })
             .join("") || "<li>Nessun partecipante.</li>"
         }</ul>
         ${
           !isCreator
             ? `<p style="color:#7a4b00;font-size:.88rem">Solo il creatore del viaggio può eliminare gli ospiti.</p>`
             : !canEdit
               ? `<p style="color:#7a4b00;font-size:.88rem">Serve il link di modifica (non solo lettura).</p>`
               : `<p style="color:#5b7380;font-size:.82rem">Puoi anche aprire «N viaggiatori» nella copertina del viaggio.</p>`
         }
         <div class="pv-ux-actions">
           <button type="button" class="pv-ux-ghost" id="pv-ux-open-native-members">Apri elenco nel viaggio</button>
           <button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button>
         </div>`,
        {
          onMount: (body) => {
            body.querySelector("#pv-ux-open-native-members")?.addEventListener("click", () => {
              closeModal();
              const opened =
                typeof window.__pvOpenCompanionsSheet === "function" && window.__pvOpenCompanionsSheet();
              if (!opened) toast("Tocca il pulsante «N viaggiatori» sulla copertina", "warn");
              else toast("Usa Elimina accanto all’ospite", "ok");
            });
            body.querySelectorAll("[data-rm-name]").forEach((btn) => {
              btn.addEventListener("click", () => {
                const name = btn.getAttribute("data-rm-name") || "";
                closeModal();
                if (typeof window.__pvRemoveSharedMemberByName === "function") {
                  void window.__pvRemoveSharedMemberByName(name);
                } else {
                  toast("Funzione rimozione non disponibile", "err");
                }
              });
            });
          },
        }
      );
    } catch (err) {
      toast(err.message || "Compagni non disponibili", "err");
    }
  }

  function highlightSearch(q) {
    document.querySelectorAll(".pv-ux-hit").forEach((el) => el.classList.remove("pv-ux-hit"));
    const query = String(q || "").trim().toLowerCase();
    if (!query) return 0;
    const root = document.getElementById("root") || document.body;
    const candidates = root.querySelectorAll(
      "[class*='stop'], [class*='expense'], [class*='booking'], [class*='checklist'], [class*='day'], .members-list > div"
    );
    let hits = 0;
    for (const el of candidates) {
      if ((el.textContent || "").toLowerCase().includes(query)) {
        el.classList.add("pv-ux-hit");
        hits += 1;
        if (hits === 1) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    return hits;
  }

  function runUxAction(act) {
    if (act === "activity") void showActivity();
    if (act === "checklist") void showChecklist();
    if (act === "compare") void showCompare();
    if (act === "templates") showTemplates();
    if (act === "invite") void showInvite();
    if (act === "revisions") void showRevisions();
    if (act === "export") void exportTripText();
  }

  function injectEmptyStates() {
    // Avoid injecting boxes into the itinerary heading flow — it broke the home layout.
    document.querySelectorAll(".pv-empty-state").forEach((el) => el.remove());
  }

  function ensureItineraryLayoutPolish() {
    let style = document.getElementById("pv-ux-itinerary-layout");
    if (!style) {
      style = document.createElement("style");
      style.id = "pv-ux-itinerary-layout";
      document.head.appendChild(style);
    }
    style.textContent = `
      .section-heading{align-items:flex-start}
      .section-heading h2{line-height:1.2}
      .day-strip{max-width:100%}
      /* Keep account chip from covering the trip topbar brand on small screens */
      @media (max-width:720px){
        .topbar .brand{font-size:22px!important}
        .topbar .top-label{display:none}
      }
    `;
  }

  function injectMemberRoles() {
    const list = document.querySelector(".members-list");
    if (!list) return;
    [...list.querySelectorAll(":scope > div")].forEach((row, idx) => {
      if (row.querySelector(".pv-role-badge")) return;
      const name = (row.querySelector("strong")?.textContent || "").trim();
      const badge = document.createElement("span");
      badge.className = "pv-role-badge" + (/^ospite/i.test(name) ? " guest" : "");
      badge.textContent = idx === 0 ? "Creatore" : /^ospite/i.test(name) ? "Dal link" : "Partecipante";
      row.querySelector("strong")?.after(badge);
    });
  }

  function injectOfflineChip() {
    let chip = document.getElementById("pv-offline-chip");
    const inTrip = Boolean(tripAuth());
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "pv-offline-chip";
      chip.textContent = "Offline";
      document.body.appendChild(chip);
      window.addEventListener("offline", () => {
        if (!tripAuth()) return;
        chip.classList.add("show");
        toast("Sei offline: i salvataggi restano su questo dispositivo", "warn");
      });
      window.addEventListener("online", () => {
        chip.classList.remove("show");
        if (tripAuth()) toast("Di nuovo online", "ok");
      });
    }
    chip.classList.toggle("show", inTrip && !navigator.onLine);
  }

  async function showActivity() {
    const auth = tripAuth();
    const list = (readJson(ACTIVITY_KEY, {})[auth?.id] || []).slice(0, 20);
    openModal(
      "Attività recente",
      list.length
        ? `<ul class="pv-ux-list">${list
            .map(
              (a) =>
                `<li><strong>${escapeHtml(formatWhen(a.at))}</strong><div>${escapeHtml(a.text)}</div></li>`
            )
            .join("")}</ul>`
        : `<p>Nessuna attività registrata su questo dispositivo.</p>`
    );
  }

  function daysUntil(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  }

  async function showChecklist() {
    try {
      const { data } = await loadTrip();
      const trip = data.trip || {};
      const days = daysUntil(trip.start);
      const dest = trip.destination || "destinazione";
      const packing = Array.isArray(trip.checklist) ? trip.checklist : [];
      const suggested = [
        { title: `Controlla meteo a ${dest}`, done: false },
        { title: "eSIM / roaming attivo", done: false },
        { title: "Documenti e assicurazione", done: false },
        { title: "Conferma alloggi e trasferimenti", done: false },
        { title: "Condividi link aggiornato al gruppo", done: false },
      ];
      const existing = new Set(packing.map((c) => String(c.title || "").toLowerCase()));
      const missing = suggested.filter((s) => !existing.has(s.title.toLowerCase()));
      openModal(
        "Checklist pre-partenza",
        `<p>${
          days == null
            ? "Date da definire."
            : days >= 0
              ? `Partenza tra <strong>${days}</strong> giorni.`
              : `Partiti da ${Math.abs(days)} giorni.`
        }</p>
         <ul class="pv-ux-list">${
           packing
             .slice(0, 12)
             .map((c) => `<li>${c.done ? "✓" : "○"} ${escapeHtml(c.title || "")}</li>`)
             .join("") || "<li>Nessuna voce in checklist.</li>"
         }</ul>
         <div class="pv-ux-actions">
           <button type="button" class="pv-ux-primary" id="pv-ux-add-checklist">Aggiungi suggerimenti</button>
           <button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button>
         </div>`,
        {
          onMount: (body) => {
            body.querySelector("#pv-ux-add-checklist")?.addEventListener("click", () =>
              void addChecklistItems(missing)
            );
          },
        }
      );
    } catch (err) {
      toast(err.message || "Checklist non disponibile", "err");
    }
  }

  async function addChecklistItems(items) {
    if (!items?.length) {
      toast("Suggerimenti già presenti", "ok");
      return;
    }
    try {
      const { auth, data } = await loadTrip();
      const trip = { ...data.trip };
      const checklist = Array.isArray(trip.checklist) ? trip.checklist.slice() : [];
      for (const it of items) {
        checklist.push({ id: crypto.randomUUID(), title: it.title, done: false });
      }
      trip.checklist = checklist.slice(0, 300);
      await saveTrip(auth, trip, data.revision);
      logActivity(auth.id, `Aggiunte ${items.length} voci pre-partenza`);
      closeModal();
      toast("Checklist aggiornata", "ok");
    } catch (err) {
      toast(err.message || "Salvataggio non riuscito", "err");
    }
  }

  async function showCompare() {
    try {
      const { data } = await loadTrip();
      const trip = data.trip || {};
      const pv = trip.meta?.preventivo || {};
      const estimate = Number(pv.totals?.groupCents) || 0;
      const spent = window.ProntiPlatform.expenseCents(trip.expenses);
      const pct = estimate > 0 ? Math.round((spent / estimate) * 100) : 0;
      const delta = spent - estimate;
      const fmt = (c) =>
        new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((c || 0) / 100);
      openModal(
        "Preventivo vs spese",
        `<div class="pv-ux-card">
          <p><strong>Preventivo:</strong> ${fmt(estimate)}</p>
          <p><strong>Spese registrate:</strong> ${fmt(spent)}</p>
          <div class="pv-compare-bar ${pct > 100 ? "warn" : ""}"><span style="width:${Math.min(Math.max(pct, 0), 100)}%"></span></div>
          <p>${estimate ? `Usato circa <strong>${pct}%</strong> del preventivo.` : "Nessun preventivo salvato."}</p>
          <p>${delta === 0 ? "In pari." : delta > 0 ? `Oltre preventivo di ${fmt(delta)}.` : `Sotto preventivo di ${fmt(-delta)}.`}</p>
        </div>
        <div class="pv-ux-actions"><button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button></div>`
      );
    } catch (err) {
      toast(err.message || "Confronto non disponibile", "err");
    }
  }

  function showTemplates() {
    openModal(
      "Template viaggio",
      `<p>Parti da uno schema pronto (gratuito, sul dispositivo).</p>
       <ul class="pv-ux-list">${TEMPLATES.map(
         (t) =>
           `<li><strong>${escapeHtml(t.title)}</strong><div>${escapeHtml(t.notes)}</div>
            <div class="pv-ux-actions"><button type="button" class="pv-ux-primary" data-tpl="${t.id}">Usa template</button></div></li>`
       ).join("")}</ul>`,
      {
        onMount: (body) => {
          body.querySelectorAll("[data-tpl]").forEach((btn) => {
            btn.addEventListener("click", () => void applyTemplate(btn.getAttribute("data-tpl")));
          });
        },
      }
    );
  }

  async function applyTemplate(id) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    try {
      const { auth, data } = await loadTrip();
      const trip = { ...data.trip };
      const start = trip.start || new Date().toISOString().slice(0, 10);
      const endDate = new Date(Date.parse(start) + (tpl.days - 1) * 86400000);
      trip.notes = [trip.notes, tpl.notes].filter(Boolean).join("\n");
      trip.end = trip.end || endDate.toISOString().slice(0, 10);
      const checklist = Array.isArray(trip.checklist) ? trip.checklist.slice() : [];
      for (const title of tpl.checklist) {
        if (!checklist.some((c) => String(c.title).toLowerCase() === title.toLowerCase())) {
          checklist.push({ id: crypto.randomUUID(), title, done: false });
        }
      }
      trip.checklist = checklist;
      await saveTrip(auth, trip, data.revision);
      logActivity(auth.id, `Template applicato: ${tpl.title}`);
      closeModal();
      toast("Template applicato", "ok");
    } catch (err) {
      toast(err.message || "Template non applicato", "err");
    }
  }

  function makeInviteCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
  }

  async function showInvite() {
    try {
      const { auth, data } = await loadTrip();
      if (data.canEdit === false) throw new Error("Serve il link di modifica.");
      const trip = { ...data.trip };
      const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
      let code = meta.inviteCode;
      if (!code) {
        code = makeInviteCode();
        meta.inviteCode = code;
        trip.meta = meta;
        await saveTrip(auth, trip, data.revision);
      }
      try {
        await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteCode: code,
            record: {
              kind: "invite",
              code,
              id: auth.id,
              key: auth.key,
              title: trip.title || "Viaggio",
            },
          }),
        });
      } catch {
        /* local map still works */
      }
      const local = readJson(INVITE_LOCAL_KEY, {});
      local[code] = {
        id: auth.id,
        key: auth.key,
        title: trip.title || "Viaggio",
        at: new Date().toISOString(),
      };
      writeJson(INVITE_LOCAL_KEY, local);
      const link = `${location.origin}${location.pathname}?v=invite#invite=${code}`;
      openModal(
        "Codice invito",
        `<div class="pv-ux-card">
          <p>Codice a 6 caratteri:</p>
          <p style="font-size:1.6rem;letter-spacing:.12em;font-weight:800;margin:8px 0">${escapeHtml(code)}</p>
          <input readonly value="${escapeHtml(link)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #d7e4e6" />
         </div>
         <div class="pv-ux-actions">
           <button type="button" class="pv-ux-primary" id="pv-ux-copy-invite">Copia link</button>
           <button type="button" class="pv-ux-ghost" data-ux-close>Chiudi</button>
         </div>`,
        {
          onMount: (body) => {
            body.querySelector("#pv-ux-copy-invite")?.addEventListener("click", async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast("Link invito copiato", "ok");
              } catch {
                toast("Copia manualmente il link", "warn");
              }
            });
          },
        }
      );
      logActivity(auth.id, `Codice invito ${code}`);
    } catch (err) {
      toast(err.message || "Invito non disponibile", "err");
    }
  }

  async function redeemInviteFromHash() {
    try {
      const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const code = (p.get("invite") || "").toUpperCase();
      if (!code) return;
      let hit = readJson(INVITE_LOCAL_KEY, {})[code];
      if (!hit) {
        const res = await fetch(`/api/share/${encodeURIComponent("inv-" + code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.id && data?.key) hit = { id: data.id, key: data.key, title: data.title };
        }
      }
      if (!hit?.id || !hit?.key) {
        toast("Codice invito non trovato", "err");
        return;
      }
      location.hash = `trip=${encodeURIComponent(hit.id)}&key=${encodeURIComponent(hit.key)}`;
      toast("Invito aperto", "ok");
    } catch {
      toast("Invito non valido", "err");
    }
  }

  async function showRevisions() {
    const auth = tripAuth();
    const list = readJson(REVISIONS_KEY, {})[auth?.id] || [];
    openModal(
      "Versioni locali",
      list.length
        ? `<p>Ultime copie salvate su questo dispositivo.</p>
           <ul class="pv-ux-list">${list
             .map(
               (r, i) => `<li>
                 <strong>${escapeHtml(formatWhen(r.at))}</strong> · rev ${escapeHtml(String(r.revision))}
                 <div class="pv-ux-actions"><button type="button" class="pv-ux-primary" data-rev="${i}">Ripristina</button></div>
               </li>`
             )
             .join("")}</ul>`
        : `<p>Nessuna versione locale ancora. Salva il viaggio per crearne una.</p>`,
      {
        onMount: (body) => {
          body.querySelectorAll("[data-rev]").forEach((btn) => {
            btn.addEventListener("click", () => void restoreRevision(Number(btn.getAttribute("data-rev"))));
          });
        },
      }
    );
  }

  async function restoreRevision(index) {
    try {
      const { auth, data } = await loadTrip();
      const list = readJson(REVISIONS_KEY, {})[auth.id] || [];
      const snap = list[index];
      if (!snap?.trip) throw new Error("Versione non trovata");
      if (
        !window.confirm(
          "Ripristinare questa versione locale? Le modifiche più recenti in cloud verranno sovrascritte."
        )
      ) {
        return;
      }
      await saveTrip(auth, snap.trip, data.revision);
      logActivity(auth.id, `Ripristinata versione ${snap.revision}`);
      closeModal();
      toast("Versione ripristinata", "ok");
      setTimeout(() => location.reload(), 400);
    } catch (err) {
      toast(err.message || "Ripristino non riuscito", "err");
    }
  }

  async function exportTripText() {
    try {
      const { data } = await loadTrip();
      const trip = data.trip || {};
      const lines = [
        `Pronti? VIA! — ${trip.title || "Viaggio"}`,
        `${trip.destination || ""}`,
        `${trip.start || ""} → ${trip.end || ""}`,
        "",
        "ITINERARIO",
        ...(trip.stops || []).map(
          (s, i) =>
            `${i + 1}. ${s.day || "da decidere"} — ${s.title || ""}${s.notes ? ` (${s.notes})` : ""}`
        ),
        "",
        "SPESE",
        ...(trip.expenses || []).map((e) => `- ${e.title}: ${(window.ProntiPlatform.expenseAmountCents(e) / 100).toFixed(2)} €`),
        "",
        "NOTE",
        trip.notes || "—",
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(trip.title || "viaggio").replace(/\s+/g, "-").slice(0, 40)}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Export scaricato", "ok");
    } catch (err) {
      toast(err.message || "Export non riuscito", "err");
    }
  }

  function maybeOnboarding() {
    if (readJson(ONBOARD_KEY, null)?.done) return;
    if (!document.body.classList.contains("pv-account-ready")) return;
    if (document.getElementById("pv-account-gate") && !document.getElementById("pv-account-gate").hidden) {
      return;
    }
    openModal(
      "Come muoverti in Pronti? VIA!",
      `<div class="pv-onboard-steps">
        <div><strong>Home</strong>Panoramica e crea un nuovo viaggio.</div>
        <div><strong>Viaggi</strong>Itinerario del viaggio aperto, oppure elenco dei tuoi viaggi.</div>
        <div><strong>HUB</strong>Collabora: voti, preparazione, numeri e backup di gruppo.</div>
        <div><strong>IA</strong>Bacchetta magica — suggerimenti e Lingua sul posto.</div>
        <div><strong>Profilo</strong>Strumenti, inviti, account e impostazioni.</div>
      </div>
      <div class="pv-ux-actions">
        <button type="button" class="pv-ux-primary" id="pv-ux-onboard-done">Inizia</button>
      </div>`,
      {
        onMount: (body) => {
          body.querySelector("#pv-ux-onboard-done")?.addEventListener("click", () => {
            writeJson(ONBOARD_KEY, { done: true, at: new Date().toISOString(), ver: "20261107j" });
            closeModal();
            if (!tripAuth()) {
              const createBtn = [...document.querySelectorAll("button, a")].find((el) =>
                /nuovo viaggio/i.test((el.textContent || "").trim())
              );
              createBtn?.scrollIntoView?.({ block: "center", behavior: "smooth" });
            }
          });
        },
      }
    );
  }

  function hookSaveToastsAndRevisions() {
    if (window.__pvUxFetchHooked) return;
    window.__pvUxFetchHooked = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const res = await original(input, init);
      try {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init.method || "GET").toUpperCase();
        if (/\/api\/trips\//i.test(url) && (method === "PUT" || method === "PATCH") && res.ok) {
          const data = await res.clone().json().catch(() => null);
          const auth = tripAuth();
          if (auth && data?.trip) {
            pushRevision(auth.id, data.revision, data.trip);
            logActivity(auth.id, "Modifiche salvate");
          }
        }
      } catch {
        /* ignore */
      }
      return res;
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(iso) {
    try {
      return new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso || "";
    }
  }

  function syncPrimaryNavState() {
    if (typeof window.__pvSetPrimaryNav !== "function") return;
    if (document.body.classList.contains("pv-plat-open")) {
      window.__pvSetPrimaryNav("hub");
      return;
    }
    if (document.body.classList.contains("pv-magic-open")) {
      window.__pvSetPrimaryNav("ai");
      document.getElementById("pv-nav-ai")?.setAttribute("aria-expanded", "true");
      return;
    }
    document.getElementById("pv-nav-ai")?.setAttribute("aria-expanded", "false");
    const menuOpen = Boolean(document.querySelector(".pv-ux-modal.pv-open"));
    if (menuOpen) {
      window.__pvSetPrimaryNav("profile");
      return;
    }
    window.__pvSetPrimaryNav(tripAuth() ? "trips" : "home");
  }

  /**
   * Legacy trips may carry stop.category values (e.g. «Cultura») that the current
   * Zod enum rejects — that blocked Splitpay expense saves with a cryptic toast.
   */
  const STOP_CAT_OK = new Set([
    "Visita",
    "Spiaggia",
    "Cibo",
    "Trasporto",
    "Alloggio",
    "Altro",
    "Cultura",
    "Natura",
    "Attività",
    "Shopping",
  ]);
  const STOP_CAT_MAP = {
    Cultura: "Visita",
    Natura: "Spiaggia",
    Nature: "Spiaggia",
    Museum: "Visita",
    Attraction: "Visita",
    Restaurant: "Cibo",
    Hotel: "Alloggio",
    Transport: "Trasporto",
  };

  function normalizeStopCategory(raw) {
    const c = String(raw || "").trim();
    if (STOP_CAT_OK.has(c)) return c;
    if (STOP_CAT_MAP[c]) return STOP_CAT_MAP[c];
    return "Altro";
  }

  function sanitizeTripCategories(trip) {
    if (!trip || !Array.isArray(trip.stops)) return trip;
    let changed = false;
    for (const stop of trip.stops) {
      const next = normalizeStopCategory(stop.category);
      if (stop.category !== next) {
        stop.category = next;
        changed = true;
      }
    }
    return changed ? trip : trip;
  }

  function sanitizeStoredTrips() {
    try {
      const raw = localStorage.getItem("viavia-local-trips-v1");
      if (!raw) return;
      const db = JSON.parse(raw);
      let dirty = false;
      for (const row of Object.values(db || {})) {
        if (!row?.trip?.stops) continue;
        const before = JSON.stringify(row.trip.stops.map((s) => s.category));
        sanitizeTripCategories(row.trip);
        const after = JSON.stringify(row.trip.stops.map((s) => s.category));
        if (before !== after) dirty = true;
      }
      if (dirty) localStorage.setItem("viavia-local-trips-v1", JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }

  function hookTripSanitizeFetch() {
    if (window.__pvTripCatSanitize) return;
    window.__pvTripCatSanitize = true;
    const orig = window.fetch;
    if (typeof orig !== "function") return;
    window.fetch = async function pvFetchSanitize(input, init) {
      try {
        // Only rewrite plain string URL + string body (don't break Request objects / api-shim).
        if (typeof input === "string" && /\/api\/trips/i.test(input) && typeof init?.body === "string") {
          const payload = JSON.parse(init.body);
          if (payload?.trip) sanitizeTripCategories(payload.trip);
          else if (Array.isArray(payload?.stops)) sanitizeTripCategories(payload);
          return orig.call(this, input, { ...init, body: JSON.stringify(payload) });
        }
      } catch {
        /* pass through */
      }
      return orig.apply(this, arguments);
    };
  }

  function tick() {
    const run = (fn) => {
      try {
        fn();
      } catch {
        /* keep suite alive */
      }
    };
    run(ensureStyles);
    run(ensureItineraryLayoutPolish);
    run(cleanupLegacyChrome);
    run(() => document.body.classList.toggle("pv-trip-open", Boolean(tripAuth())));
    run(injectEmptyStates);
    run(injectMemberRoles);
    run(injectOfflineChip);
    run(enhanceHomeTripCards);
    run(enhanceRecentTripsDelete);
    run(injectTripDeleteButton);
    run(injectHomeDeleteEntry);
    run(polishLocalOnlyBanner);
    run(syncPrimaryNavState);
    run(sanitizeStoredTrips);
    run(() => {
      if (typeof window.__pvApplyDestTheme === "function") void window.__pvApplyDestTheme(false);
    });
  }

  window.addEventListener("pv-share-blocked", (ev) => {
    toast(ev?.detail?.message || "Link non pronto", "warn");
  });

  hookSaveToastsAndRevisions();
  hookTripSanitizeFetch();
  sanitizeStoredTrips();
  const obs = new MutationObserver(() => {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 220);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => {
    setTimeout(() => {
      void redeemInviteFromHash();
      tick();
    }, 200);
  });
  setTimeout(tick, 500);
  // Backup: SPA mutation storms can starve the debounced observer tick.
  setInterval(() => {
    try {
      polishLocalOnlyBanner();
      enhanceHomeTripCards();
    } catch {
      /* ignore */
    }
  }, 1200);
  setTimeout(() => {
    void redeemInviteFromHash();
    maybeOnboarding();
  }, 2200);
})();
