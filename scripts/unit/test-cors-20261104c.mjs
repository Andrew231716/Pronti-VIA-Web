#!/usr/bin/env node
/**
 * CORS allowlist 20261104c — explicit origins only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_ORIGINS,
  isAllowedOrigin,
  resolveAllowOrigin,
  corsHeadersFor,
  getExtraOrigins,
  resetCorsExtraCache,
  normalizeOriginCandidate,
} from "../../lib/cors.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

test("GitHub Pages authorized", () => {
  assert.equal(isAllowedOrigin("https://andrew231716.github.io"), true);
  assert.equal(resolveAllowOrigin("https://andrew231716.github.io"), "https://andrew231716.github.io");
});

test("Netlify project authorized", () => {
  assert.equal(isAllowedOrigin("https://pronti-via-k7es.netlify.app"), true);
});

test("only the production Vercel origin is statically authorized", () => {
  assert.deepEqual(ALLOWED_ORIGINS.filter(origin => origin.endsWith(".vercel.app")), [
    "https://pronti-via.vercel.app",
  ]);
  assert.equal(isAllowedOrigin("https://pronti-via.vercel.app"), true);
});

test("localhost / 127.0.0.1 authorized for known ports", () => {
  for (const o of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8888",
    "http://localhost:3456",
    "http://localhost:3457",
  ]) {
    assert.equal(isAllowedOrigin(o), true, o);
  }
});

test("evil-attacker.vercel.app rejected", () => {
  assert.equal(isAllowedOrigin("https://evil-attacker.vercel.app"), false);
  assert.equal(resolveAllowOrigin("https://evil-attacker.vercel.app"), null);
  const h = corsHeadersFor({ headers: { origin: "https://evil-attacker.vercel.app" } });
  assert.equal(h["Access-Control-Allow-Origin"], undefined);
});

test("evil-attacker.netlify.app rejected", () => {
  assert.equal(isAllowedOrigin("https://evil-attacker.netlify.app"), false);
  const h = corsHeadersFor({ headers: { origin: "https://evil-attacker.netlify.app" } });
  assert.equal(Object.prototype.hasOwnProperty.call(h, "Access-Control-Allow-Origin"), false);
});

test("arbitrary external domain rejected", () => {
  assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  assert.equal(resolveAllowOrigin("https://attacker.example"), null);
});

test("deceptive subdomain lookalikes rejected", () => {
  assert.equal(isAllowedOrigin("https://andrew231716.github.io.evil.com"), false);
  assert.equal(isAllowedOrigin("https://pronti-via-k7es.netlify.app.evil.com"), false);
  assert.equal(isAllowedOrigin("https://not-pronti-via-k7es.netlify.app"), false);
  assert.equal(isAllowedOrigin("https://andrew231716.github.io.attacker.netlify.app"), false);
});

test("unauthorized protocols rejected", () => {
  assert.equal(isAllowedOrigin("ftp://andrew231716.github.io"), false);
  assert.equal(isAllowedOrigin("file://andrew231716.github.io"), false);
  assert.equal(isAllowedOrigin("ws://localhost:3000"), false);
  assert.equal(normalizeOriginCandidate("javascript:alert(1)"), "");
});

test("OPTIONS preflight headers for allowed origin", () => {
  const h = corsHeadersFor(
    { headers: { origin: "https://andrew231716.github.io" } },
    { methods: "GET, POST, PUT, OPTIONS" }
  );
  assert.equal(h["Access-Control-Allow-Origin"], "https://andrew231716.github.io");
  assert.match(h["Access-Control-Allow-Methods"], /OPTIONS/);
  assert.match(h["Access-Control-Allow-Headers"], /Authorization/);
  assert.match(h["Access-Control-Allow-Headers"], /X-Pronti-Member-Id/);
  assert.equal(h.Vary, "Origin");
});

test("auth headers preserved on Netlify site origin", () => {
  const h = corsHeadersFor({ headers: { Origin: "https://pronti-via-k7es.netlify.app" } });
  assert.equal(h["Access-Control-Allow-Origin"], "https://pronti-via-k7es.netlify.app");
  assert.match(h["Access-Control-Allow-Headers"], /Content-Type/);
  assert.match(h["Access-Control-Allow-Headers"], /Authorization/);
  assert.match(h["Access-Control-Allow-Headers"], /X-Pronti-Member-Id/);
});

test("unauthorized origin gets no ACAO (not fallback echo)", () => {
  const h = corsHeadersFor({ headers: { origin: "https://random-preview.netlify.app" } });
  assert.equal(h["Access-Control-Allow-Origin"], undefined);
  assert.equal(resolveAllowOrigin("https://foo.vercel.app"), null);
  assert.equal(resolveAllowOrigin("*"), null);
  assert.equal(resolveAllowOrigin(""), null);
});

test("no wildcard patterns remain in lib/cors.mjs", () => {
  const src = readFileSync("lib/cors.mjs", "utf8");
  // No platform-wide host regex (the P1 root cause).
  assert.equal(/\[a-z0-9-\]\+\\?\.vercel\\.app/i.test(src), false);
  assert.equal(/\[a-z0-9-\]\+\\?\.netlify\\.app/i.test(src), false);
  assert.equal(/\^https:\\\\\/\\\\\/\[a-z0-9-\]\+\\\.vercel/i.test(src), false);
  // No ACAO wildcard assignment in code (comments may mention the ban).
  assert.equal(/Access-Control-Allow-Origin["'\s:]*\*["']/.test(src), false);
  assert.equal(src.includes('Allow-Origin": "*"'), false);
  // Behavioural proof: open preview hosts stay denied.
  assert.equal(isAllowedOrigin("https://preview-xyz.vercel.app"), false);
  assert.equal(isAllowedOrigin("https://preview-xyz.netlify.app"), false);
});

test("CORS_EXTRA_ORIGINS env accepts only exact validated origins", () => {
  resetCorsExtraCache();
  const env = {
    CORS_EXTRA_ORIGINS:
      "https://my-preview.vercel.app, https://evil*attacker.vercel.app, not-a-url, https://ok.example.com/path, ftp://bad.example",
  };
  const extras = getExtraOrigins(env);
  assert.deepEqual(extras, ["https://my-preview.vercel.app"]);
  assert.equal(isAllowedOrigin("https://my-preview.vercel.app", env), true);
  assert.equal(isAllowedOrigin("https://evil-attacker.vercel.app", env), false);
  assert.equal(isAllowedOrigin("https://ok.example.com", env), false);
  resetCorsExtraCache();
});

test("functions still import shared cors helper", () => {
  for (const file of [
    "netlify/functions/account.mjs",
    "netlify/functions/trips.mjs",
    "netlify/functions/share.mjs",
    "netlify/functions/places.mjs",
    "netlify/functions/proxy.mjs",
    "netlify/functions/search.mjs",
  ]) {
    assert.match(readFileSync(file, "utf8"), /lib\/cors\.mjs/);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
