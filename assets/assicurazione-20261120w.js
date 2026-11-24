/**
 * Pronti? VIA! — Assicurazione viaggio (condivisa).
 * Sezione disponibile in Prepara e In viaggio: analizza certificati PDF
 * e mostra polizza, contatti e massimali a portata di click.
 */
(() => {
  if (window.__pvAssicurazioneBound) return;
  window.__pvAssicurazioneBound = true;

  const STYLE_ID = "pv-assicurazione-css";
  const STYLE_VER = "20261120w";
  const SECTION = "insurance";
  const PANEL_ID = "pv-insurance-panel";
  const TAB_ID = "pv-insurance-tab";
  /** SPA panels we hid while Assicurazione was open — restore all on leave. */
  const hiddenByInsurance = new Set();

  function tripAuth() {
    try {
      const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const id = hash.get("trip");
      const key = hash.get("key");
      if (id && key) return { id, key };
    } catch {
      /* ignore */
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (style && style.dataset.pvReady === STYLE_VER) return;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.dataset.pvReady = STYLE_VER;
    style.textContent = `
      #${TAB_ID}{
        appearance:none;border:0;background:transparent;font:inherit;cursor:pointer;
        display:inline-flex;align-items:center;gap:6px;padding:14px 11px;color:inherit;
      }
      #${PANEL_ID}{
        display:none;min-width:0;padding:0;border:0;background:transparent;
      }
      #${PANEL_ID}.pv-ins-open{display:flex;flex-direction:column;gap:1rem}
      #${PANEL_ID} .section-heading{
        display:flex;align-items:center;gap:10px;margin:0;
      }
      #${PANEL_ID} .section-heading h2{
        margin:0;font-family:var(--diary-display, Georgia, serif);
        font-size:clamp(1.2rem,3.2vw,1.45rem);letter-spacing:-.02em;color:var(--diary-ink,#12343c);
        display:flex;align-items:center;gap:8px;
      }
      #${PANEL_ID} .section-heading svg{width:20px;height:20px;flex:0 0 auto}
      #${PANEL_ID} .pv-section-guide{
        margin:0;color:var(--diary-muted,#3f5860);font-size:.92rem;line-height:1.4;max-width:42rem;
      }
      #${PANEL_ID} .pv-ins-toolbar{
        display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;
      }
      #${PANEL_ID} .pv-ins-toolbar label,
      #${PANEL_ID} .pv-ins-toolbar button{
        appearance:none;border:1px solid var(--diary-line,#d5e3e6);border-radius:10px;
        padding:9px 14px;background:var(--diary-paper,#fff);color:var(--diary-ink,#0f3a40);
        font:650 13px inherit;cursor:pointer;min-height:40px;
      }
      #${PANEL_ID} .pv-ins-toolbar label{
        display:inline-flex;align-items:center;gap:8px;
        background:color-mix(in srgb, var(--diary-accent,#007d82) 10%, #fff);
        border-color:color-mix(in srgb, var(--diary-accent,#007d82) 28%, var(--diary-line,#d5e3e6));
      }
      #${PANEL_ID} .pv-ins-toolbar button[data-pv-ins-clear]{
        background:transparent;color:var(--diary-muted,#5b7380);font-weight:600;
      }
      #${PANEL_ID} .pv-ins-toolbar input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      #${PANEL_ID} .pv-ins-status{font-size:.8rem;color:var(--diary-muted,#5b7380)}
      #${PANEL_ID} .pv-ins-body{display:flex;flex-direction:column;gap:1.25rem}
      #${PANEL_ID} .pv-ins-title{
        margin:0;font-size:1.15rem;line-height:1.25;color:var(--diary-ink,#12343c);letter-spacing:-.01em;
      }
      #${PANEL_ID} .pv-ins-meta{
        margin:.35rem 0 0;color:var(--diary-muted,#3f5860);font-size:.9rem;line-height:1.45;
      }
      #${PANEL_ID} .pv-ins-meta b{color:var(--diary-ink,#12343c);font-weight:700}
      #${PANEL_ID} .pv-ins-sos{
        display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-decoration:none;
        padding:14px 16px;border-radius:12px;color:#fff;
        background:var(--diary-accent,#007d82);
        min-height:56px;justify-content:center;
      }
      #${PANEL_ID} .pv-ins-sos span{
        font-size:.72rem;font-weight:750;letter-spacing:.04em;text-transform:uppercase;opacity:.88;
      }
      #${PANEL_ID} .pv-ins-sos strong{font-size:1.15rem;font-weight:750;letter-spacing:.01em}
      #${PANEL_ID} .pv-ins-links{
        display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;
        border-top:1px solid var(--diary-line,#d5e3e6);
      }
      #${PANEL_ID} .pv-ins-links a{
        display:flex;justify-content:space-between;align-items:baseline;gap:12px;
        padding:11px 2px;border-bottom:1px solid var(--diary-line,#d5e3e6);
        text-decoration:none;color:var(--diary-ink,#12343c);font-size:.95rem;
      }
      #${PANEL_ID} .pv-ins-links a span{color:var(--diary-muted,#5b7380);font-size:.82rem;font-weight:650}
      #${PANEL_ID} .pv-ins-links a strong{font-weight:700;text-align:right;word-break:break-word}
      #${PANEL_ID} .pv-ins-block h3{
        margin:0 0 .55rem;font-size:.78rem;font-weight:800;letter-spacing:.05em;
        text-transform:uppercase;color:var(--diary-muted,#5b7380);
      }
      #${PANEL_ID} .pv-ins-people{margin:0;padding:0;list-style:none}
      #${PANEL_ID} .pv-ins-people li{
        display:flex;justify-content:space-between;gap:12px;align-items:baseline;
        padding:9px 0;border-bottom:1px solid color-mix(in srgb, var(--diary-line,#d5e3e6) 70%, transparent);
        font-size:.92rem;
      }
      #${PANEL_ID} .pv-ins-people li:last-child{border-bottom:0}
      #${PANEL_ID} .pv-ins-people strong{font-weight:700;color:var(--diary-ink,#12343c)}
      #${PANEL_ID} .pv-ins-people span{
        color:var(--diary-muted,#5b7380);font-size:.78rem;font-variant-numeric:tabular-nums;text-align:right;
      }
      #${PANEL_ID} .pv-ins-cover{
        display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:baseline;
        padding:8px 0;border-bottom:1px solid color-mix(in srgb, var(--diary-line,#d5e3e6) 70%, transparent);
        font-size:.9rem;
      }
      #${PANEL_ID} .pv-ins-cover:last-child{border-bottom:0}
      #${PANEL_ID} .pv-ins-cover strong{font-weight:650;color:var(--diary-ink,#12343c)}
      #${PANEL_ID} .pv-ins-cover em{
        font-style:normal;font-weight:750;color:var(--diary-accent,#007d82);white-space:nowrap;
      }
      #${PANEL_ID} .pv-ins-details{
        border:0;border-top:1px solid var(--diary-line,#d5e3e6);padding:0;margin:0;
      }
      #${PANEL_ID} .pv-ins-details > summary{
        cursor:pointer;list-style:none;padding:12px 2px;font:700 .92rem inherit;
        color:var(--diary-ink,#12343c);display:flex;justify-content:space-between;align-items:center;
      }
      #${PANEL_ID} .pv-ins-details > summary::-webkit-details-marker{display:none}
      #${PANEL_ID} .pv-ins-details > summary::after{
        content:"+";font-weight:700;color:var(--diary-muted,#5b7380);font-size:1.1rem;line-height:1;
      }
      #${PANEL_ID} .pv-ins-details[open] > summary::after{content:"–"}
      #${PANEL_ID} .pv-ins-details .pv-ins-detail-body{padding:0 0 8px;display:grid;gap:1rem}
      #${PANEL_ID} .pv-ins-facts{
        display:grid;gap:6px 16px;margin:0;
        grid-template-columns:minmax(7rem,28%) 1fr;font-size:.9rem;
      }
      #${PANEL_ID} .pv-ins-facts dt{margin:0;color:var(--diary-muted,#5b7380)}
      #${PANEL_ID} .pv-ins-facts dd{margin:0;font-weight:700;color:var(--diary-ink,#12343c);word-break:break-word}
      #${PANEL_ID} .pv-ins-empty{
        padding:1.25rem 0;color:var(--diary-muted,#3f5860);font-size:.95rem;line-height:1.45;max-width:36rem;
      }
      #${PANEL_ID} .pv-ins-empty strong{display:block;margin:0 0 4px;color:var(--diary-ink,#12343c);font-size:1.05rem}
      @media (max-width:560px){
        #${PANEL_ID} .pv-ins-facts{grid-template-columns:1fr}
        #${PANEL_ID} .pv-ins-people li{flex-direction:column;gap:2px;align-items:flex-start}
        #${PANEL_ID} .pv-ins-people span{text-align:left}
      }
    `;
  }

  function cleanDup(text) {
    // PDF text often doubles labels ("Nome:Nome:") or long tokens ("PremioPremio"),
    // but must NOT collapse normal doubles like "Viaggio" / "https".
    return String(text || "")
      .replace(/([A-Za-zÀ-ÿ]{4,})\1/g, "$1")
      .replace(/([A-Za-zÀ-ÿ ]{2,}:)\s*\1/gi, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function firstMatch(text, re) {
    const m = String(text || "").match(re);
    if (!m) return "";
    const raw = m[1] != null ? m[1] : m[0];
    return cleanDup(raw);
  }

  function parseEuro(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    // Italian thousands + decimal: 1.234,56
    if (/,/.test(s)) {
      const n = Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    // Thousands only: 1.000
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      return Number(s.replace(/\./g, ""));
    }
    // Dot as decimal: 101.85
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function formatEuro(n) {
    if (n == null || !Number.isFinite(n)) return "";
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
  }

  function parseInsuranceCertificate(rawText) {
    const text = String(rawText || "").replace(/\u00a0/g, " ");
    if (!text.trim()) return null;

    const policyNumber =
      firstMatch(text, /\b(HEY\d{5,})\b/i) ||
      firstMatch(text, /Numero di polizza[:\s]*([A-Z0-9]{6,})/i) ||
      firstMatch(text, /\bpolizza[:\s#]*([A-Z0-9/-]{6,})\b/i);

    const product =
      firstMatch(text, /(Viaggio Premium|Viaggio Essenziale|Viaggio Completo|Travel\s+\w+)/i) ||
      ( /heymondo/i.test(text) ? "Assicurazione viaggio" : "Polizza viaggio" );

    const provider =
      firstMatch(text, /(IMA Italia Assistance(?:\s+S\.?p\.?A\.?)?)/i) ||
      firstMatch(text, /(Heymondo)/i) ||
      "Assicuratore";

    const destination =
      firstMatch(text, /\b(Ghana|Islanda|Italia|Spagna|Francia|Portogallo|Giappone|USA|Stati Uniti|Regno Unito|Germania|Marocco|Egitto|Thailandia|India|Brasile|Messico|Canada|Australia)\b/i) ||
      firstMatch(text, /Destinazione[:\s]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,40})/i);

    const start =
      firstMatch(text, /Data inizio[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i) ||
      firstMatch(text, /(\d{2}\/\d{2}\/\d{4}).{0,40}(\d{2}\/\d{2}\/\d{4})/i) ||
      firstMatch(text, /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);

    // Prefer explicit end after start-ish patterns from Heymondo block
    let end = firstMatch(text, /Data fine[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
    if (!end) {
      const dates = [...text.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map((m) => m[1]);
      if (dates.length >= 2) end = dates[1];
    }

    // Heymondo layout: "Simone 01/08/2027 Cecire 13/08/2027"
    const heymondoDates = text.match(
      /([A-Za-zÀ-ÿ]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Za-zÀ-ÿ]+)\s+(\d{2}\/\d{2}\/\d{4})/
    );
    const startDate = heymondoDates ? heymondoDates[2] : start;
    const endDate = heymondoDates ? heymondoDates[4] : end;
    const contractorFirst = heymondoDates ? heymondoDates[1] : "";
    const contractorLast = heymondoDates ? heymondoDates[3] : "";

    const fiscalCode =
      firstMatch(text, /Codice fiscale[:\s]*([A-Z0-9]{11,16})/i) ||
      firstMatch(text, /\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/);

    const emergencyPhone =
      firstMatch(text, /telefonando al numero[:\s]*(\+?\d[\d\s.]{7,}\d)/i) ||
      firstMatch(text, /(\+39\s*02\s*2412\s*8782)/);

    // Prefer mobile (+39 3…) as personal phone; avoid assistance landline
    const phone =
      firstMatch(text, /(\+39\s*3\d[\d\s]{7,}\d)/) ||
      firstMatch(text, /(\+393\d{8,})/) ||
      firstMatch(text, /Telefono[:\s]*(\+?\d[\d\s]{7,}\d)/i) ||
      "";

    const email = firstMatch(text, /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);

    const contractorName =
      [contractorFirst, contractorLast].filter(Boolean).join(" ") ||
      firstMatch(text, /Nome[:\s]*([A-Za-zÀ-ÿ' -]+).*?Cognome[:\s]*([A-Za-zÀ-ÿ' -]+)/is)?.replace(/\s+/g, " ") ||
      "";

    // Travelers table: full uppercase name + codice fiscale
    const travelers = [];
    const travelerBlock =
      text.match(/Viaggiatori Assicurati([\s\S]{0,2500}?)(?:Certificato di assicurazione|Chat medica|Assistenza in viaggio)/i)?.[1] ||
      text;
    const travelerRe =
      /\b([A-ZÀ-Ÿ][A-ZÀ-Ÿ' ]{2,60}?)\s+([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/g;
    for (const m of travelerBlock.matchAll(travelerRe)) {
      const name = cleanDup(m[1]).replace(/\s+/g, " ").trim();
      const cf = m[2];
      if (/NOME|COGNOME|CODICE|FISCALE|PAGINA|DISTRIBUITO|SOTTOSCRITTO/i.test(name)) continue;
      if (travelers.some((t) => t.fiscalCode === cf)) continue;
      travelers.push({ name, fiscalCode: cf });
    }
    if (contractorName && fiscalCode && !travelers.some((t) => t.fiscalCode === fiscalCode)) {
      travelers.unshift({ name: contractorName.toUpperCase(), fiscalCode });
    }

    const insuredCount =
      Number(firstMatch(text, /Numero di assicurati[:\s]*(\d+)/i)) ||
      travelers.length ||
      null;

    const coverages = [];
    const coverageLines = [
      ["Assistenza", /ASSISTENZA\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i],
      ["Spese mediche in viaggio", /SPESE MEDICHE IN VIAGGIO\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i],
      ["Bagaglio", /BAGAGLIO\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i],
      ["Perdite pecuniarie", /PERDITE PECUNIARIE\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i],
      ["Infortuni", /INFORTUNI\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i],
    ];
    for (const [label, re] of coverageLines) {
      const m = text.match(re);
      if (!m) continue;
      const total = formatEuro(parseEuro(m[3])) || `${m[3]} €`;
      coverages.push({ label, premium: total });
    }

    // Massimali highlights
    const limits = [];
    const limitPairs = [
      ["Spese mediche (fino a 74 anni)", /Spese mediche per viaggiatori\s*fino a 74 anni\s*(Illimitato|[\d.]+ ?€)/i],
      ["Spese mediche (>74 anni)", /più di 74 anni\s*([\d.]+ ?€)/i],
      ["Spese odontoiatriche urgenti", /Spese odontoiatriche urgenti\s*([\d.]+ ?€)/i],
      ["Bagaglio (smarrimento/danni)", /danneggiamento\s*([\d.]+ ?€)/i],
      ["Ritardo bagaglio", /Ritardo consegna bagaglio[\s\S]{0,40}?([\d.]+ ?€)/i],
      ["Trasporto sanitario", /Trasporto sanitario\s*(Illimitato|[\d.]+ ?€)/i],
    ];
    for (const [label, re] of limitPairs) {
      const m = text.match(re);
      if (m) limits.push({ label, value: cleanDup(m[1]) });
    }

    const premiumFinal =
      formatEuro(parseEuro(firstMatch(text, /Premio finale[:\s]*([\d.,]+)\s*€/i))) ||
      firstMatch(text, /Premio finale[:\s]*([\d.,]+)\s*€/i);
    const totalCost =
      formatEuro(parseEuro(firstMatch(text, /Costo totale[:\s]*([\d.,]+)\s*€/i))) ||
      firstMatch(text, /Costo totale[:\s]*([\d.,]+)\s*€/i);

    const portalMatch = text.match(/https?:\/\/(?:www\.)?heymondo\.[a-z.]+/i);
    const portalUrl = portalMatch
      ? portalMatch[0].replace(/(heymondo\.[a-z]+)(?:\1)+/i, "$1").replace(/\/$/, "")
      : /heymondo/i.test(text)
        ? "https://www.heymondo.it"
        : "";
    const airhelpMatch = text.match(/https?:\/\/app\.airhelp\.com\/[^\s)"']+/i);
    const airhelpUrl = airhelpMatch
      ? airhelpMatch[0].replace(/(https?:\/\/app\.airhelp\.com\/[^\s)"']+?)\1+/i, "$1")
      : /airhelp/i.test(text)
        ? "https://app.airhelp.com/partners/heymondo_italy?lang=it"
        : "";

    const signedAt = firstMatch(text, /Data della stipula[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);

    if (!policyNumber && !travelers.length && !emergencyPhone && !product) return null;

    return {
      source: "pdf",
      product,
      policyNumber,
      provider,
      destination,
      startDate: cleanDup(startDate),
      endDate: cleanDup(endDate),
      signedAt,
      contractorName,
      fiscalCode,
      phone,
      emergencyPhone,
      email,
      insuredCount,
      travelers,
      coverages,
      limits,
      premiumFinal: cleanDup(premiumFinal),
      totalCost: cleanDup(totalCost),
      portalUrl,
      airhelpUrl,
      updatedAt: new Date().toISOString(),
    };
  }

  window.__pvParseInsuranceCertificate = parseInsuranceCertificate;

  async function readPdfText(file) {
    const mod = await import(`/Pronti-VIA-Web/assets/event-pdf.mjs?v=${STYLE_VER}`);
    return mod.readEventPdf(file);
  }

  async function loadTripBundle() {
    const auth = tripAuth();
    if (!auth) throw new Error("Apri un viaggio");
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Caricamento non riuscito");
    return { auth, data };
  }

  async function saveInsurance(insurance) {
    const { auth, data } = await loadTripBundle();
    const trip = structuredClone(data.trip || {});
    trip.meta = { ...(trip.meta || {}), insurance };
    const res = await fetch(`/api/trips/${encodeURIComponent(auth.id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({ trip, revision: data.revision }),
    });
    const saved = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(saved.error || "Salvataggio non riuscito");
    try {
      const store = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
      if (store[auth.id]) {
        store[auth.id].trip = saved.trip || trip;
        localStorage.setItem("viavia-local-trips-v1", JSON.stringify(store));
      }
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("pv-trip-loaded", { detail: { id: auth.id, trip: saved.trip || trip } })
    );
    return saved.trip?.meta?.insurance || insurance;
  }

  function readCachedInsurance() {
    const auth = tripAuth();
    if (!auth) return null;
    try {
      const row = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}")[auth.id];
      return row?.trip?.meta?.insurance || null;
    } catch {
      return null;
    }
  }

  function telHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : "";
  }

  function factHtml(label, value) {
    if (!value) return "";
    return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
  }

  function linkItem(label, value, href) {
    if (!value || !href) return "";
    const external = href.startsWith("http")
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    return `<li><a href="${escapeHtml(href)}"${external}><span>${escapeHtml(
      label
    )}</span><strong>${escapeHtml(value)}</strong></a></li>`;
  }

  function renderInsurance(panel, insurance) {
    const body = panel.querySelector(".pv-ins-body");
    if (!body) return;
    if (!insurance) {
      body.innerHTML = `
        <div class="pv-ins-empty">
          <strong>Nessuna polizza ancora</strong>
          Carica il certificato PDF: contatti di emergenza, assicurati e massimali restano condivisi con il gruppo.
        </div>`;
      return;
    }

    const metaParts = [
      insurance.destination,
      [insurance.startDate, insurance.endDate].filter(Boolean).join(" → ") || "",
      insurance.insuredCount ? `${insurance.insuredCount} assicurati` : "",
      insurance.policyNumber ? `n. ${insurance.policyNumber}` : "",
    ].filter(Boolean);

    const secondary = [
      insurance.phone && insurance.phone !== insurance.emergencyPhone
        ? linkItem("Telefono", insurance.phone, telHref(insurance.phone))
        : "",
      linkItem("Email", insurance.email, insurance.email ? `mailto:${insurance.email}` : ""),
      linkItem("Area polizza", "Apri", insurance.portalUrl),
      linkItem("AirHelp", "Reclamo volo", insurance.airhelpUrl),
    ].filter(Boolean);

    const facts = [
      factHtml("Compagnia", insurance.provider),
      factHtml("Polizza", insurance.policyNumber),
      factHtml("Contraente", insurance.contractorName),
      factHtml("Codice fiscale", insurance.fiscalCode),
      factHtml("Stipula", insurance.signedAt),
      factHtml("Premio", insurance.premiumFinal || insurance.totalCost),
    ].filter(Boolean);

    const limits = (insurance.limits || [])
      .map(
        (c) =>
          `<div class="pv-ins-cover"><strong>${escapeHtml(c.label)}</strong><em>${escapeHtml(
            c.value
          )}</em></div>`
      )
      .join("");

    body.innerHTML = `
      <div>
        <p class="pv-ins-title">${escapeHtml(insurance.product || "Assicurazione viaggio")}</p>
        ${
          metaParts.length
            ? `<p class="pv-ins-meta">${metaParts
                .map((p, i) => (i === 0 ? `<b>${escapeHtml(p)}</b>` : escapeHtml(p)))
                .join(" · ")}</p>`
            : ""
        }
      </div>
      ${
        insurance.emergencyPhone
          ? `<a class="pv-ins-sos" href="${escapeHtml(telHref(insurance.emergencyPhone))}">
              <span>Assistenza 24h</span>
              <strong>${escapeHtml(insurance.emergencyPhone)}</strong>
            </a>`
          : ""
      }
      ${secondary.length ? `<ul class="pv-ins-links">${secondary.join("")}</ul>` : ""}
      ${
        insurance.travelers?.length
          ? `<div class="pv-ins-block">
              <h3>Assicurati</h3>
              <ul class="pv-ins-people">${insurance.travelers
                .map(
                  (t) =>
                    `<li><strong>${escapeHtml(t.name)}</strong>${
                      t.fiscalCode ? `<span>${escapeHtml(t.fiscalCode)}</span>` : ""
                    }</li>`
                )
                .join("")}</ul>
            </div>`
          : ""
      }
      ${
        facts.length || limits
          ? `<details class="pv-ins-details">
              <summary>Dettagli e massimali</summary>
              <div class="pv-ins-detail-body">
                ${facts.length ? `<dl class="pv-ins-facts">${facts.join("")}</dl>` : ""}
                ${
                  limits
                    ? `<div class="pv-ins-block"><h3>Massimali</h3>${limits}</div>`
                    : ""
                }
              </div>
            </details>`
          : ""
      }
    `;
  }

  async function handleUpload(file, panel) {
    const status = panel.querySelector(".pv-ins-status");
    if (!file) return;
    if (status) status.textContent = "Analizzo il certificato…";
    try {
      const text = await readPdfText(file);
      const parsed = parseInsuranceCertificate(text);
      if (!parsed) throw new Error("Non riconosco una polizza viaggio in questo PDF");
      parsed.sourceFileName = file.name || "certificato.pdf";
      const saved = await saveInsurance(parsed);
      renderInsurance(panel, saved);
      if (status) status.textContent = `Aggiornato da ${file.name}`;
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? err.message : "Analisi non riuscita";
    }
  }

  function ensurePanelShell() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    const host =
      document.querySelector("#root .primary-panel") ||
      document.querySelector("#root [role='tabpanel']")?.parentElement;
    if (!host) return null;
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "tabpanel");
    panel.dataset.pvSection = SECTION;
    panel.innerHTML = `
      <div class="section-heading">
        <h2>
          <span class="pv-section-icon" aria-hidden="true">${
            window.__pvInsuranceIconSvg ||
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>'
          }</span>
          Assicurazione
        </h2>
      </div>
      <p class="pv-section-guide">Polizza del gruppo: assistenza e massimali a un tocco.</p>
      <div class="pv-ins-toolbar">
        <label>
          <input type="file" accept="application/pdf,.pdf" />
          Carica PDF
        </label>
        <button type="button" data-pv-ins-clear hidden>Rimuovi</button>
        <span class="pv-ins-status"></span>
      </div>
      <div class="pv-ins-body"></div>
    `;
    host.appendChild(panel);
    const input = panel.querySelector('input[type="file"]');
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      void handleUpload(file, panel).finally(() => {
        input.value = "";
      });
    });
    panel.querySelector("[data-pv-ins-clear]")?.addEventListener("click", async () => {
      try {
        await saveInsurance(null);
        renderInsurance(panel, null);
        const status = panel.querySelector(".pv-ins-status");
        if (status) status.textContent = "Polizza rimossa";
        syncClearButton(panel, null);
      } catch (err) {
        const status = panel.querySelector(".pv-ins-status");
        if (status) status.textContent = err instanceof Error ? err.message : "Rimozione non riuscita";
      }
    });
    return panel;
  }

  function syncClearButton(panel, insurance) {
    const btn = panel.querySelector("[data-pv-ins-clear]");
    if (btn) btn.hidden = !insurance;
  }

  function ensureTab() {
    const tabs = document.querySelector("#root .main-tabs");
    if (!tabs) return null;
    let tab = document.getElementById(TAB_ID);
    if (tab) return tab;
    tab = document.createElement("button");
    tab.type = "button";
    tab.id = TAB_ID;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", PANEL_ID);
    tab.dataset.pvPhase = "both";
    tab.dataset.pvTab = SECTION;
    tab.dataset.pvIcon = "insurance";
    tab.setAttribute("aria-label", "Assicurazione");
    tab.innerHTML = `${
      window.__pvInsuranceIconSvg ||
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>'
    } Assicurazione`;
    tabs.appendChild(tab);
    tab.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openInsuranceSection();
    });
    return tab;
  }

  function restoreHiddenSpaPanels() {
    for (const other of hiddenByInsurance) {
      try {
        other.hidden = false;
        other.removeAttribute("hidden");
        other.style.removeProperty("display");
      } catch {
        /* node may be detached */
      }
    }
    hiddenByInsurance.clear();
  }

  function openInsuranceSection() {
    const tabs = document.querySelector("#root .main-tabs");
    const tab = ensureTab();
    const panel = ensurePanelShell();
    if (!tab || !panel) return;

    restoreHiddenSpaPanels();

    // Deselect SPA tabs / hide SPA panels (attribute only — never permanent display:none)
    tabs?.querySelectorAll('[role="tab"]').forEach((el) => {
      if (el === tab) return;
      el.setAttribute("aria-selected", "false");
      el.setAttribute("data-state", "inactive");
      const controls = el.getAttribute("aria-controls");
      const other = controls && document.getElementById(controls);
      if (other && other !== panel) {
        hiddenByInsurance.add(other);
        other.hidden = true;
        other.setAttribute("hidden", "");
      }
    });
    tab.setAttribute("aria-selected", "true");
    tab.setAttribute("data-state", "active");
    panel.classList.add("pv-ins-open");
    panel.hidden = false;
    panel.removeAttribute("hidden");
    panel.style.display = "block";

    const insurance = readCachedInsurance();
    renderInsurance(panel, insurance);
    syncClearButton(panel, insurance);
    // Refresh from server in background
    void loadTripBundle()
      .then(({ data }) => {
        const next = data.trip?.meta?.insurance || null;
        renderInsurance(panel, next);
        syncClearButton(panel, next);
      })
      .catch(() => {});
  }

  function closeInsuranceIfSpaTabActive() {
    const tabs = document.querySelector("#root .main-tabs");
    const tab = document.getElementById(TAB_ID);
    const panel = document.getElementById(PANEL_ID);
    if (!tabs || !tab || !panel) return;
    const active = tabs.querySelector('[role="tab"][aria-selected="true"], [role="tab"][data-state="active"]');
    if (active && active !== tab) {
      tab.setAttribute("aria-selected", "false");
      tab.setAttribute("data-state", "inactive");
      panel.classList.remove("pv-ins-open");
      panel.hidden = true;
      panel.style.display = "none";
      restoreHiddenSpaPanels();
    }
  }

  function placeTabInOrder() {
    const tabs = document.querySelector("#root .main-tabs");
    const tab = document.getElementById(TAB_ID);
    if (!tabs || !tab) return;
    const phase = document.documentElement.dataset.pvTripPhase || "prep";
    // Visible in both phases; sit near bookings/documents.
    tab.style.order = phase === "trip" ? "6" : "4";
    tab.dataset.pvPhase = "both";
  }

  function tick() {
    if (!tripAuth()) {
      restoreHiddenSpaPanels();
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      return;
    }
    ensureStyles();
    ensureTab();
    ensurePanelShell();
    placeTabInOrder();
    closeInsuranceIfSpaTabActive();
  }

  window.__pvOpenInsuranceSection = openInsuranceSection;

  let tickTimer = null;
  const mo = new MutationObserver(() => {
    if (tickTimer) return;
    tickTimer = setTimeout(() => {
      tickTimer = null;
      tick();
    }, 80);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 1200);
  tick();
})();
