/**
 * Shared CORS allowlist for Netlify Functions (Pages + Netlify + Vercel + localhost).
 * No wildcard origins. Subdomain patterns are limited to known free hosts.
 */

export const ALLOWED_ORIGINS = Object.freeze([
  "https://andrew231716.github.io",
  "https://pronti-via-k7es.netlify.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
  "http://localhost:3456",
  "http://127.0.0.1:3456",
]);

const NETLIFY_APP = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;
const VERCEL_APP = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isAllowedOrigin(origin) {
  const o = String(origin || "").trim();
  if (!o) return false;
  return (
    ALLOWED_ORIGINS.includes(o) ||
    NETLIFY_APP.test(o) ||
    VERCEL_APP.test(o) ||
    LOCALHOST.test(o)
  );
}

/**
 * Resolve Access-Control-Allow-Origin for a request.
 * Never returns "*". Unknown origins get the primary production origin (not echoed).
 */
export function resolveAllowOrigin(origin, { fallback = ALLOWED_ORIGINS[0] } = {}) {
  const o = String(origin || "").trim();
  if (isAllowedOrigin(o)) return o;
  return fallback;
}

export function corsHeadersFor(event, {
  methods = "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  headers = "Content-Type, Authorization, X-Pronti-Member-Id",
} = {}) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allow = resolveAllowOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": headers,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
