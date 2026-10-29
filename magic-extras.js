/**
 * Free Wanderlog-parity extras for Pronti? VIA!
 * - Pronty (Bacchetta magica): AI floating companion — Idee + chat + Lingua
 *   Funziona prima e durante il viaggio; FAB a tondino spostabile
 * - Packing list templates
 * - Budget privato + expense category breakdown
 * - Day-colored map pins, distances, meteo, FX in Spese, link utili
 */
(() => {
  const STYLE_ID = "pv-magic-extras-css";
  const ROOT_ID = "pv-magic-root";
  const AI_NAME = "Pronty";
  const AI_FAB_POS_KEY = "viavia-pronty-fab-pos-v3";
  const AI_PANEL_POS_KEY = "viavia-pronty-panel-pos";
  // Dock: both FABs stack on the right, clear of the home indicator.
  const FAB_SAFE = "max(48px, env(safe-area-inset-bottom, 0px) + 24px)";
  const FAB_GAP = 24;
  const FAB_SIZE = 62;
  const FAB_DOCK_RIGHT = 18;
  // Lower slot offset from safe bottom, then Pronty sits one slot above.
  const FAB_SLOT = FAB_SIZE + FAB_GAP;
  const PRONTY_FAB_BOTTOM = `calc(${FAB_SAFE} + ${FAB_SLOT}px)`;
  const DAY_COLORS = ["#007d82", "#4770b1", "#bb7735", "#8965a7", "#c05f67", "#528545", "#2a9d8f", "#e76f51"];
  const WMO = {
    0: "Sereno",
    1: "Prevalentemente sereno",
    2: "Parzialmente nuvoloso",
    3: "Coperto",
    45: "Nebbia",
    48: "Nebbia",
    51: "Pioggerella",
    61: "Pioggia",
    63: "Pioggia",
    65: "Pioggia forte",
    71: "Neve",
    80: "Rovesci",
    95: "Temporale",
  };

  const PACKING_TEMPLATES = {
    Mare: [
      "Costume e asciugamano",
      "Crema solare",
      "Occhiali da sole",
      "Ciabatte",
      "Cappello",
      "Documenti e assicurazione",
      "Caricabatterie",
      "Medicinali di base",
    ],
    Città: [
      "Scarpe comode",
      "Adattatore prese",
      "Power bank",
      "Documenti e biglietti",
      "Ombrello leggero",
      "Borraccia",
      "Medicinali di base",
      "Caricabatterie",
    ],
    Montagna: [
      "Scarponcini",
      "Giacca antivento",
      "Pile / strati",
      "Borraccia",
      "Crema solare",
      "Kit primo soccorso",
      "Torcia / frontale",
      "Documenti",
    ],
    Famiglia: [
      "Documenti di tutti",
      "Snack e borracce",
      "Giochi / cuffie",
      "Cambio extra",
      "Medicinali e termometro",
      "Crema solare",
      "Caricabatterie",
      "Prenotazioni stampate / offline",
    ],
  };

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (style && style.dataset.pvReady === "20261027a") return;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:0;z-index:80;pointer-events:none;font-family:inherit}
      #${ROOT_ID} > *{pointer-events:auto}
      #${ROOT_ID} .pv-magic-scrim{display:none;position:fixed;inset:0;background:rgba(12,32,36,.28);backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);z-index:0}
      #${ROOT_ID}.pv-open .pv-magic-scrim{display:block}
      #${ROOT_ID} .pv-magic-btn{
        appearance:none;border:0;position:fixed;right:${FAB_DOCK_RIGHT}px;bottom:${PRONTY_FAB_BOTTOM};z-index:2;
        width:${FAB_SIZE}px;height:${FAB_SIZE}px;border-radius:50%;padding:0;
        background:radial-gradient(circle at 30% 28%,#2bb7bc 0%,#007d82 55%,#0a5c60 100%);
        color:#fff;box-shadow:0 14px 32px rgba(0,70,80,.38),inset 0 1px 0 rgba(255,255,255,.25);
        cursor:grab;display:inline-flex;align-items:center;justify-content:center;
        touch-action:none;user-select:none;-webkit-user-select:none;
        transition:transform .15s ease,box-shadow .15s ease;
        animation:pv-fab-float 3.2s ease-in-out infinite;
      }
      @keyframes pv-fab-float{
        0%,100%{transform:translateY(0)}
        50%{transform:translateY(-5px)}
      }
      #${ROOT_ID} .pv-magic-btn:active{cursor:grabbing;animation:none;transform:scale(.96)}
      #${ROOT_ID} .pv-magic-btn.pv-dragging{cursor:grabbing;animation:none;transform:scale(1.04);box-shadow:0 18px 40px rgba(0,70,80,.45)}
      #${ROOT_ID} .pv-magic-btn[disabled]{opacity:.6;cursor:wait;animation:none}
      #${ROOT_ID} .pv-magic-btn .pv-pronty-face{width:42px;height:42px;display:block}
      #${ROOT_ID} .pv-magic-btn .pv-pronty-label{
        position:absolute;right:68px;bottom:14px;white-space:nowrap;
        background:#0f2c31;color:#fff;font:700 11px/1 inherit;letter-spacing:.02em;
        padding:6px 10px;border-radius:999px;box-shadow:0 6px 16px rgba(0,0,0,.18);
        opacity:0;transform:translateX(6px);pointer-events:none;transition:opacity .15s,transform .15s;
      }
      #${ROOT_ID} .pv-magic-btn:hover .pv-pronty-label,#${ROOT_ID} .pv-magic-btn:focus-visible .pv-pronty-label{opacity:1;transform:none}
      #${ROOT_ID} .pv-magic-panel{
        position:fixed;right:16px;bottom:calc(${FAB_SAFE} + ${FAB_SIZE * 2 + FAB_GAP * 2}px);z-index:1;
        width:min(400px,calc(100vw - 24px));max-height:min(78vh,680px);
        overflow:hidden;display:flex;flex-direction:column;background:#fff;
        border:1px solid #d0e0e0;border-radius:22px;
        box-shadow:0 22px 60px rgba(12,40,48,.28);padding:0;
        touch-action:none;
      }
      #${ROOT_ID} .pv-magic-panel[hidden]{display:none !important}
      #${ROOT_ID} .pv-magic-panel .pv-drag-handle{cursor:grab;touch-action:none}
      #${ROOT_ID} .pv-magic-panel .pv-drag-handle:active{cursor:grabbing}
      #${ROOT_ID} .pv-panel-head{flex:0 0 auto;padding:12px 14px 10px;border-bottom:1px solid #e8f0f0;background:#f7fbfb}
      #${ROOT_ID} .pv-panel-body{flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 14px 8px}
      #${ROOT_ID} .pv-panel-foot{flex:0 0 auto;padding:10px 14px 14px;border-top:1px solid #e8f0f0;background:#fff}
      #${ROOT_ID} .pv-magic-panel h3{margin:8px 0 4px;font-size:1.12rem;color:#0f2c31;font-weight:700}
      #${ROOT_ID} .pv-magic-panel .pv-lead{margin:0 0 10px;color:#2f4e55;font-size:.88rem;line-height:1.45}
      #${ROOT_ID} .pv-magic-panel p{margin:0 0 12px;color:#3d5960;font-size:.92rem}
      #${ROOT_ID} .pv-magic-panel label{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid #eef3f3;font-size:.92rem;color:#1d3338}
      #${ROOT_ID} .pv-magic-panel .pv-meta{display:block;color:#4d676e;font-size:.8rem;margin-top:2px}
      #${ROOT_ID} .pv-tabs{display:flex;gap:4px;margin:0;padding:3px;background:#e4efef;border-radius:12px}
      #${ROOT_ID} .pv-tabs button{flex:1;appearance:none;border:0;border-radius:10px;padding:10px 6px;font:600 13px inherit;color:#2f5056;background:transparent;cursor:pointer;min-height:40px}
      #${ROOT_ID} .pv-tabs button.active{background:#fff;color:#007d82;box-shadow:0 1px 4px rgba(0,80,90,.12)}
      #${ROOT_ID} .pv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      #${ROOT_ID} .pv-actions button,#${ROOT_ID} .pv-card-actions button{appearance:none;border:0;border-radius:12px;padding:11px 14px;font:600 13px inherit;cursor:pointer;min-height:42px}
      #${ROOT_ID} .pv-actions .primary,#${ROOT_ID} .pv-card-actions .primary{background:#007d82;color:#fff}
      #${ROOT_ID} .pv-actions .ghost,#${ROOT_ID} .pv-card-actions .ghost{background:#eef5f5;color:#1d3338}
      #${ROOT_ID} .pv-status{font-size:.82rem;color:#3d5960;min-height:1.2em;margin:8px 0 0}
      #${ROOT_ID} .pv-chips{display:flex;flex-wrap:nowrap;gap:8px;margin:0 0 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;scrollbar-width:none}
      #${ROOT_ID} .pv-chips::-webkit-scrollbar{display:none}
      #${ROOT_ID} .pv-chips button{appearance:none;border:1px solid #b8d0d0;background:#fff;color:#124048;border-radius:999px;padding:9px 12px;font:600 12px inherit;cursor:pointer;white-space:nowrap;flex:0 0 auto;min-height:38px}
      #${ROOT_ID} .pv-chat{display:flex;flex-direction:column;gap:10px;min-height:120px;max-height:none;overflow:visible;padding:0 0 8px}
      #${ROOT_ID} .pv-bubble{max-width:100%;padding:12px 14px;border-radius:16px;font-size:.92rem;line-height:1.5;color:#122f34;white-space:pre-wrap;word-break:break-word}
      #${ROOT_ID} .pv-bubble.bot{align-self:stretch;background:#eaf5f5;border:1px solid #d5e8e8;border-bottom-left-radius:6px;color:#0f2c31}
      #${ROOT_ID} .pv-bubble.user{align-self:flex-end;max-width:90%;background:#007d82;color:#fff;border-bottom-right-radius:6px}
      #${ROOT_ID} .pv-chat-form{display:grid;grid-template-columns:1fr auto;gap:8px;margin:0}
      #${ROOT_ID} .pv-chat-form input,#${ROOT_ID} .pv-lang-pair textarea,#${ROOT_ID} .pv-magic-panel select{width:100%;border:1px solid #b8d0d0;border-radius:12px;padding:12px 14px;font:inherit;color:#122f34;background:#fff;min-height:44px}
      #${ROOT_ID} .pv-chat-form button{appearance:none;border:0;border-radius:12px;padding:12px 16px;background:#007d82;color:#fff;font:600 14px inherit;cursor:pointer;min-height:44px}
      #${ROOT_ID} .pv-results-title{margin:14px 0 8px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#4d676e;font-weight:700}
      #${ROOT_ID} .pv-place-card{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px;margin:0 0 10px;border:1px solid #e0ecec;border-radius:14px;background:#fbfefe}
      #${ROOT_ID} .pv-place-card img{width:64px;height:64px;object-fit:cover;border-radius:12px;background:#e8f0f0}
      #${ROOT_ID} .pv-place-card .pv-ph{width:64px;height:64px;border-radius:12px;background:linear-gradient(160deg,#cfe6e6,#eef7f7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#1a4a50;font-size:.62rem;font-weight:700;text-align:center;padding:4px;line-height:1.15;letter-spacing:.02em;text-transform:uppercase}
      #${ROOT_ID} .pv-place-card .pv-ph .pv-ph-ico{font-size:.72rem;line-height:1.1;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.85}
      #${ROOT_ID} .pv-place-card strong{display:block;font-size:.95rem;color:#0f2c31;margin-bottom:3px;line-height:1.25}
      #${ROOT_ID} .pv-place-card .pv-kind-tag{display:inline-block;margin:0 0 4px;padding:2px 7px;border-radius:999px;background:#e4f2f2;color:#0f5a60;font-size:.68rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
      #${ROOT_ID} .pv-place-card .pv-extract{font-size:.84rem;color:#35555c;line-height:1.4;margin:0 0 10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      #${ROOT_ID} .pv-card-actions{display:flex;flex-wrap:wrap;gap:8px}
      #${ROOT_ID} .pv-card-actions .primary{flex:1 1 100%}
      #${ROOT_ID} .pv-card-actions a,#${ROOT_ID} .pv-card-actions button{font-size:12px;padding:10px 12px;text-decoration:none;text-align:center;display:inline-flex;align-items:center;justify-content:center;border-radius:11px;min-height:40px;box-sizing:border-box;flex:1 1 calc(50% - 4px)}
      #${ROOT_ID} .pv-card-actions a.ghost{border:1px solid #a9c4c4;background:#fff;color:#122f34;font-weight:600}
      #${ROOT_ID} .pv-lang-pair{display:grid;gap:10px}
      #${ROOT_ID} .pv-lang-pair label{display:grid;gap:4px;border:0;padding:0;font-size:.78rem;font-weight:700;color:#4d676e;letter-spacing:.04em;text-transform:uppercase}
      #${ROOT_ID} .pv-lang-pair textarea{min-height:72px;resize:vertical;font:400 .92rem inherit;text-transform:none;letter-spacing:normal;color:#122f34}
      #${ROOT_ID} .pv-phrase{appearance:none;border:1px solid #d9e7e7;background:#f7fbfb;border-radius:12px;padding:8px 10px;text-align:left;cursor:pointer;width:100%;margin:0 0 6px}
      #${ROOT_ID} .pv-phrase strong{display:block;font-size:.86rem;color:#122f34}
      #${ROOT_ID} .pv-phrase span{display:block;font-size:.78rem;color:#4d676e;margin-top:2px}
      @media (max-width:640px){
        #${ROOT_ID} .pv-magic-btn{
          right:16px;width:58px;height:58px;
          bottom:calc(max(52px, env(safe-area-inset-bottom, 0px) + 28px) + 82px);
        }
        #${ROOT_ID} .pv-magic-panel{
          left:0!important;right:0!important;bottom:0!important;top:auto!important;
          width:100%;max-width:none;max-height:min(72dvh,72vh);
          border-radius:18px 18px 0 0;border-left:0;border-right:0;border-bottom:0;
        }
        #${ROOT_ID} .pv-magic-btn .pv-pronty-label{display:none}
        #${ROOT_ID} .pv-place-card{grid-template-columns:56px 1fr;gap:10px;padding:12px}
        #${ROOT_ID} .pv-place-card img,#${ROOT_ID} .pv-place-card .pv-ph{width:56px;height:56px}
        #${ROOT_ID} .pv-card-actions{grid-template-columns:1fr 1fr}
        #${ROOT_ID} .pv-bubble{font-size:.94rem;line-height:1.55}
      }
      .pv-extras-bar{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
      .pv-extras-bar button,.pv-budget-box button,.pv-chart-box button{appearance:none;border:1px solid #c9dbdb;background:#fff;color:#184047;border-radius:999px;padding:7px 12px;font:600 12px inherit;cursor:pointer}
      .pv-extras-bar button:hover,.pv-budget-box button:hover{background:#eef7f7}
      .pv-budget-box,.pv-chart-box{margin:12px 0;padding:12px 14px;border:1px solid #d9e7e7;border-radius:16px;background:linear-gradient(180deg,#f7fbfb,#fff)}
      .pv-budget-box strong,.pv-chart-box strong{display:block;margin-bottom:8px;color:#16353b}
      .pv-budget-box .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .pv-budget-box input{flex:1;min-width:120px;border:1px solid #c9dbdb;border-radius:10px;padding:8px 10px;font:inherit}
      .pv-chart-row{display:grid;grid-template-columns:88px 1fr 64px;gap:8px;align-items:center;margin:6px 0;font-size:.86rem;color:#355055}
      .pv-chart-row .bar{height:10px;border-radius:999px;background:#e6efef;overflow:hidden}
      .pv-chart-row .fill{height:100%;background:#007d82;border-radius:inherit}
      .pv-dist-note,.route-hop{display:block;margin:4px 0 10px;padding:6px 10px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.78rem;font-weight:600;width:fit-content}
      .pv-day-legend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
      .pv-day-legend span{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:#456}
      .pv-day-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
      .pv-day-weather,.pv-links-box,.pv-fx-calc{margin:12px 0 14px;padding:14px 16px;border:1px solid #d9e7e7;border-radius:16px;background:#fff}
      .pv-day-weather .pv-block-title,.pv-links-box .pv-block-title,.pv-fx-calc .pv-block-title{margin:0 0 10px;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-day-weather .pv-block-meta,.pv-fx-calc .pv-block-meta{margin:0 0 10px;font-size:.86rem;color:#5b7076}
      .pv-day-weather{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center}
      .pv-day-weather .pv-block-title{margin:0;width:100%}
      .pv-day-weather .pv-weather-card{flex:1;min-width:160px;padding:0;border:0;background:transparent;display:flex;flex-direction:column;gap:4px}
      .pv-day-weather .pv-weather-card strong{font-size:.92rem;color:#16353b}
      .pv-day-weather .pv-weather-card .temp{font-size:1.15rem;font-weight:700;color:#007d82}
      .pv-day-weather .pv-weather-card .cond{font-size:.82rem;color:#5b7076;line-height:1.35}
      .pv-fx-calc .pv-fx-rows{display:grid;gap:10px;max-width:420px}
      .pv-fx-calc .pv-fx-row{display:grid;grid-template-columns:minmax(0,1fr) 56px;gap:8px;align-items:center}
      .pv-fx-calc .pv-fx-row input{width:100%;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;font:600 1rem inherit;color:#16353b;background:#f7fbfb}
      .pv-fx-calc .pv-fx-row input:focus{outline:2px solid #007d82;outline-offset:1px;background:#fff}
      .pv-fx-calc .pv-fx-row .code{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#5b7076;font-weight:700}
      .pv-fx-calc .pv-fx-rate{margin:0;font-size:.82rem;color:#5b7076}
      .pv-expense-fx{margin:0;display:grid;gap:8px}
      .pv-expense-fx select{width:100%;border:1px solid #c9dbdb;border-radius:10px;padding:10px 12px;font:inherit;background:#fff;color:#16353b}
      .pv-expense-fx-hint{margin:0;font-size:.82rem;color:#5b7076;min-height:1.2em}
      .pv-links-box .pv-action-list{display:grid;gap:0}
      .pv-links-box .pv-action-list a,.pv-links-box .pv-action-list button{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:11px 0;border:0;border-bottom:1px solid #eef3f3;background:transparent;color:#184047;font:600 0.92rem inherit;cursor:pointer;text-decoration:none;text-align:left}
      .pv-links-box .pv-action-list a:last-child,.pv-links-box .pv-action-list button:last-child{border-bottom:0;padding-bottom:0}
      .pv-links-box .pv-action-list a:first-child,.pv-links-box .pv-action-list button:first-child{padding-top:0}
      .pv-links-box .pv-action-list .hint{font-size:.78rem;font-weight:600;color:#7a9096}
      .pv-links-box .pv-status{min-height:1.1em;margin:10px 0 0;font-size:.82rem;color:#5b7076}
      @media (prefers-reduced-motion: reduce){
        #${ROOT_ID} .pv-magic-btn,.pv-prev-launch{animation:none !important}
      }
    `;
    style.dataset.pvReady = "20261027a";
  }

  function fabNodes() {
    return {
      pronty: document.querySelector("#pv-magic-open"),
      prev: document.querySelector(".pv-prev-launch"),
    };
  }

  function activeSheetEl() {
    const magic = document.querySelector("#pv-magic-panel");
    if (magic && !magic.hidden) return magic;
    const prev = document.querySelector("#pv-preventivo-root.open .pv-prev-shell");
    if (prev) return prev;
    return null;
  }

  function snapshotFabStyle(el) {
    if (!el || el.dataset.pvParkSnap) return;
    el.dataset.pvParkSnap = JSON.stringify({
      left: el.style.left || "",
      top: el.style.top || "",
      right: el.style.right || "",
      bottom: el.style.bottom || "",
      transition: el.style.transition || "",
      animation: el.style.animation || "",
    });
  }

  function restoreFabStyle(el) {
    if (!el) return;
    let snap = null;
    try {
      snap = JSON.parse(el.dataset.pvParkSnap || "null");
    } catch {
      snap = null;
    }
    delete el.dataset.pvParkSnap;
    delete el.dataset.pvParked;
    if (!snap) {
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.bottom = "";
      el.style.transition = "";
      el.style.animation = "";
      return;
    }
    el.style.left = snap.left;
    el.style.top = snap.top;
    el.style.right = snap.right;
    el.style.bottom = snap.bottom;
    el.style.transition = snap.transition || "";
    el.style.animation = snap.animation || "";
  }

  /** Park both tondini stacked on the right, just above the open sheet (as in the reference). */
  function parkFabsAboveSheet() {
    const { pronty, prev } = fabNodes();
    if (!pronty && !prev) return;
    const sheet = activeSheetEl();
    // Prefer measured size, but never trust 0/NaN (can happen mid-layout).
    let size = 58;
    try {
      const raw =
        Number((pronty || prev)?.offsetWidth) ||
        parseFloat(getComputedStyle(pronty || prev).width) ||
        58;
      if (Number.isFinite(raw) && raw >= 40 && raw <= 96) size = Math.round(raw);
    } catch {
      size = 58;
    }
    const gap = 20;
    const marginRight = 16;
    const marginAbove = 18;
    let sheetTop;
    if (sheet) {
      sheetTop = sheet.getBoundingClientRect().top;
    } else if (window.matchMedia && window.matchMedia("(max-width:640px)").matches) {
      sheetTop = window.innerHeight * 0.28;
    } else {
      sheetTop = window.innerHeight - 120;
    }
    // If sheet measurement is still collapsing, assume ~72vh sheet (28% free above).
    if (!Number.isFinite(sheetTop) || sheetTop < 80 || sheetTop > window.innerHeight - 80) {
      sheetTop = Math.round(window.innerHeight * 0.28);
    }
    const left = Math.max(8, window.innerWidth - marginRight - size);
    let lowerTop = sheetTop - marginAbove - size;
    let upperTop = lowerTop - gap - size;
    if (upperTop < 8) {
      upperTop = 8;
      lowerTop = upperTop + size + gap;
    }
    const place = (el, top) => {
      if (!el) return;
      snapshotFabStyle(el);
      el.dataset.pvParked = "1";
      el.style.animation = "none";
      el.style.transition = "left .28s ease, top .28s ease";
      el.style.left = `${left}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.zIndex = "120";
    };
    // Pronty (smile) on top, Preventivo (doc) below — same order as the screenshot.
    place(pronty, upperTop);
    place(prev, lowerTop);
  }

  function restoreFabsFromPark() {
    const { pronty, prev } = fabNodes();
    restoreFabStyle(pronty);
    restoreFabStyle(prev);
  }

  function setMagicOpen(open) {
    panelOpen = open;
    const root = document.getElementById(ROOT_ID);
    const panel = root?.querySelector("#pv-magic-panel");
    const fab = root?.querySelector("#pv-magic-open");
    if (root) root.classList.toggle("pv-open", open);
    if (panel) panel.hidden = !open;
    if (fab) fab.setAttribute("aria-expanded", open ? "true" : "false");
    // Don't lock the whole page — Pronty is a floating companion.
    if (window.matchMedia && window.matchMedia("(max-width:640px)").matches) {
      document.documentElement.style.overflow = open ? "hidden" : "";
    } else {
      document.documentElement.style.overflow = "";
    }
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(parkFabsAboveSheet));
    } else if (!document.getElementById("pv-preventivo-root")?.classList.contains("open")) {
      restoreFabsFromPark();
    }
  }

  window.__pvParkFabsAboveSheet = parkFabsAboveSheet;
  window.__pvRestoreFabsFromPark = restoreFabsFromPark;

  /** Shared draggable helper for floating FABs / panels. Click still fires if movement is tiny. */
  function makeDraggable(el, { storageKey, handle, onTap, axis = "both" } = {}) {
    if (!el || el.dataset.pvDragBound === "1") return;
    el.dataset.pvDragBound = "1";
    const target = handle || el;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    let moved = false;
    let dragging = false;

    const clamp = () => {
      const rect = el.getBoundingClientRect();
      const maxL = Math.max(8, window.innerWidth - rect.width - 8);
      const maxT = Math.max(8, window.innerHeight - rect.height - 8);
      let left = parseFloat(el.style.left || String(rect.left));
      let top = parseFloat(el.style.top || String(rect.top));
      left = Math.min(maxL, Math.max(8, left));
      top = Math.min(maxT, Math.max(8, top));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      return { left, top };
    };

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        el.style.left = `${saved.left}px`;
        el.style.top = `${saved.top}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
        requestAnimationFrame(clamp);
      }
    } catch {
      /* ignore */
    }

    const onPointerDown = (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      // Skip nested controls, but allow drag when the FAB itself is the button.
      const hit = ev.target?.closest?.("button, a, input, select, textarea, label");
      if (hit && hit !== el) return;
      const rect = el.getBoundingClientRect();
      startX = ev.clientX;
      startY = ev.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      moved = false;
      dragging = true;
      el.classList.add("pv-dragging");
      target.setPointerCapture?.(ev.pointerId);
    };
    const onPointerMove = (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (axis !== "y") el.style.left = `${origLeft + dx}px`;
      if (axis !== "x") el.style.top = `${origTop + dy}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      clamp();
    };
    const onPointerUp = (ev) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("pv-dragging");
      try {
        target.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* ignore */
      }
      const pos = clamp();
      // Don't overwrite idle dock coords while FABs are auto-parked above a sheet.
      if (storageKey && el.dataset.pvParked !== "1") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(pos));
        } catch {
          /* ignore */
        }
      }
      if (moved) {
        el.dataset.pvDidDrag = "1";
        // Swallow the synthetic click that follows a drag.
        const swallow = (ce) => {
          ce.preventDefault();
          ce.stopPropagation();
          el.removeEventListener("click", swallow, true);
        };
        el.addEventListener("click", swallow, true);
        setTimeout(() => el.removeEventListener("click", swallow, true), 400);
      } else if (typeof onTap === "function") {
        el.dataset.pvTapLock = "1";
        setTimeout(() => {
          el.dataset.pvTapLock = "0";
        }, 350);
        onTap(ev);
      }
    };
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerUp);
    // Reliable open path for browsers / automation that prefer click over pointerup-tap.
    if (typeof onTap === "function") {
      el.addEventListener("click", (ev) => {
        if (el.dataset.pvDidDrag === "1") {
          el.dataset.pvDidDrag = "0";
          return;
        }
        // Avoid double-open when pointerup already called onTap.
        if (el.dataset.pvTapLock === "1") return;
        el.dataset.pvTapLock = "1";
        setTimeout(() => {
          el.dataset.pvTapLock = "0";
        }, 350);
        onTap(ev);
      });
    }
  }
  window.__pvMakeDraggable = makeDraggable;

  function tripAuth() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const id = params.get("trip");
    const key = params.get("key");
    if (!id || !key) return null;
    return { id, key };
  }

  let tripLoadInflight = null;
  let tripLoadCache = null; // { id, at, payload }
  const TRIP_LOAD_TTL_MS = 4000;

  async function loadTrip({ force = false } = {}) {
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio salvato per usare questa funzione.");
    const now = Date.now();
    if (
      !force &&
      tripLoadCache &&
      tripLoadCache.id === auth.id &&
      now - tripLoadCache.at < TRIP_LOAD_TTL_MS
    ) {
      return tripLoadCache.payload;
    }
    if (!force && tripLoadInflight && tripLoadInflight.id === auth.id) {
      return tripLoadInflight.promise;
    }
    const promise = (async () => {
      const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Viaggio non disponibile");
      if (data.canEdit === false) throw new Error("Serve il link di modifica.");
      const payload = { auth, data };
      tripLoadCache = { id: auth.id, at: Date.now(), payload };
      return payload;
    })();
    tripLoadInflight = { id: auth.id, promise };
    try {
      return await promise;
    } finally {
      if (tripLoadInflight?.promise === promise) tripLoadInflight = null;
    }
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
    if (!res.ok) throw new Error(data.error || "Salvataggio non riuscito");
    // Keep local extras cache aligned so subsequent reads don't overwrite with stale GET.
    tripLoadCache = {
      id: auth.id,
      at: Date.now(),
      payload: { auth, data },
    };
    return data;
  }

  function uid() {
    return crypto.randomUUID();
  }

  function parseEuroToCents(raw) {
    const n = Number(String(raw || "0").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n < 0) throw new Error("Importo non valido");
    return Math.round(n * 100);
  }

  function formatEuro(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  }

  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLng = (b.lng - a.lng) * toRad;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
  }

  function tripDays(trip) {
    const days = [];
    for (let t = Date.parse(trip.start); t <= Date.parse(trip.end); t += 864e5) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
    return days;
  }

  async function geocodeDestination(q) {
    // Prefer same-origin shim, but fall back to Photon/Nominatim so the wand
    // still works on GitHub Pages when trip proxies flap.
    try {
      const res = await fetch(`/api/places?scope=destination&q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      const place = (data.places || []).find((p) => p.lat != null && p.lng != null) || (data.places || [])[0];
      if (place && place.lat != null) return place;
    } catch {
      /* try public geocoders */
    }

    try {
      const photon = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=default`,
        { signal: AbortSignal.timeout(12000) }
      ).then((r) => r.json());
      for (const feature of photon.features || []) {
        const coords = feature.geometry?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng, title: feature.properties?.name || q };
        }
      }
    } catch {
      /* nominatim next */
    }

    const nom = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      }
    ).then((r) => r.json());
    const hit = Array.isArray(nom) ? nom[0] : null;
    if (!hit || hit.lat == null) throw new Error("Non trovo coordinate per la destinazione.");
    return { lat: Number(hit.lat), lng: Number(hit.lon), title: hit.display_name || q };
  }

  async function fetchPois(lat, lng) {
    // Wikipedia geosearch is free and CORS-friendly from the browser.
    const wikiUrls = [
      `https://it.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`,
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`,
    ];
    let items = [];
    for (const url of wikiUrls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const data = await res.json();
        const list = data?.query?.geosearch || [];
        if (list.length) {
          items = list;
          break;
        }
      } catch {
        /* try next */
      }
    }

    // Fallback: same-origin / Cloudflare proxy to Overpass.
    if (!items.length) {
      const res = await fetch(`/api/pois?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=10000`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ricerca luoghi non disponibile.");
      const elements = Array.isArray(data.elements) ? data.elements : [];
      items = elements.map((el) => ({
        title: el.tags?.name || el.tags?.["name:it"] || el.tags?.["name:en"],
        lat: el.lat,
        lon: el.lon,
        kind: el.tags?.tourism || el.tags?.historic || el.tags?.leisure || "luogo",
      }));
    }

    const seen = new Set();
    const pois = [];
    for (const el of items) {
      const name = el.title || el.name;
      if (!name || seen.has(String(name).toLowerCase())) continue;
      seen.add(String(name).toLowerCase());
      const kind = el.kind || "luogo";
      pois.push({
        title: String(name).slice(0, 120),
        category: "Visita",
        lat: el.lat,
        lng: el.lon ?? el.lng,
        address: "",
        notes: `Suggerito dalla bacchetta magica (${kind})`,
        kind,
      });
      if (pois.length >= 24) break;
    }
    if (!pois.length) throw new Error("Nessun luogo trovato qui intorno.");
    return pois;
  }

  function distributeAcrossDays(pois, days) {
    if (!days.length) return pois.map((p) => ({ ...p, day: "" }));
    return pois.map((p, i) => ({ ...p, day: days[i % days.length] }));
  }

  function wandIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20 L14.5 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 4 l1.2 2.4 2.6.4-1.9 1.9.5 2.6L13 10.2 10.6 11.3l.5-2.6L9.2 6.8l2.6-.4L13 4z" fill="currentColor"/><path d="M16.5 14.5 l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2.7-1.4z" fill="currentColor"/></svg>`;
  }

  /** Cute round face for Pronty FAB */
  function prontyFace() {
    return `<svg class="pv-pronty-face" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#e8fafa"/>
      <circle cx="32" cy="32" r="28" fill="url(#pvProntyGlow)" opacity=".35"/>
      <defs><radialGradient id="pvProntyGlow" cx="30%" cy="30%"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#007d82"/></radialGradient></defs>
      <circle cx="23" cy="28" r="3.2" fill="#0f2c31"/>
      <circle cx="41" cy="28" r="3.2" fill="#0f2c31"/>
      <path d="M22 38c3.5 5 16.5 5 20 0" fill="none" stroke="#0f2c31" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="18" cy="34" r="3" fill="#ffb4a8" opacity=".85"/>
      <circle cx="46" cy="34" r="3" fill="#ffb4a8" opacity=".85"/>
      <path d="M44 14l1.1 2.2 2.4.3-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.3L44 14z" fill="#ffd56a"/>
    </svg>`;
  }

  function ensureRoot() {
    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  let panelOpen = false;
  let pendingPois = [];
  let magicTab = "chiedi";
  let chatPlaces = [];
  let magicTripCache = null;
  let chatHistory = []; // { role: 'user'|'assistant', content: string }

  function magicTabsHtml(active) {
    return `
      <div class="pv-tabs" role="tablist">
        <button type="button" data-tab="idee" class="${active === "idee" ? "active" : ""}">Idee</button>
        <button type="button" data-tab="chiedi" class="${active === "chiedi" ? "active" : ""}">Chiedi</button>
        <button type="button" data-tab="lingua" class="${active === "lingua" ? "active" : ""}">Lingua</button>
      </div>`;
  }

  function bindMagicTabs(panel) {
    panel.querySelectorAll(".pv-tabs [data-tab]").forEach((btn) => {
      btn.onclick = () => {
        magicTab = btn.dataset.tab;
        void showMagicPanel(panel, magicTab);
      };
    });
  }

  function renderFab() {
    if (!document.body.classList.contains("pv-account-ready")) return;
    if (document.querySelector("main.loading")) return;

    const root = ensureRoot();
    // Keep an open suggestion panel intact (MutationObserver would otherwise wipe it).
    if (root.querySelector("#pv-magic-panel") && !root.querySelector("#pv-magic-panel").hidden) {
      return;
    }
    if (root.querySelector("#pv-magic-open")) return;

    root.innerHTML = `
      <div class="pv-magic-scrim" id="pv-magic-scrim"></div>
      <button type="button" class="pv-magic-btn" id="pv-magic-open" aria-label="${AI_NAME} — Bacchetta magica" title="${AI_NAME}">
        ${prontyFace()}
        <span class="pv-pronty-label">${AI_NAME} · Bacchetta magica</span>
      </button>
      <div class="pv-magic-panel" id="pv-magic-panel" hidden></div>
    `;
    const openPanel = () => {
      setMagicOpen(true);
      void showMagicPanel(root.querySelector("#pv-magic-panel"), magicTab || "chiedi");
    };
    const fab = root.querySelector("#pv-magic-open");
    makeDraggable(fab, { storageKey: AI_FAB_POS_KEY, onTap: openPanel });
    root.querySelector("#pv-magic-scrim").onclick = () => setMagicOpen(false);
  }

  function bindPanelChrome(panel) {
    const close = panel.querySelector("#pv-magic-close");
    if (close) close.onclick = () => setMagicOpen(false);
    const handle = panel.querySelector(".pv-drag-handle") || panel.querySelector(".pv-panel-head");
    if (handle && !(window.matchMedia && window.matchMedia("(max-width:640px)").matches)) {
      makeDraggable(panel, { storageKey: AI_PANEL_POS_KEY, handle });
    }
  }

  function readPreventivoDraft() {
    try {
      const raw = JSON.parse(localStorage.getItem("viavia-preventivo-v2") || "null");
      const draft = raw?.__draft__?.params || null;
      if (draft && (draft.destination || draft.title)) return draft;
    } catch {
      /* ignore */
    }
    return null;
  }

  async function showMagicPanel(panel, tab = "chiedi") {
    magicTab = tab;
    const auth = tripAuth();
    if (auth) {
      try {
        if (!magicTripCache) {
          const { data } = await loadTrip();
          magicTripCache = data.trip;
        }
      } catch (err) {
        // Keep Pronty usable even if trip load fails (pre-trip / offline).
        magicTripCache = magicTripCache || null;
        console.warn("[pronty]", err);
      }
    } else {
      // Before a trip is open: seed context from preventivo draft if any.
      const draft = readPreventivoDraft();
      if (draft && !magicTripCache) {
        magicTripCache = {
          title: draft.title || "",
          destination: draft.destination || "",
          start: draft.start || "",
          end: draft.end || "",
          members: Array.from({ length: Number(draft.travelers) || 2 }, (_, i) => ({
            name: i === 0 ? "Tu" : `Viaggiatore ${i + 1}`,
          })),
          stops: [],
          _draftOnly: true,
        };
      }
    }

    if (tab === "idee") return void runMagicSuggest(panel);
    if (tab === "lingua") return void renderLanguageTab(panel);
    return void renderChatTab(panel);
  }

  async function runMagicSuggest(panel) {
    panel.innerHTML = `
      <div class="pv-panel-head pv-drag-handle">${magicTabsHtml("idee")}<h3>${AI_NAME} · Idee</h3><p class="pv-lead">Bacchetta magica — proposte per l’itinerario</p></div>
      <div class="pv-panel-body"><p class="pv-status">Cerco luoghi intorno alla destinazione…</p></div>`;
    bindMagicTabs(panel);
    bindPanelChrome(panel);
    try {
      if (!tripAuth()) {
        panel.innerHTML = `
          <div class="pv-panel-head pv-drag-handle">${magicTabsHtml("idee")}<h3>${AI_NAME} · Idee</h3></div>
          <div class="pv-panel-body">
            <p class="pv-lead">Apri o crea un viaggio per ricevere idee geolocalizzate da aggiungere alle tappe. Prima del viaggio puoi comunque chattare con ${AI_NAME} o aprire il Preventivo intelligente.</p>
            <div class="pv-actions">
              <button type="button" class="primary" id="pv-pronty-open-prev">Apri Preventivo</button>
              <button type="button" class="ghost" id="pv-magic-close">Chiudi</button>
            </div>
          </div>`;
        bindMagicTabs(panel);
        bindPanelChrome(panel);
        panel.querySelector("#pv-pronty-open-prev")?.addEventListener("click", () => {
          setMagicOpen(false);
          if (typeof window.__pvOpenPreventivo === "function") window.__pvOpenPreventivo();
        });
        return;
      }
      const { data } = await loadTrip();
      const trip = data.trip;
      magicTripCache = trip;
      const place = await geocodeDestination(trip.destination);
      const pois = distributeAcrossDays(await fetchPois(place.lat, place.lng), tripDays(trip));
      pendingPois = pois;
      const existing = new Set((trip.stops || []).map((s) => String(s.title || "").toLowerCase()));
      panel.innerHTML = `
        <div class="pv-panel-head pv-drag-handle">
          ${magicTabsHtml("idee")}
          <h3>${AI_NAME} · Idee per l’itinerario</h3>
          <p class="pv-lead">Proposte intorno a <strong>${escapeHtml(trip.destination)}</strong>. Scegli cosa aggiungere.</p>
        </div>
        <div class="pv-panel-body"><div id="pv-magic-list"></div></div>
        <div class="pv-panel-foot">
          <div class="pv-actions">
            <button type="button" class="primary" id="pv-magic-add">Aggiungi selezionati</button>
            <button type="button" class="ghost" id="pv-magic-close">Chiudi</button>
          </div>
          <p class="pv-status" id="pv-magic-status"></p>
        </div>
      `;
      bindMagicTabs(panel);
      bindPanelChrome(panel);
      const list = panel.querySelector("#pv-magic-list");
      pois.forEach((poi, idx) => {
        const already = existing.has(poi.title.toLowerCase());
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="checkbox" data-idx="${idx}" ${already ? "" : "checked"} ${already ? "disabled" : ""} />
          <span>
            <strong>${escapeHtml(poi.title)}</strong>
            <span class="pv-meta">${escapeHtml(placeKindMeta(poi.kind).label)} · Giorno ${poi.day || "da decidere"}${already ? " · già in itinerario" : ""}</span>
          </span>
        `;
        list.appendChild(label);
      });
      panel.querySelector("#pv-magic-close").onclick = () => {
        setMagicOpen(false);
      };
      panel.querySelector("#pv-magic-add").onclick = () => void addSelectedPois(panel);
    } catch (err) {
      panel.innerHTML = `
        <div class="pv-panel-head">${magicTabsHtml("idee")}<h3>Idee per l’itinerario</h3></div>
        <div class="pv-panel-body">
          <p class="pv-status">${escapeHtml(err instanceof Error ? err.message : "Errore")}</p>
          <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
        </div>
      `;
      bindMagicTabs(panel);
      panel.querySelector("#pv-magic-close").onclick = () => {
        setMagicOpen(false);
      };
    }
  }

  function parseChatIntent(text) {
    const q = String(text || "").toLowerCase();
    if (/mangiar|ristor|cibo|cena|pranzo|gourmet|tipic/.test(q)) {
      return {
        kind: "restaurant",
        category: "Cibo",
        labelSingular: "posto dove mangiare",
        labelPlural: "posti dove mangiare",
        query: "restaurant",
        osmTags: ["amenity:restaurant", "amenity:fast_food"],
      };
    }
    if (/caff|bar|aperitiv|birra|pub/.test(q)) {
      return {
        kind: "cafe",
        category: "Cibo",
        labelSingular: "caffè / bar",
        labelPlural: "caffè e bar",
        query: "cafe",
        osmTags: ["amenity:cafe", "amenity:bar", "amenity:pub"],
      };
    }
    if (/muse|galleri|cultur|storia|arte/.test(q)) {
      return {
        kind: "museum",
        category: "Visita",
        labelSingular: "museo",
        labelPlural: "musei e cultura",
        query: "museum",
        osmTags: ["tourism:museum", "tourism:gallery"],
      };
    }
    if (/natur|parco|escurs|trekking|cascata|spiaggia|viewpoint|panorama/.test(q)) {
      return {
        kind: "nature",
        category: "Natura",
        labelSingular: "luogo natura",
        labelPlural: "luoghi natura e panorami",
        query: "viewpoint",
        osmTags: ["tourism:viewpoint", "leisure:park", "natural:beach"],
      };
    }
    if (/shopping|negozi|mercato|souvenir/.test(q)) {
      return {
        kind: "shop",
        category: "Shopping",
        labelSingular: "posto shopping",
        labelPlural: "posti shopping",
        query: "market",
        osmTags: ["amenity:marketplace", "shop:mall"],
      };
    }
    if (/notte|locali|musica|divert/.test(q)) {
      return {
        kind: "cafe",
        category: "Serata",
        labelSingular: "locale serale",
        labelPlural: "locali serali",
        query: "nightlife",
        osmTags: ["amenity:bar", "amenity:pub", "amenity:nightclub"],
      };
    }
    if (/bambin|famigli|kids/.test(q)) {
      return {
        kind: "attraction",
        category: "Famiglia",
        labelSingular: "idea per famiglie",
        labelPlural: "idee per famiglie",
        query: "attraction",
        osmTags: ["tourism:attraction", "tourism:zoo", "leisure:playground"],
      };
    }
    const cleaned = q.replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
    return {
      kind: "attraction",
      category: "Visita",
      labelSingular: "suggerimento",
      labelPlural: "suggerimenti",
      query: cleaned.slice(0, 80) || "attraction",
      osmTags: ["tourism:attraction", "tourism:museum"],
    };
  }

  /** Map vague/EN destination labels to a usable city for place search. */
  function searchCityForDestination(destination, title = "") {
    const raw = String(destination || "").trim();
    const blob = `${raw} ${title}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/islanda|\bisland\b|iceland|reykjav/.test(blob)) return "Reykjavik";
    if (/norvegia|norway/.test(blob) && !/oslo|bergen/.test(blob)) return "Oslo";
    if (/svezia|sweden/.test(blob) && !/stoccolma|stockholm/.test(blob)) return "Stockholm";
    if (/danimarca|denmark/.test(blob) && !/copenhagen|copenaghen/.test(blob)) return "Copenhagen";
    if (/france|francia/.test(blob) && !/parigi|paris/.test(blob)) return "Paris";
    if (/spain|spagna/.test(blob) && !/madrid|barcellona|barcelona/.test(blob)) return "Madrid";
    if (/germania|germany/.test(blob) && !/berlin|monaco|munich/.test(blob)) return "Berlin";
    // Drop country-only first tokens that are too vague for Photon amenity search
    const first = raw.split(",")[0].trim();
    if (/^(island|ísland|iceland|norway|sweden|denmark|france|spain|germany|italy|italia)$/i.test(first)) {
      return searchCityForDestination(`${first} capital`, title) || first;
    }
    return first || raw;
  }

  function formatDestGreeting(destination, title = "") {
    const blob = `${destination || ""} ${title || ""}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/islanda|\bisland\b|iceland|reykjav/.test(blob)) return "in Islanda";
    if (/norvegia|norway/.test(blob)) return "in Norvegia";
    if (/svezia|sweden/.test(blob)) return "in Svezia";
    if (/danimarca|denmark/.test(blob)) return "in Danimarca";
    if (/france|francia/.test(blob)) return "in Francia";
    if (/spain|spagna/.test(blob)) return "in Spagna";
    if (/germania|germany/.test(blob)) return "in Germania";
    if (/giappone|japan/.test(blob)) return "in Giappone";
    if (/usa|stati uniti|new york/.test(blob)) return "negli Stati Uniti";
    if (/uk|inghilterra|london|londra/.test(blob)) return "nel Regno Unito";
    const d = String(destination || "").trim();
    if (!d) return "per la tua destinazione";
    // Cities usually take "a", countries often already handled above
    return `a ${d}`;
  }

  function intentResultLabel(intent, count) {
    if (count === 1) return intent.labelSingular || "risultato";
    return intent.labelPlural || intent.labelSingular || "risultati";
  }

  function isCountryLikePlace(props, name, destination) {
    const type = String(props.type || props.osm_value || "").toLowerCase();
    const osmKey = String(props.osm_key || "").toLowerCase();
    if (type === "country" || type === "continent" || type === "state" || type === "county") return true;
    if (osmKey === "place" && /country|state|continent/.test(String(props.osm_value || ""))) return true;
    const n = String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const dest = String(destination || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const countryAliases = [
      "island",
      "islanda",
      "iceland",
      "norvegia",
      "norway",
      "svezia",
      "sweden",
      "danimarca",
      "denmark",
      "francia",
      "france",
      "spagna",
      "spain",
      "germania",
      "germany",
      "italia",
      "italy",
    ];
    if (countryAliases.includes(n)) return true;
    if (dest && (n === dest || n === dest.split(",")[0].trim())) {
      if (countryAliases.some((a) => dest.includes(a))) return true;
    }
    return false;
  }

  function matchesIntentKind(props, intent, { loose = false } = {}) {
    if (!intent?.kind || intent.kind === "attraction") return true;
    const val = String(props.osm_value || props.type || "").toLowerCase();
    const key = String(props.osm_key || "").toLowerCase();
    const kind = intent.kind;
    if (kind === "restaurant") {
      if (key === "amenity" && /restaurant|fast_food|food_court/.test(val)) return true;
      if (loose && /restaurant|bistro|kitchen|grill|pizzeria|sushi|seafood/i.test(props.name || "")) return true;
      return false;
    }
    if (kind === "cafe") {
      if (key === "amenity" && /cafe|bar|pub|biergarten|nightclub/.test(val)) return true;
      if (loose && /cafe|café|coffee|bar|pub/i.test(props.name || "")) return true;
      return false;
    }
    if (kind === "museum") {
      return (key === "tourism" && /museum|gallery/.test(val)) || val === "museum" || (loose && /museum|museo|gallery/i.test(props.name || ""));
    }
    if (kind === "nature") {
      return /viewpoint|park|beach|waterfall|peak|nature/.test(val) || key === "natural" || key === "leisure";
    }
    if (kind === "shop") {
      return key === "shop" || /marketplace|mall|supermarket/.test(val);
    }
    return true;
  }

  async function fetchWikivoyagePlaces(city, intent) {
    const sectionKeys = {
      restaurant: ["Eat", "Mangiare", "Drink", "Bere", "Buy", "Comprare"],
      cafe: ["Drink", "Bere", "Eat", "Mangiare"],
      museum: ["See", "Vedere", "Do", "Fare"],
      nature: ["See", "Vedere", "Do", "Fare", "Understand"],
      shop: ["Buy", "Comprare", "Eat"],
      attraction: ["See", "Vedere", "Do", "Fare", "Eat", "Mangiare"],
    };
    const wanted = new Set((sectionKeys[intent.kind] || sectionKeys.attraction).map((s) => s.toLowerCase()));
    const hosts = ["en.wikivoyage.org", "it.wikivoyage.org"];
    const places = [];
    const seen = new Set();

    for (const host of hosts) {
      if (places.length >= 8) break;
      try {
        const search = await fetch(
          `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(city)}&srlimit=3&format=json&origin=*`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        const pageTitle = search?.query?.search?.[0]?.title;
        if (!pageTitle) continue;

        const parsed = await fetch(
          `https://${host}/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`,
          { signal: AbortSignal.timeout(12000) }
        ).then((r) => r.json());
        const wikitext = String(parsed?.parse?.wikitext?.["*"] || "");
        if (!wikitext) continue;

        // Split by == Section == headers
        const parts = wikitext.split(/\n==+\s*/);
        for (let i = 1; i < parts.length; i++) {
          const headerEnd = parts[i].search(/\s*==+/);
          const header = (headerEnd >= 0 ? parts[i].slice(0, headerEnd) : parts[i].slice(0, 40))
            .replace(/[\[\]']/g, "")
            .trim()
            .toLowerCase();
          if (![...wanted].some((w) => header.startsWith(w) || header.includes(w))) continue;
          const body = headerEnd >= 0 ? parts[i].slice(headerEnd) : parts[i];

          // {{eat|name=...}} / {{marker|name=...}} / '''[[Name]]''' / * [[Name]]
          const patterns = [
            /\{\{(?:eat|drink|see|do|buy|listing|marker)[^}]*\bname\s*=\s*([^}|]+)/gi,
            /\*\s*'{0,3}\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]'{0,3}/g,
            /\*\s*\*\*([^*\n]{3,60})\*\*/g,
          ];
          for (const re of patterns) {
            let m;
            while ((m = re.exec(body)) && places.length < 10) {
              let name = String(m[1] || "")
                .replace(/<\/?[^>]+>/g, "")
                .replace(/[{}]/g, "")
                .trim();
              if (name.length < 3 || name.length > 80) continue;
              if (/^(see|do|eat|drink|buy|list|file|image|wikipedia|commons)$/i.test(name)) continue;
              if (isCountryLikePlace({ type: "poi" }, name, city)) continue;
              const key = name.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              places.push({
                title: name.slice(0, 120),
                category: intent.category,
                kind: intent.kind === "restaurant" || intent.kind === "cafe" ? intent.kind : "wikivoyage",
                lat: null,
                lng: null,
                address: `${city} · Wikivoyage`,
                extract: `Consigliato su Wikivoyage (${pageTitle}), sezione “${header}”.`,
                notes: `Fonte: Wikivoyage — ${pageTitle}`,
                wikiUrl: `https://${host}/wiki/${encodeURIComponent(pageTitle)}`,
                source: "wikivoyage",
              });
            }
          }
        }
        if (places.length) break;
      } catch {
        /* try next host */
      }
    }
    return places;
  }

  function reliableWebSearches(city, intent, destination) {
    const qCity = city || destination || "";
    const topic =
      intent.kind === "restaurant"
        ? "restaurants"
        : intent.kind === "cafe"
          ? "cafes bars"
          : intent.kind === "museum"
            ? "museums"
            : intent.kind === "nature"
              ? "nature attractions"
              : intent.kind === "shop"
                ? "shopping"
                : "things to do";
    const topicIt =
      intent.kind === "restaurant"
        ? "ristoranti tipici"
        : intent.kind === "cafe"
          ? "caffè e bar"
          : intent.kind === "museum"
            ? "musei"
            : intent.kind === "nature"
              ? "natura e panorami"
              : "cose da fare";
    const enc = encodeURIComponent;
    return [
      {
        title: `${topicIt} su TripAdvisor`,
        category: intent.category,
        kind: "web",
        extract: `Risultati e recensioni su TripAdvisor per ${qCity}.`,
        address: "TripAdvisor",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(`${topicIt} ${qCity}`)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(`${topic} ${qCity}`)}`,
        wikiUrl: "",
        webOnly: true,
        notes: `Cerca su TripAdvisor: ${topicIt} ${qCity}`,
      },
      {
        title: `${topicIt} su Google Maps`,
        category: intent.category,
        kind: "web",
        extract: `Mappa e indicazioni per ${topicIt} a ${qCity}.`,
        address: "Google Maps",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(`${qCity}`)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(`${topic} near ${qCity}`)}`,
        wikiUrl: "",
        webOnly: true,
        notes: `Cerca su Google Maps: ${topic} ${qCity}`,
      },
      {
        title: `Guida Wikivoyage — ${qCity}`,
        category: intent.category,
        kind: "web",
        extract: "Guida di viaggio libera (Wikimedia): sezioni Eat / See / Do aggiornate dalla community.",
        address: "Wikivoyage",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(qCity)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(qCity)}`,
        wikiUrl: `https://en.wikivoyage.org/w/index.php?search=${enc(qCity)}`,
        webOnly: true,
        notes: `Wikivoyage: ${qCity}`,
      },
      {
        title: `Lonely Planet — ${qCity}`,
        category: intent.category,
        kind: "web",
        extract: `Articoli e consigli Lonely Planet su ${qCity}.`,
        address: "Lonely Planet",
        tripadvisorUrl: `https://www.tripadvisor.it/Search?q=${enc(qCity)}`,
        mapsUrl: `https://www.google.com/maps/search/${enc(qCity)}`,
        wikiUrl: `https://www.lonelyplanet.com/search?q=${enc(qCity)}`,
        webOnly: true,
        notes: `Lonely Planet: ${qCity}`,
      },
    ];
  }

  async function searchPlacesForIntent(destination, intent, lat, lng, title = "") {
    const city = searchCityForDestination(destination, title);
    const seen = new Set();
    const places = [];

    const pushFeature = (feature, { loose = false } = {}) => {
      const props = { ...(feature.properties || {}), name: feature.properties?.name };
      const name = props.name;
      if (!name) return;
      if (isCountryLikePlace(props, name, destination)) return;
      if (!matchesIntentKind(props, intent, { loose })) return;
      const key = String(name).toLowerCase();
      if (seen.has(key)) return;
      const coords = feature.geometry?.coordinates || [];
      const plng = Number(coords[0]);
      const plat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(plat)) {
        const dist = haversineKm({ lat, lng }, { lat: plat, lng: plng });
        if (dist != null && dist > 45) return;
      }
      seen.add(key);
      places.push({
        title: String(name).slice(0, 120),
        category: intent.category,
        kind: props.osm_value || props.type || intent.kind,
        lat: Number.isFinite(plat) ? plat : null,
        lng: Number.isFinite(plng) ? plng : null,
        address: [props.street, props.housenumber, props.city || props.town, props.country]
          .filter(Boolean)
          .join(", "),
        notes: "",
        source: "openstreetmap",
      });
    };

    // 1) Photon with OSM amenity tags + lat/lon bias (best for restaurants/cafes)
    const tags = intent.osmTags || [];
    for (const tag of tags) {
      if (places.length >= 8) break;
      try {
        const params = new URLSearchParams({
          q: `${intent.query} ${city}`,
          limit: "15",
          lang: "en",
          osm_tag: tag,
        });
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          params.set("lat", String(lat));
          params.set("lon", String(lng));
        }
        const photon = await fetch(`https://photon.komoot.io/api/?${params}`, {
          signal: AbortSignal.timeout(12000),
        }).then((r) => r.json());
        for (const feature of photon.features || []) {
          pushFeature(feature);
          if (places.length >= 8) break;
        }
      } catch {
        /* try next tag */
      }
    }

    // 2) Free-text Photon queries (still filtered)
    if (places.length < 4) {
      const queries = [
        `${intent.query} ${city}`,
        `best ${intent.query} in ${city}`,
        `traditional food ${city}`,
        city,
      ];
      for (const q of queries) {
        if (places.length >= 8) break;
        try {
          const params = new URLSearchParams({ q, limit: "15", lang: "en" });
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            params.set("lat", String(lat));
            params.set("lon", String(lng));
          }
          const photon = await fetch(`https://photon.komoot.io/api/?${params}`, {
            signal: AbortSignal.timeout(12000),
          }).then((r) => r.json());
          for (const feature of photon.features || []) {
            pushFeature(feature, { loose: places.length < 2 });
            if (places.length >= 8) break;
          }
        } catch {
          /* next */
        }
      }
    }

    // 3) Overpass via proxy
    if (places.length < 3 && Number.isFinite(lat)) {
      try {
        const res = await fetch(
          `/api/pois?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=8000&kind=${encodeURIComponent(intent.kind)}`,
          { signal: AbortSignal.timeout(20000) }
        );
        const data = await res.json().catch(() => ({}));
        for (const el of data.elements || []) {
          const name = el.tags?.name || el.tags?.["name:en"] || el.tags?.["name:it"];
          if (!name || seen.has(String(name).toLowerCase())) continue;
          if (
            isCountryLikePlace(
              { type: "node", osm_value: el.tags?.amenity || el.tags?.tourism },
              name,
              destination
            )
          ) {
            continue;
          }
          seen.add(String(name).toLowerCase());
          places.push({
            title: String(name).slice(0, 120),
            category: intent.category,
            kind: el.tags?.amenity || el.tags?.tourism || intent.kind,
            lat: el.lat ?? el.center?.lat ?? null,
            lng: el.lon ?? el.center?.lon ?? null,
            address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
            notes: "",
            source: "openstreetmap",
          });
          if (places.length >= 8) break;
        }
      } catch {
        /* ignore */
      }
    }

    // 4) Wikivoyage (reliable Wikimedia travel guide — Eat/See/Do…)
    if (places.length < 6) {
      try {
        const wikiPlaces = await fetchWikivoyagePlaces(city, intent);
        for (const wp of wikiPlaces) {
          const key = wp.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          places.push(wp);
          if (places.length >= 10) break;
        }
      } catch {
        /* ignore */
      }
    }

    // 5) Always append trusted web search shortcuts (TripAdvisor, Maps, Wikivoyage, Lonely Planet)
    const webLinks = reliableWebSearches(city, intent, destination);
    return { places, webLinks, city };
  }

  async function enrichWithWikipedia(places) {
    const out = [];
    const destHint = searchCityForDestination(
      magicTripCache?.destination || "",
      magicTripCache?.title || ""
    );
    for (const place of places.slice(0, 10)) {
      if (place.webOnly) {
        out.push(place);
        continue;
      }
      const enriched = {
        ...place,
        image: place.image || "",
        extract: place.extract || "",
        wikiUrl: place.wikiUrl || "",
      };
      if (!enriched.tripadvisorUrl) {
        enriched.tripadvisorUrl = `https://www.tripadvisor.it/Search?q=${encodeURIComponent(
          `${place.title} ${destHint || magicTripCache?.destination || ""}`
        )}`;
      }
      if (!enriched.mapsUrl) {
        enriched.mapsUrl =
          place.lat != null && place.lng != null
            ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${place.title} ${destHint}`
              )}`;
      }
      if (place.source === "wikivoyage" && enriched.extract) {
        if (!enriched.notes) {
          enriched.notes = [
            enriched.extract.slice(0, 400),
            enriched.tripadvisorUrl ? `TripAdvisor: ${enriched.tripadvisorUrl}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
        out.push(enriched);
        continue;
      }
      try {
        const wikiHosts = ["it.wikipedia.org", "en.wikipedia.org"];
        for (const host of wikiHosts) {
          let title = place.title;
          try {
            const searchQ =
              place.category === "Cibo" || /restaurant|cafe|bar|pub|fast_food/i.test(place.kind || "")
                ? `${place.title} ${destHint} restaurant`
                : `${place.title} ${destHint}`;
            const search = await fetch(
              `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
                searchQ
              )}&srlimit=3&format=json&origin=*`,
              { signal: AbortSignal.timeout(8000) }
            ).then((r) => r.json());
            const hits = search?.query?.search || [];
            const good = hits.find((h) => {
              const t = String(h.title || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/\p{M}/gu, "");
              if (/^(island|islanda|iceland|norway|sweden|france|spain|germany|italy)\b/.test(t)) {
                return false;
              }
              if (/disambigua|disambiguation/i.test(h.snippet || "")) return false;
              return true;
            });
            if (good?.title) title = good.title;
            else if (hits[0]?.title && !/^(island|islanda|iceland)\b/i.test(hits[0].title)) {
              title = hits[0].title;
            } else {
              continue;
            }
          } catch {
            /* keep original title */
          }
          if (isCountryLikePlace({ type: "country" }, title, magicTripCache?.destination)) {
            continue;
          }
          const data = await fetch(
            `https://${host}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|extracts|info&inprop=url&exintro=1&explaintext=1&pithumbsize=320&format=json&origin=*`,
            { signal: AbortSignal.timeout(10000) }
          ).then((r) => r.json());
          const page = Object.values(data?.query?.pages || {})[0];
          if (!page || page.missing != null) continue;
          const extract = String(page.extract || "");
          if (/è uno Stato|is a (Nordic )?country|Repubblica d'/i.test(extract.slice(0, 160))) {
            continue;
          }
          enriched.image = page.thumbnail?.source || enriched.image;
          enriched.extract = extract.slice(0, 280) || enriched.extract;
          enriched.wikiUrl =
            page.fullurl || enriched.wikiUrl || `https://${host}/wiki/${encodeURIComponent(title)}`;
          if (enriched.extract || enriched.image) break;
        }
      } catch {
        /* keep without wiki */
      }
      if (!enriched.notes) {
        enriched.notes = [
          enriched.extract
            ? enriched.extract.slice(0, 400)
            : `Suggerito dalla bacchetta (${enriched.kind})`,
          enriched.tripadvisorUrl ? `TripAdvisor: ${enriched.tripadvisorUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
      out.push(enriched);
    }
    return out;
  }

  function placeKindMeta(kindRaw) {
    const k = String(kindRaw || "").toLowerCase();
    if (k.includes("web") || k === "guide") return { label: "Guida", short: "Web" };
    if (/restaurant|ristor|food|fast_food/.test(k)) return { label: "Ristorante", short: "Food" };
    if (/cafe|caff|bar|pub|coffee/.test(k)) return { label: "Caffè", short: "Bar" };
    if (/museum|galleri|arte/.test(k)) return { label: "Museo", short: "Arte" };
    if (/nature|park|beach|viewpoint|natur/.test(k)) return { label: "Natura", short: "Out" };
    if (/shop|market|mall|shopping/.test(k)) return { label: "Shopping", short: "Shop" };
    if (/hotel|lodging|sleep/.test(k)) return { label: "Soggiorno", short: "Stay" };
    return { label: "Luogo", short: "POI" };
  }

  function renderPlaceCards(host, places, startIdx = 0) {
    host.innerHTML = "";
    if (places.length) {
      const title = document.createElement("div");
      title.className = "pv-results-title";
      title.textContent = "Posti consigliati";
      host.appendChild(title);
    }
    places.forEach((poi, i) => {
      const idx = startIdx + i;
      const card = document.createElement("div");
      card.className = "pv-place-card";
      const isWeb = Boolean(poi.webOnly);
      const meta = placeKindMeta(isWeb ? "web" : poi.kind || poi.category);
      const extract = poi.extract || poi.notes || poi.address || "";
      card.innerHTML = `
        ${
          poi.image
            ? `<img src="${escapeHtml(poi.image)}" alt="" loading="lazy" />`
            : `<div class="pv-ph" aria-hidden="true">${escapeHtml(meta.label)}</div>`
        }
        <div>
          <span class="pv-kind-tag">${escapeHtml(meta.label)}</span>
          <strong>${escapeHtml(poi.title)}</strong>
          <p class="pv-extract">${escapeHtml(extract || "Apri i link per dettagli e recensioni.")}</p>
          <div class="pv-card-actions">
            ${
              isWeb
                ? ""
                : `<button type="button" class="primary" data-add="${idx}">Aggiungi all’itinerario</button>`
            }
            ${
              poi.tripadvisorUrl
                ? `<a class="ghost" href="${escapeHtml(poi.tripadvisorUrl)}" target="_blank" rel="noopener noreferrer">TripAdvisor</a>`
                : ""
            }
            ${
              poi.mapsUrl
                ? `<a class="ghost" href="${escapeHtml(poi.mapsUrl)}" target="_blank" rel="noopener noreferrer">Mappe</a>`
                : ""
            }
            ${
              poi.wikiUrl
                ? `<a class="ghost" href="${escapeHtml(poi.wikiUrl)}" target="_blank" rel="noopener noreferrer">${
                    /wikivoyage|lonelyplanet/i.test(poi.wikiUrl) ? "Apri guida" : "Wiki"
                  }</a>`
                : ""
            }
          </div>
        </div>
      `;
      host.appendChild(card);
    });
    host.querySelectorAll("[data-add]").forEach((btn) => {
      btn.onclick = () => void addSinglePlace(Number(btn.dataset.add), btn);
    });
  }

  async function addSinglePlace(idx, btn) {
    const poi = chatPlaces[idx] || pendingPois[idx];
    if (!poi) return;
    if (poi.webOnly) {
      alert("Questo è un link di ricerca: aprilo con TripAdvisor / Mappe / guida.");
      return;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.stops)) trip.stops = [];
      const exists = trip.stops.some((s) => String(s.title || "").toLowerCase() === poi.title.toLowerCase());
      if (exists) {
        btn.textContent = "Già dentro";
        return;
      }
      const days = tripDays(trip);
      trip.stops.push({
        id: uid(),
        title: poi.title.slice(0, 120),
        day: days[trip.stops.length % Math.max(days.length, 1)] || "",
        time: "",
        category: poi.category || "Visita",
        address: (poi.address || "").slice(0, 300),
        notes: (poi.notes || "").slice(0, 3000),
        lat: poi.lat ?? null,
        lng: poi.lng ?? null,
      });
      await saveTrip(auth, trip, data.revision);
      btn.textContent = "Aggiunto ✓";
    } catch (err) {
      btn.disabled = false;
      btn.textContent = prev;
      alert(err instanceof Error ? err.message : "Non riuscito");
    }
  }

  async function renderChatTab(panel) {
    const dest = magicTripCache?.destination || "";
    const greetingWhere = dest
      ? formatDestGreeting(dest, magicTripCache?.title || "")
      : "per il tuo prossimo viaggio";
    const trip = magicTripCache;
    const days = trip && !trip._draftOnly ? tripDays(trip) : [];
    const duringTrip = Boolean(tripAuth());
    panel.innerHTML = `
      <div class="pv-panel-head pv-drag-handle">
        ${magicTabsHtml("chiedi")}
        <h3>${AI_NAME}</h3>
        <p class="pv-lead">La tua Bacchetta magica: AI del viaggio ${duringTrip ? "in corso" : "in preparazione"} — domande, idee e gestione pratica.</p>
        <div class="pv-chips" id="pv-chat-chips">
          <button type="button" data-q="Dove mangiare di tipico e buono?">Dove mangiare</button>
          <button type="button" data-q="Cosa non perdere in 2 giorni?">Cosa vedere</button>
          <button type="button" data-q="Idee per una giornata con natura e panorami">Natura</button>
          <button type="button" data-q="Consigli pratici per il viaggio (soldi, clima, trasporti)">Consigli</button>
          <button type="button" data-q="Come organizzare bagagli, budget e checklist prima di partire?">Prima di partire</button>
          <button type="button" data-q="Frasi utili e come comportarsi con la gente del posto">Lingua</button>
        </div>
      </div>
      <div class="pv-panel-body">
        <div class="pv-chat" id="pv-chat-log"></div>
        <div id="pv-chat-results"></div>
      </div>
      <div class="pv-panel-foot">
        <form class="pv-chat-form" id="pv-chat-form">
          <input type="text" id="pv-chat-input" placeholder="Scrivi a ${AI_NAME}… es. ristoranti ${escapeHtml(greetingWhere)}" autocomplete="off" />
          <button type="submit">Invia</button>
        </form>
        <div class="pv-actions">
          <button type="button" class="ghost" id="pv-chat-reset">Nuova chat</button>
          <button type="button" class="ghost" id="pv-magic-close">Chiudi</button>
        </div>
        <p class="pv-status" id="pv-chat-status"></p>
      </div>
    `;
    bindMagicTabs(panel);
    bindPanelChrome(panel);
    const log = panel.querySelector("#pv-chat-log");
    if (!chatHistory.length) {
      const phase = duringTrip
        ? "Sono con te durante il viaggio"
        : "Ti aiuto a preparare il viaggio (e resto con te anche dopo)";
      const hello = `Ciao! Sono ${AI_NAME}, la Bacchetta magica di Pronti? VIA!. ${phase} ${greetingWhere}${
        days.length ? ` (${days.length} giorni)` : ""
      }. Chiedimi posti, cibo, itinerari, budget, bagagli o consigli pratici.`;
      chatHistory = [{ role: "assistant", content: hello }];
    }
    for (const msg of chatHistory) {
      appendBubble(log, msg.role === "user" ? "user" : "bot", msg.content);
    }
    panel.querySelector("#pv-chat-reset").onclick = () => {
      chatHistory = [];
      chatPlaces = [];
      void renderChatTab(panel);
    };
    panel.querySelectorAll("#pv-chat-chips button").forEach((btn) => {
      btn.onclick = () => {
        const input = panel.querySelector("#pv-chat-input");
        if (input) input.value = "";
        void handleChatAsk(panel, btn.dataset.q);
      };
    });
    panel.querySelector("#pv-chat-form").onsubmit = (ev) => {
      ev.preventDefault();
      const input = panel.querySelector("#pv-chat-input");
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      void handleChatAsk(panel, text);
    };
  }

  function formatChatDisplay(text) {
    return String(text || "")
      .replace(/```pv-places[\s\S]*?```/gi, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function appendBubble(log, role, text) {
    const el = document.createElement("div");
    el.className = `pv-bubble ${role}`;
    el.textContent = formatChatDisplay(text);
    log.appendChild(el);
    const body = log.closest(".pv-panel-body");
    if (body) body.scrollTop = body.scrollHeight;
    else log.scrollTop = log.scrollHeight;
    return el;
  }

  function buildTravelSystemPrompt(trip) {
    const safeTrip = trip || { title: "", destination: "", start: "", end: "", members: [], stops: [] };
    const city = searchCityForDestination(safeTrip.destination, safeTrip.title);
    const where = safeTrip.destination
      ? formatDestGreeting(safeTrip.destination, safeTrip.title)
      : "un viaggio ancora da definire";
    const members = (safeTrip.members || []).map((m) => m.name).filter(Boolean).join(", ") || "viaggiatori";
    const stops = (safeTrip.stops || [])
      .slice(0, 12)
      .map((s) => s.title)
      .filter(Boolean)
      .join("; ");
    const phase = tripAuth()
      ? "Il viaggio è aperto: aiuta sia nella gestione pratica di oggi sia nei piani delle prossime giornate."
      : "Siamo in fase di preparazione: aiuta a pianificare, preventivare e organizzarsi prima della partenza.";
    return `Sei ${AI_NAME}, la Bacchetta magica di Pronti? VIA! — un companion AI di viaggio simpatico e concreto.
Rispondi SEMPRE in italiano, come una chat: tono cordiale, chiaro, concreto. Usa 2–6 frasi (o elenchi brevi), niente markdown pesante.
${phase}
Contesto viaggio:
- Titolo: ${safeTrip.title || "—"}
- Destinazione: ${safeTrip.destination || city || "da scegliere"} (${where})
- Città di riferimento: ${city || "—"}
- Date: ${safeTrip.start || "?"} → ${safeTrip.end || "?"}
- Compagni: ${members}
- Tappe già in itinerario: ${stops || "nessuna ancora"}

Compiti:
1) Rispondi a domande su luoghi, cibo, natura, trasporti, budget, clima, cultura, lingua, itinerari, bagagli e organizzazione.
2) Tieni conto del contesto del viaggio e dei messaggi precedenti (multi-turno).
3) Se suggerisci posti concreti da aggiungere all'itinerario, alla FINE della risposta aggiungi ESATTAMENTE un blocco:

\`\`\`pv-places
[{"title":"Nome posto","kind":"restaurant|cafe|museum|nature|attraction|shop","why":"perché consigliarlo"}]
\`\`\`

Regole pv-places:
- Massimo 5 posti, nomi reali e specifici della zona (non il paese intero, non "Ísland"/"Iceland").
- kind obbligatorio tra quelli elencati.
- Se la domanda NON chiede luoghi da aggiungere, NON mettere il blocco pv-places.
- Non inventare indirizzi; spiega in linguaggio naturale e lascia il JSON solo nel fence.`;
  }

  function parseAiPlaceBlock(text) {
    const m = String(text || "").match(/```pv-places\s*([\s\S]*?)```/i);
    if (!m) return { reply: String(text || "").trim(), places: [] };
    let places = [];
    try {
      const raw = JSON.parse(m[1].trim());
      if (Array.isArray(raw)) {
        places = raw
          .map((p) => ({
            title: String(p.title || p.name || "").trim().slice(0, 120),
            kind: String(p.kind || "attraction").toLowerCase(),
            why: String(p.why || p.reason || "").trim().slice(0, 200),
          }))
          .filter((p) => p.title && !isCountryLikePlace({ type: "poi" }, p.title, ""));
      }
    } catch {
      places = [];
    }
    const reply = String(text || "")
      .replace(/```pv-places[\s\S]*?```/gi, "")
      .trim();
    return { reply, places };
  }

  function isAiProviderError(text) {
    const t = String(text || "");
    return /not enough credits|raise the key budget|top up|pollinations\.ai\/(?:top-up|quests|edit-key)|API key|queue full|rate limit|budget|deprecation_notice|enter\.pollinations/i.test(
      t
    );
  }

  function destinationCostBand(destination, title = "") {
    const blob = `${destination} ${title}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/island|iceland|reykjav|norveg|norway|svizz|swiss|giapp|japan/.test(blob)) {
      return {
        label: "destinazione cara",
        foodDay: [45, 80],
        localTransportDay: [15, 45],
        activitiesDay: [20, 55],
        note: "Qui cibo e attività costano di più che in media UE.",
      };
    }
    if (/uk|londra|london|francia|paris|parigi|danimarca|copenhagen/.test(blob)) {
      return {
        label: "destinazione medio-cara",
        foodDay: [35, 65],
        localTransportDay: [10, 30],
        activitiesDay: [15, 40],
        note: "Prezzi urbani medio-alti.",
      };
    }
    if (/spagna|spain|portogallo|grecia|greece|croazia|polonia|turchia/.test(blob)) {
      return {
        label: "destinazione più accessibile",
        foodDay: [25, 45],
        localTransportDay: [6, 20],
        activitiesDay: [10, 30],
        note: "In generale più conveniente.",
      };
    }
    return {
      label: "destinazione media UE",
      foodDay: [30, 55],
      localTransportDay: [8, 25],
      activitiesDay: [12, 35],
      note: "Stima media europea.",
    };
  }

  function parseEuroMentions(text) {
    const out = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(?:€|euro|eur)\b/gi;
    let m;
    while ((m = re.exec(String(text || "")))) {
      const n = Number(String(m[1]).replace(",", "."));
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  function parseTripDaysFromText(text, trip) {
    const m = String(text || "").match(/(\d+)\s*giorn/i);
    if (m) return Math.max(1, Math.min(60, Number(m[1])));
    const days = tripDays(trip);
    if (days.length) return days.length;
    if (trip?.start && trip?.end) {
      const a = Date.parse(trip.start);
      const b = Date.parse(trip.end);
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        return Math.max(1, Math.round((b - a) / 86400000) + 1);
      }
    }
    return 7;
  }

  function localBudgetAdvice(trip, text) {
    const days = parseTripDaysFromText(text, trip);
    const euros = parseEuroMentions(text);
    const flight = /aereo|volo|andata e ritorno|bigliett/i.test(text) ? euros[0] || 0 : 0;
    const excludeHousing = /togliendo la casa|senza (casa|alloggio|hotel|Airbnb)|escludendo (casa|alloggio)/i.test(
      text
    );
    const band = destinationCostBand(trip.destination, trip.title);
    const foodLo = band.foodDay[0] * days;
    const foodHi = band.foodDay[1] * days;
    const trLo = band.localTransportDay[0] * days;
    const trHi = band.localTransportDay[1] * days;
    const actLo = band.activitiesDay[0] * days;
    const actHi = band.activitiesDay[1] * days;
    const onSiteLo = foodLo + trLo + actLo;
    const onSiteHi = foodHi + trHi + actHi;
    const totalLo = Math.round(onSiteLo + flight);
    const totalHi = Math.round(onSiteHi + flight);
    const where = formatDestGreeting(trip.destination, trip.title);
    const fmt = (n) =>
      n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    let reply = `Per ${days} giorni ${where}, ${excludeHousing ? "senza alloggio" : "escluso solo ciò che hai indicato"}:\n\n`;
    reply += `• Cibo: circa ${fmt(foodLo)}–${fmt(foodHi)}\n`;
    reply += `• Spostamenti locali: circa ${fmt(trLo)}–${fmt(trHi)}\n`;
    reply += `• Attività / ingressi: circa ${fmt(actLo)}–${fmt(actHi)}\n`;
    if (flight) reply += `• Volo (come hai detto): ${fmt(flight)}\n`;
    reply += `\nTotale orientativo: ${fmt(totalLo)}–${fmt(totalHi)}`;
    if (excludeHousing) reply += ` (senza casa/hotel)`;
    reply += `.\n\n${band.note} È una stima: se noleggi auto o fai tour lunghi, punta verso il massimo.`;
    return reply;
  }

  function localTravelReply(trip, text) {
    const q = String(text || "").trim();
    if (!q) return "";
    if (/spesa|budget|cost|quanto\b|euro|€|prezzi|econom/i.test(q)) {
      return localBudgetAdvice(trip, q);
    }
    if (/consigli pratic|clima|soldi|valut|trasport|sim|presa|adattator|assicura/i.test(q)) {
      const where = formatDestGreeting(trip.destination, trip.title);
      const band = destinationCostBand(trip.destination, trip.title);
      return `Consigli pratici ${where}:\n\n• Controlla clima e strati: meglio vestiti a cipolla.\n• Pagamenti: carte ok nelle città; tieni un po’ di contanti per imprevisti.\n• Trasporti: valuta bus/navette vs noleggio in base alle distanze.\n• Budget quotidiano tipico (cibo+spostamenti+attività): circa ${band.foodDay[0] + band.localTransportDay[0] + band.activitiesDay[0]}–${band.foodDay[1] + band.localTransportDay[1] + band.activitiesDay[1]} € a persona.\n\nSe vuoi, dimmi quanti giorni siete e cosa avete già pagato: ti faccio una stima più stretta.`;
    }
    if (/fras|lingua|salutare|grazie|per favore|parl/i.test(q)) {
      return `Per la lingua sul posto ti consiglio l’inglese turistico nelle città, più 5–6 frasi locali (ciao, grazie, scusa, il conto). Apri il tab Lingua qui nella bacchetta per frasario e traduzione simultanea.`;
    }
    if (/itinerar|giornata|cosa fare|programma|2 giorni|3 giorni/i.test(q)) {
      const where = formatDestGreeting(trip.destination, trip.title);
      return `Idea di giornata ${where}: mattina un’attrazione principale, pranzo tipico in centro, pomeriggio natura o museo, sera passeggiata e cena. Dimmi quanti giorni avete e se preferite cibo, natura o cultura: ti preparo una scaletta più precisa (e posti da aggiungere).`;
    }
    return "";
  }

  async function askTravelAI(trip, history) {
    const messages = [
      { role: "system", content: buildTravelSystemPrompt(trip) },
      ...history.slice(-14).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
    ];
    const models = ["openai", "openai-fast"];
    const endpoints = [];
    for (const model of models) {
      endpoints.push({
        url: "https://text.pollinations.ai/openai",
        body: { model, messages, temperature: 0.65 },
        parse: async (res) => {
          const data = await res.json().catch(() => ({}));
          const err =
            data?.error?.message ||
            (typeof data?.error === "string" ? data.error : "") ||
            data?.status ||
            data?.deprecation_notice ||
            "";
          if (err && isAiProviderError(String(err))) return "";
          const content = data?.choices?.[0]?.message?.content || data?.content || "";
          return content;
        },
      });
    }
    endpoints.push({
      url: "https://text.pollinations.ai/",
      body: { model: "openai", messages, temperature: 0.65 },
      parse: async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("json")) {
          const data = await res.json().catch(() => ({}));
          const err = data?.error?.message || data?.error || "";
          if (err && isAiProviderError(String(err))) return "";
          return data?.choices?.[0]?.message?.content || data?.content || "";
        }
        return await res.text();
      },
    });

    let lastErr = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(ep.body),
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`AI ${res.status}`);
        const content = String((await ep.parse(res)) || "").trim();
        if (!content || content.length < 8) continue;
        if (isAiProviderError(content)) continue;
        return content;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Assistente non disponibile");
  }

  async function resolveAiPlaces(aiPlaces, destination, title, lat, lng) {
    const city = searchCityForDestination(destination, title);
    const out = [];
    const seen = new Set();
    for (const ap of aiPlaces.slice(0, 5)) {
      const key = ap.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let hit = {
        title: ap.title,
        category:
          ap.kind === "restaurant" || ap.kind === "cafe"
            ? "Cibo"
            : ap.kind === "nature"
              ? "Natura"
              : ap.kind === "shop"
                ? "Shopping"
                : "Visita",
        kind: ap.kind || "attraction",
        lat: null,
        lng: null,
        address: "",
        extract: ap.why || "",
        notes: ap.why ? `Consigliato dall'AI: ${ap.why}` : "Consigliato dall'AI",
        source: "ai",
      };
      try {
        const params = new URLSearchParams({
          q: `${ap.title} ${city}`,
          limit: "5",
          lang: "en",
        });
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          params.set("lat", String(lat));
          params.set("lon", String(lng));
        }
        const photon = await fetch(`https://photon.komoot.io/api/?${params}`, {
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json());
        for (const feature of photon.features || []) {
          const props = feature.properties || {};
          const name = props.name;
          if (!name) continue;
          if (isCountryLikePlace(props, name, destination)) continue;
          const coords = feature.geometry?.coordinates || [];
          const plng = Number(coords[0]);
          const plat = Number(coords[1]);
          if (Number.isFinite(lat) && Number.isFinite(plat)) {
            const dist = haversineKm({ lat, lng }, { lat: plat, lng: plng });
            if (dist != null && dist > 60) continue;
          }
          hit = {
            ...hit,
            title: String(name).slice(0, 120),
            lat: Number.isFinite(plat) ? plat : null,
            lng: Number.isFinite(plng) ? plng : null,
            address: [props.street, props.housenumber, props.city || props.town, props.country]
              .filter(Boolean)
              .join(", "),
            kind: props.osm_value || hit.kind,
          };
          break;
        }
      } catch {
        /* keep AI title */
      }
      hit.tripadvisorUrl = `https://www.tripadvisor.it/Search?q=${encodeURIComponent(`${hit.title} ${city}`)}`;
      hit.mapsUrl =
        hit.lat != null && hit.lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${hit.lat},${hit.lng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hit.title} ${city}`)}`;
      out.push(hit);
    }
    return out;
  }

  let chatAskBusy = false;

  async function handleChatAsk(panel, text) {
    if (chatAskBusy) return;
    const log = panel.querySelector("#pv-chat-log");
    const results = panel.querySelector("#pv-chat-results");
    const status = panel.querySelector("#pv-chat-status");
    const input = panel.querySelector("#pv-chat-input");
    const form = panel.querySelector("#pv-chat-form");
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (input) input.value = "";
    chatAskBusy = true;
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    appendBubble(log, "user", text);
    chatHistory.push({ role: "user", content: text });
    const thinking = appendBubble(log, "bot", "Sto pensando…");
    status.textContent = "Assistente AI in corso…";
    results.innerHTML = "";
    try {
      let trip = magicTripCache;
      if (!trip && tripAuth()) {
        try {
          trip = (await loadTrip()).data.trip;
        } catch {
          trip = null;
        }
      }
      if (!trip) {
        const draft = readPreventivoDraft();
        trip = {
          title: draft?.title || "",
          destination: draft?.destination || "",
          start: draft?.start || "",
          end: draft?.end || "",
          members: [],
          stops: [],
          _draftOnly: true,
        };
      }
      magicTripCache = trip;
      const cityHint = searchCityForDestination(trip.destination, trip.title);
      let aiText = "";
      let usedLocal = false;
      let reply = "";
      let aiPlaces = [];
      const preferLocal = /spesa|budget|cost|quanto\b|euro|€|prezzi|econom|consigli pratic/i.test(text);
      const localPrefetch = preferLocal ? localTravelReply(trip, text) : "";

      if (localPrefetch) {
        // Budget/practical answers: respond immediately with local estimate.
        // Cloud AI is often rate-limited and was surfacing credit errors raw.
        reply = localPrefetch;
        usedLocal = true;
        chatHistory.push({ role: "assistant", content: localPrefetch });
      } else {
        try {
          aiText = await askTravelAI(trip, chatHistory);
        } catch {
          aiText = "";
        }
        if (aiText && isAiProviderError(aiText)) aiText = "";

        if (aiText) {
          ({ reply, places: aiPlaces } = parseAiPlaceBlock(aiText));
          chatHistory.push({ role: "assistant", content: aiText });
        } else {
          const local = localTravelReply(trip, text);
          if (local) {
            reply = local;
            usedLocal = true;
            chatHistory.push({ role: "assistant", content: local });
          }
        }
      }

      // Geocode only when we need place cards / map enrichment
      let place = { lat: null, lng: null };
      const intent = parseChatIntent(text);
      const placeAsk =
        /mangiar|ristor|cibo|cena|pranzo|muse|natur|vedere|visit|caff|bar|dove|posto|itinerar|tappa|attraz|cosa non perdere|cosa vedere/i.test(
          text
        );
      if ((aiPlaces.length || (!aiText && placeAsk)) && !usedLocal) {
        try {
          place = await geocodeDestination(
            /^(island|ísland|iceland)$/i.test(String(trip.destination || "").trim())
              ? cityHint
              : trip.destination || cityHint
          );
        } catch {
          /* continue without coords */
        }
      }

      let cards = [];
      if (aiPlaces.length) {
        status.textContent = "Verifico i posti sulle mappe…";
        cards = await resolveAiPlaces(aiPlaces, trip.destination, trip.title, place.lat, place.lng);
        cards = await enrichWithWikipedia(cards);
      } else if (!aiText && placeAsk) {
        status.textContent = "Integro con mappe e guide…";
        const found = await searchPlacesForIntent(
          trip.destination,
          intent,
          place.lat,
          place.lng,
          trip.title
        );
        let places = Array.isArray(found) ? found : found.places || [];
        const webFallback = Array.isArray(found) ? [] : found.webLinks || [];
        places = distributeAcrossDays(places, tripDays(trip));
        places = await enrichWithWikipedia(places.filter((p) => !p.webOnly));
        cards = [...places, ...webFallback];
        if (!reply) {
          reply = places.length
            ? `Ecco ${places.length} ${intentResultLabel(intent, places.length)} che ho trovato per te. Puoi aggiungerli all’itinerario o aprirli sulle guide.`
            : `Al momento l’assistente online è al limite: ti lascio i link alle guide affidabili qui sotto.`;
        }
      }

      if (!reply) {
        reply =
          "Dimmi pure cosa ti serve: ristoranti, musei, natura, budget/giornata o consigli pratici. Se l’AI cloud è satura, ti rispondo comunque con stime e guide locali.";
      }

      thinking.textContent = formatChatDisplay(reply);
      if (!aiText && !usedLocal) chatHistory.push({ role: "assistant", content: reply });

      const showWeb = aiPlaces.length > 0 || (!aiText && placeAsk) || cards.some((c) => c.webOnly);
      const webLinks = showWeb ? reliableWebSearches(cityHint, intent, trip.destination) : [];
      const combined = [...cards.filter((c) => !c.webOnly), ...webLinks];
      chatPlaces = combined;
      if (combined.length) renderPlaceCards(results, combined);
      else results.innerHTML = "";
      status.textContent = aiText
        ? aiPlaces.length
          ? "Risposta AI · posti pronti da aggiungere"
          : "Risposta AI"
        : usedLocal
          ? "Stima locale · AI cloud temporaneamente al limite"
          : "Modalità guide (AI cloud temporaneamente al limite)";
    } catch (err) {
      thinking.textContent = err instanceof Error ? err.message : "Qualcosa è andato storto.";
      status.textContent = "";
    } finally {
      chatAskBusy = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function addSelectedPois(panel) {
    const status = panel.querySelector("#pv-magic-status");
    const checked = [...panel.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')].map((el) =>
      Number(el.dataset.idx)
    );
    if (!checked.length) {
      status.textContent = "Seleziona almeno un luogo.";
      return;
    }
    status.textContent = "Aggiungo i luoghi al viaggio…";
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.stops)) trip.stops = [];
      const before = trip.stops.length;
      const existing = new Set(trip.stops.map((s) => String(s.title || "").toLowerCase()));
      for (const idx of checked) {
        const poi = pendingPois[idx];
        if (!poi || existing.has(poi.title.toLowerCase())) continue;
        trip.stops.push({
          id: uid(),
          title: poi.title.slice(0, 120),
          day: poi.day || "",
          time: "",
          category: poi.category || "Visita",
          address: (poi.address || "").slice(0, 300),
          notes: (poi.notes || "").slice(0, 3000),
          lat: poi.lat ?? null,
          lng: poi.lng ?? null,
        });
        existing.add(poi.title.toLowerCase());
      }
      const added = trip.stops.length - before;
      if (!added) {
        status.textContent = "Nessun nuovo luogo da aggiungere.";
        return;
      }
      await saveTrip(auth, trip, data.revision);
      const verify = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
        headers: { Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      });
      const verified = await verify.json().catch(() => ({}));
      const count = Array.isArray(verified?.trip?.stops) ? verified.trip.stops.length : trip.stops.length;
      status.textContent = `Aggiunti ${added} luoghi (ora ${count} in itinerario). Aggiorno…`;
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Salvataggio non riuscito";
    }
  }

  const PHRASEBOOK = {
    en: [
      ["Hello", "Ciao"],
      ["Thank you", "Grazie"],
      ["Please", "Per favore"],
      ["How much is it?", "Quanto costa?"],
      ["Where is the bathroom?", "Dov’è il bagno?"],
      ["I would like…", "Vorrei…"],
      ["Do you speak English?", "Parli inglese?"],
      ["Help!", "Aiuto!"],
      ["The bill, please", "Il conto, per favore"],
      ["Where is…?", "Dove si trova…?"],
    ],
    is: [
      ["Halló", "Ciao"],
      ["Takk", "Grazie"],
      ["Afsakið", "Scusa / Permesso"],
      ["Hvað kostar þetta?", "Quanto costa?"],
      ["Hvar er salernið?", "Dov’è il bagno?"],
      ["Ég ætla að fá…", "Vorrei…"],
      ["Talarðu ensku?", "Parli inglese?"],
      ["Hjálp!", "Aiuto!"],
      ["Reikninginn, takk", "Il conto, per favore"],
      ["Hvar er…?", "Dove si trova…?"],
    ],
    fr: [
      ["Bonjour", "Ciao / Buongiorno"],
      ["Merci", "Grazie"],
      ["S’il vous plaît", "Per favore"],
      ["Ça coûte combien ?", "Quanto costa?"],
      ["Où sont les toilettes ?", "Dov’è il bagno?"],
      ["Je voudrais…", "Vorrei…"],
      ["Parlez-vous anglais ?", "Parli inglese?"],
      ["Au secours !", "Aiuto!"],
      ["L’addition, s’il vous plaît", "Il conto, per favore"],
      ["Où est… ?", "Dove si trova…?"],
    ],
    de: [
      ["Hallo", "Ciao"],
      ["Danke", "Grazie"],
      ["Bitte", "Per favore"],
      ["Was kostet das?", "Quanto costa?"],
      ["Wo ist die Toilette?", "Dov’è il bagno?"],
      ["Ich hätte gern…", "Vorrei…"],
      ["Sprechen Sie Englisch?", "Parli inglese?"],
      ["Hilfe!", "Aiuto!"],
      ["Die Rechnung, bitte", "Il conto, per favore"],
      ["Wo ist…?", "Dove si trova…?"],
    ],
    es: [
      ["Hola", "Ciao"],
      ["Gracias", "Grazie"],
      ["Por favor", "Per favore"],
      ["¿Cuánto cuesta?", "Quanto costa?"],
      ["¿Dónde está el baño?", "Dov’è il bagno?"],
      ["Quisiera…", "Vorrei…"],
      ["¿Habla inglés?", "Parli inglese?"],
      ["¡Ayuda!", "Aiuto!"],
      ["La cuenta, por favor", "Il conto, per favore"],
      ["¿Dónde está…?", "Dove si trova…?"],
    ],
    pt: [
      ["Olá", "Ciao"],
      ["Obrigado / Obrigada", "Grazie"],
      ["Por favor", "Per favore"],
      ["Quanto custa?", "Quanto costa?"],
      ["Onde fica o banheiro?", "Dov’è il bagno?"],
      ["Eu gostaria de…", "Vorrei…"],
      ["Fala inglês?", "Parli inglese?"],
      ["Socorro!", "Aiuto!"],
      ["A conta, por favor", "Il conto, per favore"],
      ["Onde fica…?", "Dove si trova…?"],
    ],
    ja: [
      ["こんにちは (Konnichiwa)", "Ciao"],
      ["ありがとう (Arigatō)", "Grazie"],
      ["お願いします (Onegaishimasu)", "Per favore"],
      ["いくらですか (Ikura desu ka?)", "Quanto costa?"],
      ["トイレはどこですか", "Dov’è il bagno?"],
      ["…をお願いします", "Vorrei…"],
      ["英語を話せますか", "Parli inglese?"],
      ["助けて！", "Aiuto!"],
      ["お会計お願いします", "Il conto, per favore"],
      ["…はどこですか", "Dove si trova…?"],
    ],
  };

  function languageForDestination(destination) {
    const q = String(destination || "").toLowerCase();
    const rules = [
      { re: /islanda|\bisland\b|iceland|reykjav/, code: "is", name: "Islandese", pair: "it|is" },
      { re: /regno unito|uk|inghilterra|scozia|london|londra|ireland|irlanda|usa|stati uniti|canada|australia/, code: "en", name: "Inglese", pair: "it|en" },
      { re: /france|francia|parigi|paris/, code: "fr", name: "Francese", pair: "it|fr" },
      { re: /germania|germany|berlin|monaco|österreich|austria|svizzera|switzerland/, code: "de", name: "Tedesco", pair: "it|de" },
      { re: /spain|spagna|madrid|barcellona|mexico|messico/, code: "es", name: "Spagnolo", pair: "it|es" },
      { re: /portugal|portogallo|lisbona|brasile|brazil/, code: "pt", name: "Portoghese", pair: "it|pt" },
      { re: /giappone|japan|tokyo|osaka|kyoto/, code: "ja", name: "Giapponese", pair: "it|ja" },
      { re: /norvegia|norway/, code: "en", name: "Norvegese (base EN)", pair: "it|no" },
      { re: /svezia|sweden/, code: "en", name: "Svedese (base EN)", pair: "it|sv" },
      { re: /danimarca|denmark/, code: "en", name: "Danese (base EN)", pair: "it|da" },
      { re: /olanda|netherlands|amsterdam/, code: "en", name: "Olandese (base EN)", pair: "it|nl" },
      { re: /grecia|greece|athen/, code: "en", name: "Greco (base EN)", pair: "it|el" },
      { re: /turchia|turkey|istanbul/, code: "en", name: "Turco (base EN)", pair: "it|tr" },
      { re: /polonia|poland/, code: "en", name: "Polacco (base EN)", pair: "it|pl" },
      { re: /italia|rome|roma|milan|firenze/, code: "en", name: "Italiano (sei a casa)", pair: "it|en" },
    ];
    for (const rule of rules) {
      if (rule.re.test(q)) return rule;
    }
    return { code: "en", name: "Inglese", pair: "it|en" };
  }

  async function translateText(text, langpair) {
    const q = String(text || "").trim();
    if (!q) return "";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=${encodeURIComponent(langpair)}`;
    const data = await fetch(url, { signal: AbortSignal.timeout(12000) }).then((r) => r.json());
    const out = data?.responseData?.translatedText;
    if (!out || /INVALID|QUERY LENGTH/i.test(out)) throw new Error("Traduzione non disponibile");
    return out;
  }

  async function renderLanguageTab(panel) {
    let trip = magicTripCache;
    if (!trip && tripAuth()) {
      try {
        trip = (await loadTrip()).data.trip;
      } catch {
        trip = null;
      }
    }
    if (!trip) {
      const draft = readPreventivoDraft();
      trip = {
        destination: draft?.destination || "la destinazione",
        title: draft?.title || "",
        _draftOnly: true,
      };
    }
    magicTripCache = { ...(magicTripCache || {}), ...trip };
    const lang = languageForDestination(trip.destination);
    const phrases = PHRASEBOOK[lang.code] || PHRASEBOOK.en;
    const [src, dst] = lang.pair.split("|");

    panel.innerHTML = `
      <div class="pv-panel-head pv-drag-handle">
        ${magicTabsHtml("lingua")}
        <h3>${AI_NAME} · Lingua</h3>
        <p class="pv-lead">Basi per <strong>${escapeHtml(trip.destination || "il viaggio")}</strong> · ${escapeHtml(lang.name)}. Frasi utili + traduzione.</p>
      </div>
      <div class="pv-panel-body">
        <div id="pv-phrases"></div>
        <p style="margin:14px 0 8px;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d676e">Traduzione simultanea</p>
        <div class="pv-lang-pair">
          <label>Italiano
            <textarea id="pv-tr-it" placeholder="Scrivi in italiano…"></textarea>
          </label>
          <label>${escapeHtml(lang.name)} (${escapeHtml(dst.toUpperCase())})
            <textarea id="pv-tr-local" placeholder="Traduzione in tempo reale…"></textarea>
          </label>
        </div>
        <p class="pv-status" id="pv-tr-status">Digita sopra: traduco in entrambe le direzioni.</p>
      </div>
      <div class="pv-panel-foot">
        <div class="pv-actions"><button type="button" class="ghost" id="pv-magic-close">Chiudi</button></div>
      </div>
    `;
    bindMagicTabs(panel);
    bindPanelChrome(panel);
    const phraseHost = panel.querySelector("#pv-phrases");
    for (const [local, it] of phrases) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-phrase";
      btn.innerHTML = `<strong>${escapeHtml(local)}</strong><span>${escapeHtml(it)}</span>`;
      btn.onclick = () => {
        panel.querySelector("#pv-tr-local").value = local;
        panel.querySelector("#pv-tr-it").value = it;
        panel.querySelector("#pv-tr-status").textContent = "Frase pronta · puoi modificarla e ritradurre.";
      };
      phraseHost.appendChild(btn);
    }

    let tIt = 0;
    let tLocal = 0;
    const itBox = panel.querySelector("#pv-tr-it");
    const localBox = panel.querySelector("#pv-tr-local");
    const status = panel.querySelector("#pv-tr-status");

    itBox.addEventListener("input", () => {
      clearTimeout(tIt);
      tIt = setTimeout(async () => {
        const text = itBox.value.trim();
        if (!text) return;
        status.textContent = "Traduco…";
        try {
          localBox.value = await translateText(text, `${src}|${dst}`);
          status.textContent = "Aggiornato";
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : "Errore traduzione";
        }
      }, 450);
    });

    localBox.addEventListener("input", () => {
      clearTimeout(tLocal);
      tLocal = setTimeout(async () => {
        const text = localBox.value.trim();
        if (!text) return;
        status.textContent = "Traduco…";
        try {
          itBox.value = await translateText(text, `${dst}|${src}`);
          status.textContent = "Aggiornato";
        } catch (err) {
          status.textContent = err instanceof Error ? err.message : "Errore traduzione";
        }
      }, 450);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectPackingTemplates() {
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /cose da portare/i.test(el.textContent || "")
    );
    if (!heading) return;
    const host = heading.closest(".section-heading")?.parentElement || heading.parentElement;
    if (!host || host.querySelector(".pv-extras-bar")) return;
    const bar = document.createElement("div");
    bar.className = "pv-extras-bar";
    bar.innerHTML = `<span style="width:100%;font-size:.8rem;color:#5b7076;margin-bottom:2px">Template valigia</span>`;
    for (const name of Object.keys(PACKING_TEMPLATES)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      btn.onclick = () => void applyPackingTemplate(name);
      bar.appendChild(btn);
    }
    const progress = host.querySelector(".packing-progress");
    if (progress) host.insertBefore(bar, progress);
    else host.appendChild(bar);
  }

  async function applyPackingTemplate(name) {
    try {
      const { auth, data } = await loadTrip();
      const trip = structuredClone(data.trip);
      if (!Array.isArray(trip.checklist)) trip.checklist = [];
      const existing = new Set(trip.checklist.map((c) => String(c.title || "").toLowerCase()));
      for (const title of PACKING_TEMPLATES[name] || []) {
        if (existing.has(title.toLowerCase())) continue;
        trip.checklist.push({ id: uid(), title, done: false });
      }
      await saveTrip(auth, trip, data.revision);
      location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Non riesco ad applicare il template");
    }
  }

  function readPrivateBudgetCents(tripId) {
    if (!tripId) return null;
    try {
      const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
      const user = String(session?.user?.username || "anon")
        .trim()
        .toLowerCase() || "anon";
      const db = JSON.parse(localStorage.getItem("viavia-private-budget-v1") || "{}");
      const v = db[`${user}::${tripId}`];
      return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    } catch {
      return null;
    }
  }

  function writePrivateBudgetCents(tripId, cents) {
    const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
    const user = String(session?.user?.username || "anon")
      .trim()
      .toLowerCase() || "anon";
    const db = JSON.parse(localStorage.getItem("viavia-private-budget-v1") || "{}");
    db[`${user}::${tripId}`] = Math.round(cents);
    localStorage.setItem("viavia-private-budget-v1", JSON.stringify(db));
  }

  function injectBudgetAndCharts() {
    const money = document.querySelector(".money-stats");
    if (money && !money.parentElement.querySelector(".pv-budget-box")) {
      const auth = tripAuth();
      const priv = auth ? readPrivateBudgetCents(auth.id) : null;
      const preset =
        priv != null
          ? String(Math.round(priv) / 100).replace(".", ",")
          : "";
      const box = document.createElement("div");
      box.className = "pv-budget-box";
      box.innerHTML = `
        <strong>Budget privato</strong>
        <p style="margin:0 0 8px;font-size:.82rem;color:#5b7076">Visibile solo a te su questo account. Il resto del viaggio resta condiviso.</p>
        <div class="row">
          <input type="text" inputmode="decimal" placeholder="Es. 1500" aria-label="Budget privato in euro" value="${escapeHtml(preset)}" />
          <button type="button" data-pv-save-budget="1">Salva budget</button>
        </div>
      `;
      money.parentElement.insertBefore(box, money.nextSibling);
      const saveBtn = box.querySelector("[data-pv-save-budget]");
      if (saveBtn) {
        saveBtn.dataset.pvBound = "1";
        saveBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void savePrivateBudgetFromUi(box).catch((err) => {
            alert(err instanceof Error ? err.message : "Budget non salvato");
          });
        });
      }
    }

    // Category breakdown near money-stats or expense list
    const expenseRoot =
      document.querySelector(".expense-columns") ||
      document.querySelector(".money-stats")?.parentElement;
    if (expenseRoot && !expenseRoot.querySelector(".pv-chart-box") && tripAuth()) {
      void renderExpenseChart(expenseRoot);
    }
  }

  async function savePrivateBudgetFromUi(box) {
    const input = box.querySelector("input");
    const cents = parseEuroToCents(input?.value);
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio salvato.");
    // Persist privately first — never rely on the shared trip blob for budget.
    writePrivateBudgetCents(auth.id, cents);
    const btn = box.querySelector("[data-pv-save-budget]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Salvato…";
    }
    // Strip shared budget in background; do not let network delays block private persist.
    const stripShared = (async () => {
      try {
        const { data } = await loadTrip();
        const trip = structuredClone(data.trip);
        trip.budget = 0;
        await saveTrip(auth, trip, data.revision);
      } catch {
        /* private save already done */
      }
      writePrivateBudgetCents(auth.id, cents);
    })();
    await Promise.race([stripShared, new Promise((r) => setTimeout(r, 2500))]);
    writePrivateBudgetCents(auth.id, cents);
    location.reload();
  }

  if (!window.__pvBudgetSaveBound) {
    window.__pvBudgetSaveBound = true;
    document.addEventListener(
      "click",
      (event) => {
        const btn = event.target?.closest?.("[data-pv-save-budget]");
        if (!btn) return;
        // Prefer the direct listener attached on inject; skip if already handled.
        if (btn.dataset.pvBound === "1") return;
        const box = btn.closest(".pv-budget-box");
        if (!box) return;
        event.preventDefault();
        void savePrivateBudgetFromUi(box).catch((err) => {
          alert(err instanceof Error ? err.message : "Budget non salvato");
        });
      },
      true
    );
  }

  async function renderExpenseChart(host) {
    try {
      const { data } = await loadTrip();
      const expenses = data.trip.expenses || [];
      if (host.querySelector(".pv-chart-box")) return;
      if (!expenses.length) {
        const tip = document.createElement("div");
        tip.className = "pv-chart-box";
        tip.innerHTML = `<strong>Spese per categoria</strong><p style="margin:0;color:#5b7076;font-size:.88rem">Aggiungi una spesa per vedere il riparto per categoria.</p>`;
        host.insertBefore(tip, host.firstChild);
        return;
      }
      const byCat = {};
      let total = 0;
      for (const e of expenses) {
        const cat = e.category || "Altro";
        byCat[cat] = (byCat[cat] || 0) + (e.amount || 0);
        total += e.amount || 0;
      }
      const box = document.createElement("div");
      box.className = "pv-chart-box";
      box.innerHTML = `<strong>Spese per categoria</strong>`;
      const max = Math.max(...Object.values(byCat), 1);
      for (const [cat, amount] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
        const row = document.createElement("div");
        row.className = "pv-chart-row";
        row.innerHTML = `
          <span>${escapeHtml(cat)}</span>
          <div class="bar"><div class="fill" style="width:${Math.round((amount / max) * 100)}%"></div></div>
          <span>${formatEuro(amount)}</span>
        `;
        box.appendChild(row);
      }
      const foot = document.createElement("p");
      foot.style.cssText = "margin:8px 0 0;font-size:.8rem;color:#5b7076";
      foot.textContent = `Totale ${formatEuro(total)} · ${Math.round((total / Math.max(data.trip.budget || total, 1)) * 100)}% del budget`;
      box.appendChild(foot);
      host.insertBefore(box, host.firstChild);
    } catch {
      /* ignore when demo / no auth */
    }
  }

  function ensureMapIframe() {
    const MAP_VER = "20261019c";
    const iframes = [...document.querySelectorAll('iframe[src*="map.html"]')];
    for (const iframe of iframes) {
      try {
        const u = new URL(iframe.getAttribute("src") || "", location.href);
        if (u.searchParams.get("v") === MAP_VER) continue;
        u.searchParams.set("v", MAP_VER);
        iframe.src = u.pathname + u.search;
      } catch {
        /* ignore */
      }
    }
  }

  function injectDistancesAndLegend() {
    ensureMapIframe();
    const iframe = document.querySelector('iframe[src*="map.html"]');
    if (iframe && !iframe.parentElement.querySelector(".pv-day-legend")) {
      const legend = document.createElement("div");
      legend.className = "pv-day-legend";
      tripDaysFromDom().forEach((label, i) => {
        const span = document.createElement("span");
        span.innerHTML = `<i style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></i>${escapeHtml(label)}`;
        legend.appendChild(span);
      });
      if (legend.childElementCount) iframe.parentElement.appendChild(legend);
    }

    // Fallback distance notes when React route-hop is missing (e.g. unordered lists).
    // Mark attempted so trips with 0 geo-stops don't refetch forever (save races).
    if (document.querySelector(".route-hop") || !tripAuth()) return;
    if (document.documentElement.dataset.pvDistAttempted === "1") return;
    document.documentElement.dataset.pvDistAttempted = "1";
    void annotateStopDistances();
  }

  async function annotateStopDistances() {
    try {
      const { data } = await loadTrip();
      const stops = (data.trip.stops || []).filter((s) => s.lat != null && s.lng != null);
      if (stops.length < 2) return;
      const cards = [...document.querySelectorAll("article.stop-card")];
      if (!cards.length) return;
      for (let i = 0; i < cards.length - 1; i++) {
        const aTitle = cards[i].querySelector("h3")?.textContent?.trim();
        const bTitle = cards[i + 1].querySelector("h3")?.textContent?.trim();
        const a = stops.find((s) => s.title === aTitle);
        const b = stops.find((s) => s.title === bTitle);
        const km = haversineKm(a, b);
        if (km == null) continue;
        if (cards[i].parentElement?.querySelector(".pv-dist-note,.route-hop")) continue;
        const note = document.createElement("p");
        note.className = "pv-dist-note";
        const walkMin = Math.max(1, Math.round((km / 4.5) * 60));
        const driveMin = Math.max(1, Math.round((km / 30) * 60));
        note.textContent =
          km < 10
            ? `↓ ${km.toFixed(1)} km · ~${walkMin} min a piedi / ~${driveMin} min in auto`
            : `↓ ${Math.round(km)} km · ~${driveMin} min in auto`;
        cards[i].insertAdjacentElement("afterend", note);
      }
    } catch {
      /* ignore — already marked attempted */
    }
  }

  function weatherLabel(code) {
    return WMO[code] || WMO[Math.floor(Number(code) / 10) * 10] || "Meteo";
  }

  function formatDayIt(iso) {
    try {
      return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(
        new Date(iso + "T12:00:00")
      );
    } catch {
      return iso;
    }
  }

  function currencyForDestination(destination) {
    const q = String(destination || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const rules = [
      // "Island" is a common EN short form / autocomplete leftover for Iceland
      { re: /islanda|\bisland\b|iceland|reykjav|akureyr/, code: "ISK", name: "Corona islandese" },
      { re: /norvegia|norway|oslo|bergen/, code: "NOK", name: "Corona norvegese" },
      { re: /svezia|sweden|stoccolma|stockholm/, code: "SEK", name: "Corona svedese" },
      { re: /danimarca|denmark|copenhagen|copenaghen/, code: "DKK", name: "Corona danese" },
      { re: /regno unito|uk|inghilterra|scozia|london|londra|edinburgh/, code: "GBP", name: "Sterlina" },
      { re: /svizzera|switzerland|zurigo|ginevra|zermatt/, code: "CHF", name: "Franco svizzero" },
      { re: /stati uniti|usa|new york|california|miami|hawaii/, code: "USD", name: "Dollaro USA" },
      { re: /giappone|japan|tokyo|osaka|kyoto/, code: "JPY", name: "Yen" },
      { re: /canada|toronto|vancouver|montreal/, code: "CAD", name: "Dollaro canadese" },
      { re: /australia|sydney|melbourne/, code: "AUD", name: "Dollaro australiano" },
      { re: /polonia|poland|varsavia|krakow|cracovia/, code: "PLN", name: "Złoty" },
      { re: /repubblica ceca|czech|praga|prague/, code: "CZK", name: "Corona ceca" },
      { re: /ungheria|hungary|budapest/, code: "HUF", name: "Fiorino" },
      { re: /romania|bucharest|bucarest/, code: "RON", name: "Leu" },
      { re: /turchia|turkey|istanbul|antalya/, code: "TRY", name: "Lira turca" },
      { re: /thailandia|thailand|bangkok|phuket/, code: "THB", name: "Baht" },
      { re: /singapore/, code: "SGD", name: "Dollaro di Singapore" },
      { re: /hong kong/, code: "HKD", name: "Dollaro di Hong Kong" },
      { re: /cina|china|pechino|shanghai|beijing/, code: "CNY", name: "Yuan" },
      { re: /india|delhi|mumbai|goa/, code: "INR", name: "Rupia indiana" },
      { re: /israele|israel|tel aviv|gerusalemme/, code: "ILS", name: "Shekel" },
      { re: /brasile|brazil|rio|sao paulo/, code: "BRL", name: "Real" },
      { re: /messico|mexico|cancun|tulum/, code: "MXN", name: "Peso messicano" },
      { re: /sudafrica|south africa|cape town|johannesburg/, code: "ZAR", name: "Rand" },
      { re: /nuova zelanda|new zealand|auckland|queenstown/, code: "NZD", name: "Dollaro NZ" },
      // Eurozone leftovers — no local conversion needed
      { re: /\b(italia|france|francia|spain|spagna|germania|germany|portugal|portogallo|greece|grecia|austria|belgio|belgium|olanda|netherlands|irlanda|ireland|finlandia|croatia|croazia)\b/, code: "EUR", name: "Euro" },
    ];
    for (const rule of rules) {
      if (rule.re.test(q)) return { code: rule.code, name: rule.name };
    }
    return null;
  }

  /** Prefer destination; fall back to trip title (e.g. "Vacanza in Islanda" with dest "Island"). */
  function currencyForTrip(trip) {
    if (!trip) return null;
    return (
      currencyForDestination(trip.destination) ||
      currencyForDestination(trip.title) ||
      null
    );
  }

  let weatherCache = null; // { key, mode, daily, destination }
  let weatherShownForDay = null;
  let dayStripClickBound = false;
  let fxDoneKey = "";

  function itineraryHost() {
    // Prefer the panel that actually contains the day strip (not the heading wrapper).
    const strip = document.querySelector(".day-strip");
    if (strip?.parentElement) return strip.parentElement;
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /il nostro itinerario|itinerario/i.test(el.textContent || "")
    );
    return (
      heading?.closest("section") ||
      heading?.closest(".primary-panel") ||
      heading?.parentElement?.parentElement ||
      null
    );
  }

  function insertAfterDayStrip(el) {
    const host = itineraryHost();
    const dayStrip = host?.querySelector(".day-strip");
    if (!host || !dayStrip) return false;
    // Keep day strip first: insert after strip (and after utility-strip if present).
    const utility = dayStrip.nextElementSibling?.classList?.contains("utility-strip")
      ? dayStrip.nextElementSibling
      : null;
    const anchor = utility || dayStrip;
    anchor.insertAdjacentElement("afterend", el);
    return true;
  }

  function getSelectedDayIso(days) {
    const buttons = [...document.querySelectorAll(".day-strip button")];
    if (!buttons.length || !days.length) return null;
    const selected = buttons.find((b) => b.classList.contains("selected")) || buttons[0];
    const idx = buttons.indexOf(selected);
    return days[idx] || days[0] || null;
  }

  function bindDayStripWeather() {
    if (dayStripClickBound) return;
    dayStripClickBound = true;
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.(".day-strip button");
        if (!btn) return;
        setTimeout(() => void syncDayWeather(true), 50);
        setTimeout(() => void syncDayWeather(true), 300);
      },
      true
    );
  }

  function expensesHost() {
    const money = document.querySelector(".money-stats");
    if (money?.parentElement) return money.parentElement;
    const cols = document.querySelector(".expense-columns");
    if (cols?.parentElement) return cols.parentElement;
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /spese di gruppo|spese/i.test((el.textContent || "").trim())
    );
    return heading?.closest("section") || heading?.parentElement?.parentElement || heading?.parentElement || null;
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

  function injectFxCalculator() {
    const auth = tripAuth();
    if (!auth) return;
    // Remove legacy itinerary FX / mega-block if still present.
    document.querySelectorAll(".pv-useful,.pv-fx-box").forEach((el) => el.remove());
    if (document.querySelector(".pv-fx-calc")) return;
    if (fxDoneKey === `${auth.id}:skip`) return;
    const host = expensesHost();
    if (!host) return;

    const box = document.createElement("div");
    box.className = "pv-fx-calc";
    box.id = "pv-fx-calc";
    box.innerHTML = `
      <div class="pv-block-title">Cambio</div>
      <div class="pv-block-meta" id="pv-fx-meta">Caricamento…</div>
      <div id="pv-fx-body"></div>
    `;
    const money = host.querySelector(".money-stats");
    const budget = host.querySelector(".pv-budget-box");
    const chart = host.querySelector(".pv-chart-box");
    if (budget) budget.insertAdjacentElement("afterend", box);
    else if (money) money.insertAdjacentElement("afterend", box);
    else if (chart) chart.insertAdjacentElement("beforebegin", box);
    else host.insertBefore(box, host.firstChild);
    void fillFxCalculator(box, auth.id);
  }

  async function fillFxCalculator(box, tripKey) {
    const meta = box.querySelector("#pv-fx-meta");
    const body = box.querySelector("#pv-fx-body");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const localFx = currencyForTrip(trip);

      if (!localFx || localFx.code === "EUR") {
        fxDoneKey = `${tripKey}:skip`;
        meta.textContent = "Destinazione in euro: nessun cambio necessario.";
        body.innerHTML = "";
        return;
      }

      const fx = await fetch(
        `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${encodeURIComponent(localFx.code)}`,
        { signal: AbortSignal.timeout(10000) }
      ).then((r) => r.json());
      const rate = Number(fx.rates?.[localFx.code]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("no-rate");

      const digits = rate >= 100 ? 0 : 2;
      meta.textContent = `${localFx.name} (${localFx.code}) · ${trip.destination}`;
      body.innerHTML = `
        <p class="pv-fx-rate">1 € = ${rate.toLocaleString("it-IT", { maximumFractionDigits: digits })} ${escapeHtml(localFx.code)}</p>
        <div class="pv-fx-rows">
          <label class="pv-fx-row">
            <input type="text" inputmode="decimal" id="pv-fx-eur" value="1" aria-label="Importo in euro" />
            <span class="code">EUR</span>
          </label>
          <label class="pv-fx-row">
            <input type="text" inputmode="decimal" id="pv-fx-local" aria-label="Importo in ${escapeHtml(localFx.code)}" />
            <span class="code">${escapeHtml(localFx.code)}</span>
          </label>
        </div>
      `;
      const eurInput = body.querySelector("#pv-fx-eur");
      const localInput = body.querySelector("#pv-fx-local");
      let syncing = false;

      const setFromEur = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          localInput.value = "";
          return;
        }
        localInput.value = formatFxAmount(n * rate, localFx.code);
      };
      const setFromLocal = (raw) => {
        const n = parseFxAmount(raw);
        if (n == null) {
          eurInput.value = "";
          return;
        }
        eurInput.value = formatFxAmount(n / rate, "EUR");
      };

      setFromEur(eurInput.value);
      eurInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        setFromEur(eurInput.value);
        syncing = false;
      });
      localInput.addEventListener("input", () => {
        if (syncing) return;
        syncing = true;
        setFromLocal(localInput.value);
        syncing = false;
      });
      fxDoneKey = `${tripKey}:ok`;
    } catch (err) {
      meta.textContent =
        err instanceof Error && err.message !== "no-rate"
          ? err.message
          : "Cambio non disponibile al momento.";
      body.innerHTML = "";
      fxDoneKey = "";
      // Drop empty shell so the next tick can retry after remount / transient errors.
      box.remove();
    }
  }

  async function fetchTripWeather(trip) {
    const key = `${trip.destination}|${trip.start}|${trip.end}`;
    if (weatherCache?.key === key) return weatherCache;

    const place = await geocodeDestination(trip.destination);
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${encodeURIComponent(trip.start)}&end_date=${encodeURIComponent(trip.end)}`;
    let daily = null;
    let mode = "forecast";
    try {
      const res = await fetch(forecastUrl, { signal: AbortSignal.timeout(12000) });
      const json = await res.json();
      if (res.ok && json.daily?.time?.length) daily = json.daily;
      else throw new Error(json.reason || "forecast-range");
    } catch {
      mode = "climate";
      try {
        const climateUrl =
          `https://climate-api.open-meteo.com/v1/climate?latitude=${place.lat}&longitude=${place.lng}` +
          `&start_date=${encodeURIComponent(trip.start)}&end_date=${encodeURIComponent(trip.end)}` +
          `&models=EC_Earth3P_HR&daily=temperature_2m_mean,precipitation_sum`;
        const json = await fetch(climateUrl, { signal: AbortSignal.timeout(15000) }).then((r) => r.json());
        if (json.daily?.time?.length) daily = json.daily;
      } catch {
        daily = null;
      }
    }
    weatherCache = { key, mode, daily, destination: trip.destination };
    return weatherCache;
  }

  function renderDayWeatherCard(box, trip, dayIso, cache) {
    const meta = box.querySelector("#pv-weather-meta");
    const cardHost = box.querySelector("#pv-weather-day");
    if (!cache?.daily?.time?.length) {
      meta.textContent = "Meteo non disponibile per queste date.";
      cardHost.innerHTML = "";
      return;
    }
    const i = cache.daily.time.indexOf(dayIso);
    if (i < 0) {
      meta.textContent = "Nessuna previsione per questo giorno.";
      cardHost.innerHTML = "";
      return;
    }
    meta.textContent =
      cache.mode === "forecast"
        ? `Previsione · ${formatDayIt(dayIso)}`
        : `Media climatica · ${formatDayIt(dayIso)}`;
    if (cache.mode === "forecast") {
      const code = cache.daily.weather_code?.[i];
      const tmax = cache.daily.temperature_2m_max?.[i];
      const tmin = cache.daily.temperature_2m_min?.[i];
      const rain = cache.daily.precipitation_probability_max?.[i];
      cardHost.innerHTML = `
        <div class="pv-weather-card">
          <strong>${escapeHtml(trip.destination)}</strong>
          <span class="cond">${escapeHtml(weatherLabel(code))}${rain != null ? ` · ${rain}% pioggia` : ""}</span>
          <span class="temp">${tmin != null && tmax != null ? `${Math.round(tmin)}°–${Math.round(tmax)}°` : "—"}</span>
        </div>
      `;
    } else {
      const tmean = cache.daily.temperature_2m_mean?.[i];
      const precip = cache.daily.precipitation_sum?.[i];
      cardHost.innerHTML = `
        <div class="pv-weather-card">
          <strong>${escapeHtml(trip.destination)}</strong>
          <span class="cond">${precip != null ? `${Number(precip).toFixed(1)} mm tipici` : "Clima medio"}</span>
          <span class="temp">${tmean != null ? `~${Math.round(tmean)}°` : "—"}</span>
        </div>
      `;
    }
  }

  async function syncDayWeather(fromClick = false) {
    if (!tripAuth()) return;
    bindDayStripWeather();
    if (!document.querySelector(".day-strip")) {
      document.querySelector(".pv-day-weather")?.remove();
      weatherShownForDay = null;
      return;
    }

    // Only show weather after the user selects a day (click), or when already shown for a day.
    const selectedBtn = document.querySelector(".day-strip button.selected");
    if (!fromClick && !weatherShownForDay && !document.querySelector(".pv-day-weather")) {
      return;
    }
    // First paint with a selected day after a click: proceed.
    if (!selectedBtn && !weatherShownForDay) return;

    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const dayIso = getSelectedDayIso(days);
      if (!dayIso) return;

      if (!fromClick && weatherShownForDay === dayIso && document.querySelector(".pv-day-weather")) {
        return;
      }

      let box = document.querySelector(".pv-day-weather");
      if (!box) {
        box = document.createElement("div");
        box.className = "pv-day-weather";
        box.id = "pv-day-weather";
        box.innerHTML = `
          <div class="pv-block-title">Meteo</div>
          <div class="pv-block-meta" id="pv-weather-meta">Caricamento…</div>
          <div id="pv-weather-day"></div>
        `;
        if (!insertAfterDayStrip(box)) {
          box.remove();
          return;
        }
      } else if (!box.previousElementSibling?.classList?.contains("day-strip") &&
                 !box.previousElementSibling?.classList?.contains("utility-strip") &&
                 !document.querySelector(".day-strip")) {
        /* keep existing placement */
      }

      // Ensure day strip stays above: if somehow weather ended up before strip, move it.
      const host = itineraryHost();
      const strip = host?.querySelector(".day-strip");
      if (host && strip && box.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING) {
        insertAfterDayStrip(box);
      }

      weatherShownForDay = dayIso;
      const cache = await fetchTripWeather(trip);
      renderDayWeatherCard(box, trip, dayIso, cache);
    } catch (err) {
      const box = document.querySelector(".pv-day-weather");
      if (box) {
        const meta = box.querySelector("#pv-weather-meta");
        if (meta) meta.textContent = err instanceof Error ? err.message : "Meteo non disponibile.";
      }
    }
  }

  function injectLinksAfterNotes() {
    if (!tripAuth()) return;
    if (document.querySelector(".pv-links-box")) return;

    // Notes tab content: heading "Appunti di viaggio" + .notes-paper
    const notesHeading = [...document.querySelectorAll("h2")].find((el) =>
      /appunti di viaggio|^note$/i.test((el.textContent || "").trim())
    );
    const notesPaper = document.querySelector(".notes-paper");
    const anchor = notesPaper || notesHeading?.closest(".section-heading") || notesHeading;
    if (!anchor) return;

    const host = notesPaper?.parentElement || notesHeading?.closest("section") || notesHeading?.parentElement;
    if (!host) return;

    const box = document.createElement("div");
    box.className = "pv-links-box";
    box.id = "pv-links-box";
    box.innerHTML = `
      <div class="pv-block-title">Link e azioni</div>
      <div class="pv-action-list" id="pv-actions-list"></div>
      <p class="pv-status" id="pv-links-status"></p>
    `;
    if (notesPaper) notesPaper.insertAdjacentElement("afterend", box);
    else if (notesHeading?.closest(".section-heading")) {
      notesHeading.closest(".section-heading").insertAdjacentElement("afterend", box);
    } else {
      host.appendChild(box);
    }
    void fillLinksBox(box);
  }

  async function fillLinksBox(box) {
    const actionsEl = box.querySelector("#pv-actions-list");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const destQ = encodeURIComponent(trip.destination);
      actionsEl.innerHTML = `
        <a href="https://www.google.com/maps/search/?api=1&query=${destQ}" target="_blank" rel="noopener noreferrer"><span>Apri in Google Maps</span><span class="hint">mappa</span></a>
        <a href="https://it.wikivoyage.org/wiki/Special:Search?search=${destQ}" target="_blank" rel="noopener noreferrer"><span>Guida Wikivoyage</span><span class="hint">consigli</span></a>
        <a href="https://it.wikipedia.org/wiki/Special:Search?search=${destQ}" target="_blank" rel="noopener noreferrer"><span>Wikipedia</span><span class="hint">info</span></a>
        <a href="https://www.google.com/search?q=${encodeURIComponent(trip.destination + " emergenza numero")}" target="_blank" rel="noopener noreferrer"><span>Numeri utili</span><span class="hint">emergenze</span></a>
        <button type="button" id="pv-copy-day"><span>Copia riepilogo del giorno</span><span class="hint">testo</span></button>
        <button type="button" id="pv-copy-trip"><span>Copia riepilogo del viaggio</span><span class="hint">testo</span></button>
      `;
      box.querySelector("#pv-copy-day").onclick = () => void copyDaySummary(box);
      box.querySelector("#pv-copy-trip").onclick = () => void copyTripSummary(box);
    } catch (err) {
      const status = box.querySelector("#pv-links-status");
      if (status) status.textContent = err instanceof Error ? err.message : "Link non disponibili.";
    }
  }

  async function copyDaySummary(box) {
    const status = box.querySelector("#pv-links-status") || box.querySelector("#pv-useful-status");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const day = getSelectedDayIso(days) || days[0] || "";
      const dayIndex = Math.max(0, days.indexOf(day));
      const stops = (trip.stops || []).filter((s) => !day || s.day === day);
      const lines = [
        `${trip.title} — ${trip.destination}`,
        day ? `Giorno ${dayIndex + 1} (${day})` : "Itinerario",
        ...stops.map((s, i) => `${i + 1}. ${s.time ? s.time + " · " : ""}${s.title}${s.address ? " — " + s.address : ""}`),
        stops.length ? "" : "(nessuna tappa)",
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      if (status) status.textContent = "Riepilogo giorno copiato.";
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? err.message : "Copia non riuscita";
    }
  }

  async function copyTripSummary(box) {
    const status = box.querySelector("#pv-links-status") || box.querySelector("#pv-useful-status");
    try {
      const { data } = await loadTrip();
      const trip = data.trip;
      const days = tripDays(trip);
      const lines = [
        `${trip.title}`,
        `${trip.destination} · ${trip.start} → ${trip.end}`,
        trip.budget ? `Budget ${formatEuro(trip.budget)}` : "",
        "",
      ];
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const stops = (trip.stops || []).filter((s) => s.day === day);
        lines.push(`Giorno ${i + 1} — ${day}`);
        if (!stops.length) lines.push("  (nessuna tappa)");
        for (const s of stops) lines.push(`  • ${s.time ? s.time + " " : ""}${s.title}`);
        lines.push("");
      }
      await navigator.clipboard.writeText(lines.filter((l, idx, arr) => l || arr[idx - 1]).join("\n").trim());
      if (status) status.textContent = "Riepilogo viaggio copiato.";
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? err.message : "Copia non riuscita";
    }
  }

  function tripDaysFromDom() {
    const labels = [...document.querySelectorAll("button,div,span")]
      .map((el) => (el.textContent || "").trim())
      .filter((t) => /^Giorno\s+\d+/i.test(t))
      .slice(0, 12);
    return [...new Set(labels)];
  }

  // Enrich map postMessage with day colors by patching postMessage calls.
  window.addEventListener("message", (event) => {
    if (event.data?.type === "viavia-ready") {
      void pushColoredMapPoints();
    }
  });

  async function pushColoredMapPoints() {
    const iframe = document.querySelector('iframe[src*="map.html"]');
    if (!iframe?.contentWindow || !tripAuth()) return;
    try {
      const { data } = await loadTrip();
      const days = tripDays(data.trip);
      const dayIndex = Object.fromEntries(days.map((d, i) => [d, i]));
      const points = (data.trip.stops || [])
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: s.id,
          title: s.title,
          lat: s.lat,
          lng: s.lng,
          color: DAY_COLORS[(dayIndex[s.day] ?? days.length) % DAY_COLORS.length],
          day: s.day || "",
        }));
      iframe.contentWindow.postMessage(
        {
          type: "viavia-map",
          points,
          selected: null,
          pick: false,
          destination: data.trip.destination || data.trip.title || "",
        },
        location.origin
      );
    } catch {
      /* ignore */
    }
  }

  let expenseFxState = { code: "EUR", rate: 1, name: "Euro" };

  function setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function enhanceExpenseCurrencyField() {
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    });
    if (!amountLabel) return;

    const auth = tripAuth();
    if (!auth) return;

    let host = amountLabel.closest(".form-grid") || amountLabel.parentElement;
    if (!host) return;
    if (host.querySelector(".pv-expense-fx")) return;

    let localFx = null;
    let rate = 1;
    try {
      const { data } = await loadTrip();
      localFx = currencyForTrip(data.trip);
      if (localFx && localFx.code !== "EUR") {
        const fx = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${encodeURIComponent(localFx.code)}`,
          { signal: AbortSignal.timeout(10000) }
        ).then((r) => r.json());
        rate = Number(fx.rates?.[localFx.code]);
        if (!Number.isFinite(rate) || rate <= 0) localFx = null;
      } else {
        localFx = null;
      }
    } catch {
      localFx = null;
    }

    // Re-check after await — React may have remounted.
    if (host.querySelector(".pv-expense-fx")) return;
    if (!document.contains(amountLabel)) return;

    const box = document.createElement("label");
    box.className = "field pv-expense-fx";
    const options = [`<option value="EUR">Euro (€)</option>`];
    if (localFx) {
      options.push(
        `<option value="${escapeHtml(localFx.code)}">${escapeHtml(localFx.name)} (${escapeHtml(localFx.code)})</option>`
      );
    }
    box.innerHTML = `
      <span>Valuta della spesa</span>
      <select id="pv-expense-currency" aria-label="Valuta della spesa">${options.join("")}</select>
      <p class="pv-expense-fx-hint" id="pv-expense-fx-hint"></p>
    `;
    amountLabel.insertAdjacentElement("afterend", box);

    const select = box.querySelector("#pv-expense-currency");
    const hint = box.querySelector("#pv-expense-fx-hint");
    const span = amountLabel.querySelector(":scope > span");
    const input = amountLabel.querySelector("input");
    expenseFxState = {
      code: "EUR",
      rate: localFx ? rate : 1,
      name: localFx?.name || "Euro",
      localCode: localFx?.code || null,
    };

    const refreshHint = () => {
      const code = select.value;
      expenseFxState.code = code;
      if (!span || !input) return;
      if (code === "EUR") {
        span.textContent = "Totale in €";
        hint.textContent = localFx
          ? `Puoi anche inserire l'importo in ${localFx.code}; verrà convertito in euro (condiviso).`
          : "";
        return;
      }
      span.textContent = `Totale in ${code}`;
      const n = parseFxAmount(input.value);
      if (n == null) {
        hint.textContent = `Al salvataggio convertiamo in euro (1 € = ${rate.toLocaleString("it-IT", {
          maximumFractionDigits: rate >= 100 ? 0 : 2,
        })} ${code}).`;
        return;
      }
      const eur = n / rate;
      hint.textContent = `≈ ${eur.toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
      })} · salvato in euro per la condivisione`;
    };

    select.addEventListener("change", refreshHint);
    input?.addEventListener("input", refreshHint);
    refreshHint();
  }

  function convertExpenseAmountBeforeSubmit() {
    const select = document.querySelector("#pv-expense-currency");
    if (!select || select.value === "EUR") return;
    const amountLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    });
    const input = amountLabel?.querySelector("input");
    if (!input) return;
    const local = parseFxAmount(input.value);
    if (local == null) return;
    const rate = expenseFxState.rate || 1;
    const eur = Math.round((local / rate) * 100) / 100;
    // Keep enough decimals for React kn() parser.
    setNativeInputValue(input, String(eur));
    const titleLabel = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /Per cosa avete speso/i.test((span.textContent || "").trim());
    });
    const titleInput = titleLabel?.querySelector("input");
    if (titleInput && titleInput.value && !new RegExp(`\\b${select.value}\\b`).test(titleInput.value)) {
      setNativeInputValue(titleInput, `${titleInput.value.trim()} (${formatFxAmount(local, select.value)} ${select.value})`);
    }
  }

  if (!window.__pvExpenseFxBound) {
    window.__pvExpenseFxBound = true;
    document.addEventListener(
      "click",
      (event) => {
        const btn = event.target?.closest?.("button[type='submit']");
        if (!btn) return;
        if (!document.querySelector("#pv-expense-currency")) return;
        convertExpenseAmountBeforeSubmit();
      },
      true
    );
    document.addEventListener(
      "submit",
      () => {
        if (!document.querySelector("#pv-expense-currency")) return;
        convertExpenseAmountBeforeSubmit();
      },
      true
    );
  }

  function injectLocalOnlyBanner() {
    const openTrip = (() => {
      try {
        const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
        return p.get("trip") || "";
      } catch {
        return "";
      }
    })();
    const isLocal =
      openTrip &&
      typeof window.__pvIsTripLocalOnly === "function" &&
      window.__pvIsTripLocalOnly(openTrip);
    let banner = document.getElementById("pv-local-only-banner");
    if (!isLocal) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pv-local-only-banner";
      banner.setAttribute("role", "status");
      banner.style.cssText =
        "position:sticky;top:44px;z-index:70;margin:0;padding:10px 14px;background:#fff4e5;color:#7a4b00;border-bottom:1px solid #f0d3a0;font:600 13px/1.35 inherit;text-align:center";
      document.body.prepend(banner);
    }
    banner.textContent =
      "Questo viaggio è salvato su questo dispositivo. Usa «Condividi viaggio» e attendi il link con snapshot (s=…) prima di inviarlo agli amici.";
  }

  function fixItalianTappeGrammar() {
    const root = document.getElementById("root");
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const t = node.nodeValue || "";
      if (!t.includes("tappe")) continue;
      const next = t
        .replace(/\b1 tappe\b/g, "1 tappa")
        .replace(/\b0 tappe\b/g, "0 tappe");
      if (next !== t) node.nodeValue = next;
    }
  }

  function preferIcelandCover() {
    const root = document.getElementById("root");
    if (!root) return;
    const dest =
      root.querySelector("h1, h2, .hero, [class*='destination']")?.textContent ||
      root.innerText ||
      "";
    if (!/islanda|iceland|reykjav/i.test(dest)) return;
    const icelandSrc = new URL("iceland.svg", location.href).href;
    const heroImgs = [...root.querySelectorAll("img")].filter((img) => {
      const alt = `${img.alt || ""} ${img.src || ""} ${img.className || ""}`;
      return (
        /balos|creta|crete|greece|santorini|mykonos|coast|cover|hero|banner|copertina/i.test(alt) ||
        /balos|crete|greece|coast\.jpg/i.test(img.src || "") ||
        (img.width > 400 || img.clientWidth > 400)
      );
    });
    for (const img of heroImgs.slice(0, 2)) {
      if (img.dataset.pvIcelandSwap === "1" && /iceland\.svg/i.test(img.src || "")) continue;
      img.dataset.pvIcelandSwap = "1";
      img.dataset.pvPrevSrc = img.src;
      img.src = icelandSrc;
      img.alt = "Copertina Islanda";
      // Hide stale "Copertina: Balos" credits near the image.
      const wrap = img.closest("div,section,article,figure") || img.parentElement;
      if (wrap) {
        for (const el of wrap.querySelectorAll("small, span, p, figcaption")) {
          const t = (el.textContent || "").trim();
          if (/copertina\s*:\s*balos|balos|creta|crete/i.test(t) && t.length < 80) {
            el.textContent = "Copertina: Islanda";
          }
        }
        if (!img.dataset.pvIcelandNote) {
          img.dataset.pvIcelandNote = "1";
          if (wrap && getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
          const note = document.createElement("div");
          note.className = "pv-cover-note";
          note.textContent = "Copertina Islanda — puoi sostituirla con una tua foto";
          note.style.cssText =
            "position:absolute;left:12px;bottom:12px;z-index:2;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;border-radius:8px;font:600 11px/1.3 inherit";
          wrap.appendChild(note);
        }
      }
    }
  }

  function injectCloudStatusBanner() {
    if (window.__pvCloudBannerBound) return;
    window.__pvCloudBannerBound = true;
    const ENDPOINTS = [
      "https://pronti-via-k7es.netlify.app/api/trips",
      "https://like-success-universities-old.trycloudflare.com/api/trips",
    ];
    const run = async () => {
      let ok = false;
      for (const url of ENDPOINTS) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          // GET without id returns 404 from a healthy API, 502 when down.
          const res = await fetch(url, { method: "GET", signal: ctrl.signal, cache: "no-store" });
          clearTimeout(t);
          if (res.status < 500) {
            ok = true;
            break;
          }
        } catch {
          /* try next */
        }
      }
      let el = document.getElementById("pv-cloud-status-banner");
      if (ok) {
        if (el) el.remove();
        return;
      }
      if (!el) {
        el = document.createElement("div");
        el.id = "pv-cloud-status-banner";
        el.setAttribute("role", "status");
        el.style.cssText =
          "position:sticky;top:0;z-index:71;margin:0;padding:8px 14px;background:#fde8e8;color:#7a1f1f;border-bottom:1px solid #f0c0c0;font:600 12px/1.35 inherit;text-align:center";
        document.body.prepend(el);
      }
      el.textContent =
        "Cloud temporaneamente non raggiungibile: i viaggi restano su questo dispositivo. Condividi solo dopo aver ottenuto un link con snapshot (s=…).";
    };
    void run();
    setInterval(run, 120000);
  }

  function readTripPreventivoFromCache(tripId) {
    try {
      const raw = localStorage.getItem("viavia-local-trips-v1");
      const db = raw ? JSON.parse(raw) : null;
      return db?.[tripId]?.trip?.meta?.preventivo || null;
    } catch {
      return null;
    }
  }

  function ensurePreventivoSectionStyles() {
    if (document.getElementById("pv-trip-preventivo-css")) return;
    const style = document.createElement("style");
    style.id = "pv-trip-preventivo-css";
    style.textContent = `
      #pv-preventivo-trip-banner{position:sticky;top:44px;z-index:69;margin:0;padding:8px 12px;background:#eaf5f5;color:#0f2c31;border-bottom:1px solid #cfe3e3;font:600 12px/1.35 inherit;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
      #pv-preventivo-trip-banner button{appearance:none;border:0;border-radius:999px;padding:7px 12px;font:700 12px inherit;cursor:pointer;background:#007d82;color:#fff}
      #pv-preventivo-trip-banner .pv-prev-banner-text{text-align:center}
      .pv-preventivo-workspace{padding:4px 0 28px;color:#153b47;font:500 14px/1.4 "Segoe UI","Helvetica Neue",sans-serif}
      .pv-preventivo-workspace .pv-tp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin:0 0 14px}
      .pv-preventivo-workspace .pv-tp-head h2{margin:0;font-size:1.35rem;letter-spacing:-.02em}
      .pv-preventivo-workspace .pv-tp-eyebrow{margin:0 0 2px;font-weight:700;color:#007d82;text-transform:uppercase;font-size:.75rem;letter-spacing:.04em}
      .pv-tp-root .pv-tp-card,.pv-preventivo-workspace .pv-tp-card{background:#fff;border:1px solid #d7e4e6;border-radius:16px;padding:14px;margin:0 0 12px}
      .pv-tp-root .pv-tp-card h3,.pv-preventivo-workspace .pv-tp-card h3{margin:0 0 8px;font-size:1rem}
      .pv-tp-root .pv-tp-muted,.pv-preventivo-workspace .pv-tp-muted{color:#5b7380;font-size:.88rem;margin:0 0 10px}
      .pv-tp-root .pv-tp-lines,.pv-preventivo-workspace .pv-tp-lines{display:grid;gap:8px}
      .pv-tp-root .pv-tp-line,.pv-preventivo-workspace .pv-tp-line{display:grid;grid-template-columns:1fr 88px 118px auto;gap:8px;align-items:center}
      .pv-tp-root .pv-tp-line input,.pv-tp-root .pv-tp-line select,.pv-preventivo-workspace .pv-tp-line input,.pv-preventivo-workspace .pv-tp-line select{width:100%;box-sizing:border-box;border:1px solid #d7e4e6;border-radius:10px;padding:9px 10px;font:inherit}
      .pv-tp-root .pv-tp-actions,.pv-preventivo-workspace .pv-tp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .pv-tp-root .pv-tp-actions button,.pv-preventivo-workspace .pv-tp-actions button{appearance:none;border:0;border-radius:999px;padding:11px 14px;font:700 13px inherit;cursor:pointer}
      .pv-tp-root .pv-tp-primary,.pv-preventivo-workspace .pv-tp-primary{background:#007d82;color:#fff}
      .pv-tp-root .pv-tp-ghost,.pv-preventivo-workspace .pv-tp-ghost{background:#eef5f5;color:#153b47}
      .pv-tp-root .pv-tp-danger,.pv-preventivo-workspace .pv-tp-danger{background:#f3e4e2;color:#7a2e28}
      .pv-tp-root .pv-tp-status,.pv-preventivo-workspace .pv-tp-status{min-height:1.2em;margin:8px 0 0;font-size:.85rem;color:#5b7380}
      .pv-tp-root .pv-esim-grid,.pv-preventivo-workspace .pv-esim-grid{display:grid;gap:10px}
      .pv-tp-root .pv-esim-card,.pv-preventivo-workspace .pv-esim-card{border:1px solid #d9e7e7;border-radius:14px;padding:12px;background:#f7fbfb}
      .pv-tp-root .pv-esim-card ul,.pv-preventivo-workspace .pv-esim-card ul{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}
      .pv-tp-root .pv-esim-card li,.pv-preventivo-workspace .pv-esim-card li{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:.88rem}
      .pv-tp-root .pv-esim-link,.pv-preventivo-workspace .pv-esim-link{display:inline-flex;padding:8px 12px;border-radius:999px;background:#007d82;color:#fff;text-decoration:none;font-weight:700;font-size:.85rem}
      .pv-tp-root .pv-badge,.pv-preventivo-workspace .pv-badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700}
      .pv-tp-root .pv-badge.STIMA,.pv-preventivo-workspace .pv-badge.STIMA{background:#fff3cd;color:#7a5b00}
      .pv-tp-root .pv-badge.WARN,.pv-tp-root .pv-badge.DA\\ VERIFICARE,.pv-preventivo-workspace .pv-badge.WARN,.pv-preventivo-workspace .pv-badge.DA\\ VERIFICARE{background:#fde8e8;color:#8a1f1f}
      .pv-tp-root .pv-badge.VERIFICATO,.pv-preventivo-workspace .pv-badge.VERIFICATO{background:#e3f6ea;color:#0f5a30}
      #pv-trip-preventivo-panel{position:fixed;inset:0;z-index:100020;display:grid;place-items:end center}
      #pv-trip-preventivo-panel[hidden]{display:none!important}
      #pv-trip-preventivo-panel .pv-tp-backdrop{position:absolute;inset:0;background:rgba(12,32,40,.42)}
      #pv-trip-preventivo-panel .pv-tp-sheet{position:relative;z-index:1;width:min(520px,100%);max-height:min(88vh,820px);overflow:auto;background:#f7fafb;border-radius:22px 22px 0 0;padding:16px 16px 28px;box-shadow:0 -18px 50px rgba(21,59,71,.18)}
      #pv-trip-preventivo-panel .pv-tp-close{border:0;width:36px;height:36px;border-radius:999px;background:#eef5f5;font-size:1.3rem;cursor:pointer}
      @media (max-width:640px){
        .pv-tp-root .pv-tp-line,.pv-preventivo-workspace .pv-tp-line{grid-template-columns:1fr 1fr}
        .pv-tp-root .pv-tp-line input:first-child,.pv-preventivo-workspace .pv-tp-line input:first-child{grid-column:1/-1}
      }
      @media (min-width:720px){
        #pv-trip-preventivo-panel{place-items:center;padding:24px 16px}
        #pv-trip-preventivo-panel .pv-tp-sheet{border-radius:22px;max-height:min(84vh,760px)}
      }
    `;
    document.head.appendChild(style);
  }

  function clickPreventivoMainTab() {
    const tab =
      document.querySelector(".main-tabs .pv-tab-preventivo") ||
      [...document.querySelectorAll(".main-tabs [role='tab'], .main-tabs button")].find((el) =>
        /Preventivo/i.test(el.textContent || "")
      );
    if (!tab) return false;
    tab.click();
    return true;
  }

  function mountPreventivoTabPanel() {
    ensurePreventivoSectionStyles();
    const mount = document.getElementById("pv-preventivo-tab-mount");
    if (!mount) return false;
    if (!mount.querySelector("#pv-tp-body")) {
      mount.innerHTML = `
        <header class="pv-tp-head">
          <div>
            <p class="pv-tp-eyebrow">STIMA DI VIAGGIO</p>
            <h2 id="pv-tp-title">Preventivo</h2>
          </div>
        </header>
        <div class="pv-tp-root" id="pv-tp-body"></div>`;
      void renderTripPreventivoSection();
    }
    return true;
  }

  function injectPreventivoTripBanner() {
    ensurePreventivoSectionStyles();
    mountPreventivoTabPanel();
    const openTrip = (() => {
      try {
        return new URLSearchParams(String(location.hash || "").replace(/^#/, "")).get("trip") || "";
      } catch {
        return "";
      }
    })();
    if (!openTrip) {
      document.getElementById("pv-preventivo-trip-banner")?.remove();
      return;
    }
    let pv = readTripPreventivoFromCache(openTrip);
    let banner = document.getElementById("pv-preventivo-trip-banner");
    if (!pv?.totals && !pv?.lines?.length) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "pv-preventivo-trip-banner";
        document.body.prepend(banner);
      }
      banner.innerHTML = `<span class="pv-prev-banner-text">Nessun preventivo nel viaggio</span>
        <button type="button" data-pv-open-section>Vai a Preventivo</button>`;
      banner.querySelector("[data-pv-open-section]")?.addEventListener("click", () => openTripPreventivoSection());
      const local = document.getElementById("pv-local-only-banner");
      if (local && banner.previousElementSibling !== local) local.after(banner);
      return;
    }
    const group = Math.round((Number(pv.totals?.groupCents) || 0) / 100);
    const pp = Math.round((Number(pv.totals?.perPersonCents) || 0) / 100);
    const nextText = `Preventivo ${pv.scenario || ""}: ~€${group.toLocaleString("it-IT")} gruppo · ~€${pp.toLocaleString("it-IT")}/pp (STIMA)`;
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pv-preventivo-trip-banner";
      document.body.prepend(banner);
    }
    banner.innerHTML = `<span class="pv-prev-banner-text">${nextText}</span>
      <button type="button" data-pv-open-section>Vai a Preventivo</button>`;
    banner.querySelector("[data-pv-open-section]")?.addEventListener("click", () => openTripPreventivoSection());
    const local = document.getElementById("pv-local-only-banner");
    if (local && banner.previousElementSibling !== local) local.after(banner);
  }

  function closeTripPreventivoSection() {
    const panel = document.getElementById("pv-trip-preventivo-panel");
    if (panel) panel.hidden = true;
    document.documentElement.style.overflow = "";
  }

  async function openTripPreventivoSection() {
    ensurePreventivoSectionStyles();
    // Prefer the native workspace tab next to Itinerario / Esplora / Luoghi.
    if (clickPreventivoMainTab()) {
      // Wait a tick for Radix to mount TabsContent, then fill it.
      requestAnimationFrame(() => {
        mountPreventivoTabPanel();
        void renderTripPreventivoSection();
      });
      setTimeout(() => {
        mountPreventivoTabPanel();
        void renderTripPreventivoSection();
        document.getElementById("pv-preventivo-tab-mount")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    let panel = document.getElementById("pv-trip-preventivo-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "pv-trip-preventivo-panel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="pv-tp-backdrop" data-tp-close></div>
        <div class="pv-tp-sheet" role="dialog" aria-modal="true" aria-labelledby="pv-tp-title">
          <header class="pv-tp-head">
            <div>
              <p class="pv-tp-eyebrow">Sezione viaggio</p>
              <h2 id="pv-tp-title">Preventivo</h2>
            </div>
            <button type="button" class="pv-tp-close" data-tp-close aria-label="Chiudi">×</button>
          </header>
          <div class="pv-tp-root" id="pv-tp-body"></div>
        </div>`;
      document.body.appendChild(panel);
      panel.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("[data-tp-close]")) closeTripPreventivoSection();
      });
    }
    panel.hidden = false;
    document.documentElement.style.overflow = "hidden";
    await renderTripPreventivoSection();
  }

  function escapeTp(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function renderTripPreventivoSection() {
    const body = document.getElementById("pv-tp-body");
    if (!body) return;
    body.innerHTML = `<p class="pv-tp-muted">Caricamento preventivo…</p>`;
    try {
      const { auth, data } = await loadTrip({ force: true });
      const trip = data.trip || {};
      const pv = trip.meta?.preventivo || { scenario: "economico", lines: [], totals: {} };
      const lines = Array.isArray(pv.lines) ? pv.lines : [];
      const group = Number(pv.totals?.groupCents) || lines.reduce((s, l) => s + (Number(l.totalCents) || (Number(l.unitCents) || 0) * (Number(l.qty) || 1)), 0);
      const travelers = Math.max(1, Number(pv.params?.travelers || trip.members?.length || 1));
      const pp = Math.round(group / travelers);
      const dest = pv.params?.destination || trip.destination || "";
      const start = pv.params?.start || trip.start || "";
      const end = pv.params?.end || trip.end || "";
      const esimHtml =
        typeof window.__pvEsimBlockHtml === "function"
          ? window.__pvEsimBlockHtml(dest, start, end, { compact: true })
          : `<p class="pv-tp-muted">Modulo eSIM non ancora caricato. Ricarica la pagina.</p>`;

      const lineRows = lines.length
        ? lines
            .map(
              (l, idx) => {
                const total = Number(l.totalCents) || (Number(l.unitCents) || 0) * (Number(l.qty) || 1);
                return `<div class="pv-tp-line" data-line-idx="${idx}">
                  <input data-k="title" value="${escapeTp(l.title || "Voce")}" aria-label="Voce" />
                  <input data-k="euros" type="number" min="0" step="1" value="${Math.round(total / 100)}" aria-label="Euro" />
                  <select data-k="status" aria-label="Stato">
                    ${["STIMA", "DA VERIFICARE", "VERIFICATO", "SCADUTO"]
                      .map((s) => `<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>`)
                      .join("")}
                  </select>
                  <button type="button" class="pv-tp-danger" data-remove-line title="Rimuovi">✕</button>
                </div>`;
              }
            )
            .join("")
        : `<p class="pv-tp-muted">Nessuna voce ancora. Aggiungine una o apri il Preventivo intelligente.</p>`;

      body.innerHTML = `
        <section class="pv-tp-card">
          <h3>Riepilogo · scenario ${escapeTp(pv.scenario || "—")}</h3>
          <p><strong>Gruppo:</strong> ${formatEuro(group)} · <strong>/persona:</strong> ${formatEuro(pp)}</p>
          <p class="pv-tp-muted">Il preventivo non viene più scritto nelle note: resta in questa sezione e viaggia con il link di condivisione.</p>
          <div class="pv-tp-lines" id="pv-tp-lines">${lineRows}</div>
          <div class="pv-tp-actions">
            <button type="button" class="pv-tp-ghost" id="pv-tp-add-line">+ Aggiungi voce</button>
            <button type="button" class="pv-tp-primary" id="pv-tp-save">Salva modifiche</button>
            <button type="button" class="pv-tp-ghost" id="pv-tp-open-smart">Apri Preventivo intelligente</button>
          </div>
          <p class="pv-tp-status" id="pv-tp-status"></p>
        </section>
        <section class="pv-tp-card">
          <h3>eSIM per ${escapeTp(dest || "destinazione")}</h3>
          <p class="pv-tp-muted">Tariffe indicative per i giorni di permanenza. Tocca un operatore per verificare prezzi aggiornati.</p>
          ${esimHtml}
        </section>
      `;

      body.querySelectorAll("[data-remove-line]").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.closest(".pv-tp-line")?.remove();
        });
      });
      body.querySelector("#pv-tp-add-line")?.addEventListener("click", () => {
        const host = body.querySelector("#pv-tp-lines");
        if (!host) return;
        const empty = host.querySelector(".pv-tp-muted");
        if (empty) empty.remove();
        const row = document.createElement("div");
        row.className = "pv-tp-line";
        row.innerHTML = `
          <input data-k="title" value="Nuova voce" aria-label="Voce" />
          <input data-k="euros" type="number" min="0" step="1" value="0" aria-label="Euro" />
          <select data-k="status" aria-label="Stato">
            <option value="STIMA" selected>STIMA</option>
            <option value="DA VERIFICARE">DA VERIFICARE</option>
            <option value="VERIFICATO">VERIFICATO</option>
            <option value="SCADUTO">SCADUTO</option>
          </select>
          <button type="button" class="pv-tp-danger" data-remove-line title="Rimuovi">✕</button>`;
        row.querySelector("[data-remove-line]")?.addEventListener("click", () => row.remove());
        host.appendChild(row);
      });
      body.querySelector("#pv-tp-open-smart")?.addEventListener("click", () => {
        if (document.getElementById("pv-trip-preventivo-panel") && !document.getElementById("pv-trip-preventivo-panel").hidden) {
          closeTripPreventivoSection();
        }
        if (typeof window.__pvOpenPreventivoSection === "function") window.__pvOpenPreventivoSection("budget");
        else if (typeof window.__pvOpenPreventivo === "function") window.__pvOpenPreventivo();
      });
      body.querySelector("#pv-tp-save")?.addEventListener("click", () =>
        void saveTripPreventivoSection(auth, data, pv)
      );
    } catch (err) {
      body.innerHTML = `<p class="pv-tp-status" style="color:#7a2e28">${escapeTp(err.message || "Preventivo non disponibile")}</p>`;
    }
  }

  async function saveTripPreventivoSection(auth, data, prevPv) {
    const status = document.getElementById("pv-tp-status");
    const saveBtn = document.getElementById("pv-tp-save");
    if (saveBtn) saveBtn.disabled = true;
    if (status) status.textContent = "Salvataggio…";
    try {
      const rows = [...document.querySelectorAll("#pv-tp-lines .pv-tp-line")];
      const lines = rows.map((row, i) => {
        const title = row.querySelector('[data-k="title"]')?.value?.trim() || `Voce ${i + 1}`;
        const euros = Number(row.querySelector('[data-k="euros"]')?.value || 0);
        const statusVal = row.querySelector('[data-k="status"]')?.value || "STIMA";
        const totalCents = Math.max(0, Math.round(euros * 100));
        return {
          id: prevPv?.lines?.[i]?.id || uid(),
          title,
          status: statusVal,
          unitCents: totalCents,
          qty: 1,
          totalCents,
          source: prevPv?.lines?.[i]?.source || "",
          key: prevPv?.lines?.[i]?.key || "",
          mode: prevPv?.lines?.[i]?.mode || "",
        };
      });
      const groupCents = lines.reduce((s, l) => s + (l.totalCents || 0), 0);
      const travelers = Math.max(1, Number(prevPv?.params?.travelers || data.trip?.members?.length || 1));
      const dest = prevPv?.params?.destination || data.trip?.destination || "";
      const start = prevPv?.params?.start || data.trip?.start || "";
      const end = prevPv?.params?.end || data.trip?.end || "";
      const esim =
        typeof window.__pvBuildEsimCatalog === "function"
          ? window.__pvBuildEsimCatalog(dest, start, end)
          : prevPv?.esim || null;
      const byStatus = { VERIFICATO: 0, STIMA: 0, "DA VERIFICARE": 0, SCADUTO: 0 };
      for (const l of lines) {
        const key = byStatus[l.status] != null ? l.status : "STIMA";
        byStatus[key] = (byStatus[key] || 0) + (l.totalCents || 0);
      }
      const preventivo = {
        ...(prevPv || {}),
        version: prevPv?.version || "20261029a",
        updated: new Date().toISOString(),
        scenario: prevPv?.scenario || "economico",
        params: {
          title: prevPv?.params?.title || data.trip?.title || "",
          destination: dest,
          start,
          end,
          travelers,
          currency: prevPv?.params?.currency || "EUR",
          airportIn: prevPv?.params?.airportIn || "",
          departureCity: prevPv?.params?.departureCity || "",
        },
        totals: {
          groupCents,
          perPersonCents: Math.round(groupCents / travelers),
          perDayPpCents: Math.round(groupCents / travelers / Math.max(1, Number(esim?.days) || 1)),
          byStatus,
        },
        lines,
        esim,
      };
      const trip = { ...data.trip };
      const meta = { ...(trip.meta && typeof trip.meta === "object" ? trip.meta : {}) };
      meta.preventivo = preventivo;
      trip.meta = meta;
      trip.notes =
        typeof window.__pvStripPreventivoNotes === "function"
          ? window.__pvStripPreventivoNotes(trip.notes)
          : String(trip.notes || "")
              .replace(/\n\n\[Preventivo [^\]]*\][^\n]*/g, "")
              .trim();
      const saved = await saveTrip(auth, trip, data.revision);
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
      window.dispatchEvent(new CustomEvent("pv-preventivo-synced", { detail: { tripId: auth.id } }));
      if (status) status.textContent = "Preventivo salvato nella sezione (non nelle note).";
      injectPreventivoTripBanner();
      await renderTripPreventivoSection();
    } catch (err) {
      if (status) status.textContent = err.message || "Salvataggio non riuscito.";
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  if (!window.__pvPreventivoBannerBound) {
    window.__pvPreventivoBannerBound = true;
    window.addEventListener("pv-preventivo-synced", () => {
      try {
        injectPreventivoTripBanner();
      } catch {
        /* ignore */
      }
    });
    document.addEventListener(
      "click",
      (ev) => {
        const tab = ev.target?.closest?.(".pv-tab-preventivo, .main-tabs [role='tab'], .main-tabs button");
        if (!tab) return;
        const isPreventivo =
          tab.classList?.contains("pv-tab-preventivo") || /Preventivo/i.test(tab.textContent || "");
        if (!isPreventivo) return;
        const fill = () => {
          mountPreventivoTabPanel();
          void renderTripPreventivoSection();
        };
        requestAnimationFrame(fill);
        setTimeout(fill, 40);
        setTimeout(fill, 160);
      },
      true
    );
    window.__pvOpenTripPreventivoSection = openTripPreventivoSection;
  }

  function ensureShareToast() {
    if (window.__pvShareToastBound) return;
    window.__pvShareToastBound = true;
    window.addEventListener("pv-share-blocked", (ev) => {
      const msg = ev?.detail?.message || "Condivisione non pronta.";
      let el = document.getElementById("pv-share-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "pv-share-toast";
        el.style.cssText =
          "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:120000;max-width:min(420px,92vw);background:#7a1f1f;color:#fff;padding:12px 14px;border-radius:12px;font:600 13px/1.35 inherit;box-shadow:0 10px 30px rgba(0,0,0,.25)";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      clearTimeout(el._t);
      el._t = setTimeout(() => el.remove(), 5200);
    });
  }

  function tick() {
    renderFab();
    injectPackingTemplates();
    injectBudgetAndCharts();
    injectDistancesAndLegend();
    bindDayStripWeather();
    injectFxCalculator();
    void syncDayWeather(false);
    injectLinksAfterNotes();
    void enhanceExpenseCurrencyField();
    markPrivateBudgetLabels();
    injectLocalOnlyBanner();
    injectPreventivoTripBanner();
    fixItalianTappeGrammar();
    preferIcelandCover();
    ensureShareToast();
    injectCloudStatusBanner();
  }

  function markPrivateBudgetLabels() {
    for (const span of document.querySelectorAll("label.field > span")) {
      const t = (span.textContent || "").trim();
      if (/^Budget opzionale/i.test(t)) span.textContent = "Budget privato (€)";
      if (/^Budget del viaggio$/i.test(t) && !span.dataset.pvPrivate) {
        span.dataset.pvPrivate = "1";
        span.insertAdjacentHTML(
          "beforeend",
          ` <em class="pv-private-tag" style="font-style:normal;margin-left:6px;padding:2px 8px;border-radius:999px;background:#eef6f6;color:#3c5c62;font-size:.7rem;font-weight:700">PRIVATO</em>`
        );
      }
    }
    for (const el of document.querySelectorAll(".budget-card .eyebrow, .money-stats span")) {
      const t = (el.textContent || "").trim();
      if (
        !el.dataset.pvPrivate &&
        (/IL BUDGET/i.test(t) || /^Budget del viaggio$/i.test(t))
      ) {
        el.dataset.pvPrivate = "1";
        el.textContent = "IL TUO BUDGET PRIVATO";
      }
    }
  }

  const obs = new MutationObserver(() => {
    if (tick._running) return;
    clearTimeout(tick._t);
    tick._t = setTimeout(() => {
      tick._running = true;
      try {
        tick();
      } finally {
        // Allow a short quiet window so our own DOM writes don't re-enter immediately.
        setTimeout(() => {
          tick._running = false;
        }, 400);
      }
    }, 400);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", () => {
    weatherCache = null;
    weatherShownForDay = null;
    fxDoneKey = "";
    magicTripCache = null;
    tripLoadCache = null;
    tripLoadInflight = null;
    chatPlaces = [];
    chatHistory = [];
    chatAskBusy = false;
    pendingPois = [];
    delete document.documentElement.dataset.pvDistAttempted;
    setMagicOpen(false);
    document.querySelectorAll(".pv-useful,.pv-fx-box,.pv-fx-calc,.pv-day-weather,.pv-links-box").forEach((el) => el.remove());
    const root = document.getElementById(ROOT_ID);
    if (root) root.innerHTML = "";
    setTimeout(tick, 300);
  });
  setTimeout(tick, 800);
  setTimeout(tick, 2000);
})();
