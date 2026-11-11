/**
 * Trip invite landing + Open Graph preview.
 * GET /invito/:shareId  → HTML with og:* meta + redirect into the SPA hash.
 * Share crawlers (WhatsApp, iMessage, Telegram, Slack…) read the meta tags;
 * humans are sent to /#trip=…&key=…&s=n:…
 */
import { createKv } from "./_store.mjs";

const shareKv = createKv("pronti-via-shares");

function inviteIdFromPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.rawUrl,
    event.headers?.["x-forwarded-url"],
  ]
    .filter(Boolean)
    .map(String);
  for (const raw of candidates) {
    let pathOnly = raw;
    try {
      if (/^https?:/i.test(raw)) pathOnly = new URL(raw).pathname;
    } catch {
      /* keep */
    }
    const m = pathOnly.match(
      /\/(?:\.netlify\/functions\/invite|invito|api\/invite)\/?([^/?#]+)?/i
    );
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  const splat = event.pathParameters?.splat || event.params?.splat;
  if (splat) return Array.isArray(splat) ? String(splat[0] || "") : String(splat);
  return "";
}

function siteOrigin(event) {
  const proto = String(event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(
    event.headers?.["x-forwarded-host"] || event.headers?.host || "pronti-via-k7es.netlify.app"
  )
    .split(",")[0]
    .trim();
  return `${proto}://${host}`.replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRange(start, end) {
  const fmt = (iso) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${iso}T12:00:00`)
      );
    } catch {
      return String(iso);
    }
  };
  const a = fmt(start);
  const b = fmt(end);
  if (a && b) return `${a} → ${b}`;
  return a || b || "";
}

function buildInviteCopy(preview) {
  const title = String(preview?.title || "un viaggio").trim() || "un viaggio";
  const destination = String(preview?.destination || "").trim();
  const when = formatRange(preview?.start, preview?.end);
  const bits = [destination, when].filter(Boolean).join(" · ");
  return {
    title: `Invito · ${title}`,
    headline: `Sei invitato a «${title}»`,
    description: bits
      ? `Sei invitato a «${title}» · ${bits}. Apri Pronti? VIA! per entrare nel viaggio.`
      : `Sei invitato a «${title}». Apri Pronti? VIA! per entrare nel viaggio.`,
    bits,
  };
}

function renderInviteHtml({ origin, shareId, record, missing }) {
  const trip = record?.trip && typeof record.trip === "object" ? record.trip : {};
  const preview = {
    title: trip.title || record?.title || "Viaggio",
    destination: trip.destination || "",
    start: trip.start || "",
    end: trip.end || "",
  };
  const copy = buildInviteCopy(preview);
  const tripId = String(record?.id || "").trim();
  const accessKey = String(record?.key || record?.viewToken || "").trim();
  const hash = new URLSearchParams();
  if (tripId) hash.set("trip", tripId);
  if (accessKey) hash.set("key", accessKey);
  hash.set("s", `n:${shareId}`);
  const appUrl = `${origin}/#${hash.toString()}`;
  const image = `${origin}/assets/pronti-via-apple-180.png`;
  const canonical = `${origin}/invito/${encodeURIComponent(shareId)}`;

  if (missing || !tripId) {
    const fallbackTitle = "Invito non trovato · Pronti? VIA!";
    const fallbackDesc = "Questo invito non è più disponibile o è scaduto.";
    return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(fallbackTitle)}</title>
  <meta name="description" content="${escapeHtml(fallbackDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Pronti? VIA!">
  <meta property="og:title" content="${escapeHtml(fallbackTitle)}">
  <meta property="og:description" content="${escapeHtml(fallbackDesc)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(fallbackTitle)}">
  <meta name="twitter:description" content="${escapeHtml(fallbackDesc)}">
  <meta http-equiv="refresh" content="2;url=${escapeHtml(origin + "/")}">
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font:500 16px/1.45 system-ui,sans-serif;
      color:#12343c;background:linear-gradient(165deg,#e8f6f6,#f7fbfb 55%,#fff)}
    .card{max-width:28rem;margin:24px;padding:28px 24px;border-radius:20px;background:#fff;
      border:1px solid rgba(0,125,130,.16);box-shadow:0 18px 40px rgba(16,48,56,.08)}
    h1{margin:0 0 8px;font-size:1.35rem} p{margin:0 0 16px;color:#3f5860}
    a{color:#007d82;font-weight:700}
  </style>
</head>
<body>
  <main class="card">
    <h1>Invito non disponibile</h1>
    <p>${escapeHtml(fallbackDesc)}</p>
    <p><a href="${escapeHtml(origin + "/")}">Torna a Pronti? VIA!</a></p>
  </main>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(copy.title)}</title>
  <meta name="description" content="${escapeHtml(copy.description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Pronti? VIA!">
  <meta property="og:title" content="${escapeHtml(copy.title)}">
  <meta property="og:description" content="${escapeHtml(copy.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:locale" content="it_IT">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(copy.title)}">
  <meta name="twitter:description" content="${escapeHtml(copy.description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}">
  <style>
    :root{--ink:#12343c;--teal:#007d82;--muted:#3f5860}
    body{margin:0;min-height:100vh;display:grid;place-items:center;font:500 16px/1.45 system-ui,sans-serif;
      color:var(--ink);background:
        radial-gradient(900px 420px at 10% -10%,rgba(0,125,130,.18),transparent 60%),
        linear-gradient(165deg,#e7f5f5,#f7fbfb 52%,#fff)}
    .card{width:min(28rem,92vw);padding:28px 24px 22px;border-radius:22px;background:rgba(255,255,255,.92);
      border:1px solid rgba(0,125,130,.16);box-shadow:0 22px 48px rgba(16,48,56,.1);backdrop-filter:blur(8px)}
    .eyebrow{display:inline-block;margin:0 0 10px;padding:5px 10px;border-radius:999px;background:#e7f4f4;
      color:var(--teal);font:750 12px/1 inherit;letter-spacing:.04em;text-transform:uppercase}
    h1{margin:0 0 8px;font-size:1.45rem;letter-spacing:-.02em}
    .bits{margin:0 0 14px;color:var(--muted);font-size:.95rem}
    .msg{margin:0 0 18px;padding:12px 14px;border-radius:14px;background:#f3fbfb;border:1px solid rgba(0,125,130,.12);
      color:var(--ink);font-weight:650}
    a.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;
      border-radius:12px;background:var(--teal);color:#fff;text-decoration:none;font-weight:750}
    .brand{margin:16px 0 0;font-size:.8rem;color:var(--muted)}
  </style>
  <script>
    (function () {
      var target = ${JSON.stringify(appUrl)};
      try { location.replace(target); } catch (e) { location.href = target; }
    })();
  </script>
</head>
<body>
  <main class="card">
    <span class="eyebrow">Invito</span>
    <h1>${escapeHtml(copy.headline)}</h1>
    ${copy.bits ? `<p class="bits">${escapeHtml(copy.bits)}</p>` : ""}
    <p class="msg">Apri Pronti? VIA! per entrare nel viaggio condiviso.</p>
    <a class="cta" href="${escapeHtml(appUrl)}">Apri il viaggio</a>
    <p class="brand">Pronti? VIA! · il viaggio, organizzato insieme</p>
  </main>
</body>
</html>`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  if (String(event.httpMethod || "GET").toUpperCase() !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Metodo non supportato." }),
    };
  }

  const origin = siteOrigin(event);
  let shareId = inviteIdFromPath(event).replace(/^n:/, "").trim();
  // Allow ?s=n:xxx as fallback
  if (!shareId) {
    try {
      const q = new URL(event.rawUrl || `https://x.invalid${event.path || "/"}`).searchParams;
      shareId = String(q.get("s") || q.get("id") || "")
        .replace(/^n:/, "")
        .trim();
    } catch {
      /* ignore */
    }
  }

  let record = null;
  let missing = !shareId;
  if (shareId) {
    try {
      record = await shareKv.getJSON(`share:${shareId}`);
      if (!record) missing = true;
      else if (record.expiresAt && Date.now() > Date.parse(record.expiresAt)) {
        missing = true;
        record = null;
      }
    } catch {
      missing = true;
    }
  }

  const html = renderInviteHtml({ origin, shareId: shareId || "unknown", record, missing });
  return {
    statusCode: missing ? 404 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": missing ? "no-store" : "public, max-age=120",
      "Referrer-Policy": "no-referrer",
    },
    body: html,
  };
}

export { buildInviteCopy, formatRange, renderInviteHtml };
