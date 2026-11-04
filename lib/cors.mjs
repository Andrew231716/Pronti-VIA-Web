/**
 * Shared CORS allowlist for Netlify Functions.
 *
 * Explicit origins only (release 20261104c). No platform-wide
 * `*.vercel.app` / `*.netlify.app` patterns. No `Access-Control-Allow-Origin: *`.
 * Unknown Origins are never reflected.
 *
 * Optional extras: env `CORS_EXTRA_ORIGINS` = comma-separated absolute origins
 * (scheme://host[:port], no path, no wildcard). Invalid entries are ignored.
 */

/** Production + documented local/dev origins actually used by this repo. */
export const ALLOWED_ORIGINS = Object.freeze([
  // GitHub Pages (package.json homepage / live site)
  "https://andrew231716.github.io",
  // Netlify site hosting Functions + Blobs (api-shim NETLIFY_API)
  "https://pronti-via-k7es.netlify.app",
  // Local development (ports used by tooling in this repo)
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
  "http://localhost:3456",
  "http://127.0.0.1:3456",
  "http://localhost:3457",
  "http://127.0.0.1:3457",
]);

/**
 * Validate and normalize a single origin candidate.
 * Accepts only http(s)://host[:port] with empty path — no wildcards, credentials, query, hash.
 */
export function normalizeOriginCandidate(raw) {
  const s = String(raw || "").trim();
  if (!s || s.includes("*")) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (u.username || u.password) return "";
    if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return "";
    if (!u.hostname) return "";
    // Reject anything that is not a plain host (URL will have already parsed IDNA).
    return u.origin;
  } catch {
    return "";
  }
}

function parseExtraOrigins(raw) {
  if (!raw || typeof raw !== "string") return [];
  const out = [];
  const seen = new Set();
  for (const part of raw.split(",")) {
    const origin = normalizeOriginCandidate(part);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

let cachedExtrasKey = null;
let cachedExtras = [];

/** Extra origins from env (validated). */
export function getExtraOrigins(env = process.env) {
  const key = String(env?.CORS_EXTRA_ORIGINS || "");
  if (key !== cachedExtrasKey) {
    cachedExtrasKey = key;
    cachedExtras = parseExtraOrigins(key);
  }
  return cachedExtras.slice();
}

/** Reset env cache (unit tests). */
export function resetCorsExtraCache() {
  cachedExtrasKey = null;
  cachedExtras = [];
}

export function isAllowedOrigin(origin, env = process.env) {
  const o = String(origin || "").trim();
  if (!o || o === "*") return false;
  if (ALLOWED_ORIGINS.includes(o)) return true;
  return getExtraOrigins(env).includes(o);
}

/**
 * Resolve Access-Control-Allow-Origin for a request Origin.
 * Returns the origin if allowed, otherwise null (never reflect unknown origins).
 */
export function resolveAllowOrigin(origin, { env = process.env } = {}) {
  const o = String(origin || "").trim();
  if (!o) return null;
  return isAllowedOrigin(o, env) ? o : null;
}

export function corsHeadersFor(
  event,
  {
    methods = "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    headers = "Content-Type, Authorization, X-Pronti-Member-Id",
    env = process.env,
  } = {}
) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allow = resolveAllowOrigin(origin, { env });
  const out = {
    "Access-Control-Allow-Headers": headers,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allow) {
    out["Access-Control-Allow-Origin"] = allow;
  }
  return out;
}
