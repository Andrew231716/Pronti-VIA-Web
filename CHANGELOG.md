# CHANGELOG — Pronti? VIA!

## [20261104c] — 2026-11-04

### Security — CORS P1
- Allowlist esplicita in `lib/cors.mjs`: **rimossi** i pattern `*.vercel.app` / `*.netlify.app`.
- Origini autorizzate (repo): `https://andrew231716.github.io`, `https://pronti-via-k7es.netlify.app`, localhost/127.0.0.1 porte `3000`/`8888`/`3456`/`3457`.
- Origini sconosciute: **nessun** `Access-Control-Allow-Origin` (non riflettono fallback).
- Opzionale: env `CORS_EXTRA_ORIGINS` (origini assolute validate, no wildcard) per preview Vercel concrete se necessarie.
- Test: `scripts/unit/test-cors-20261104c.mjs`.
- Nessun servizio a pagamento; nessun merge automatico.

## [20261104b] — 2026-11-04

### Release candidate remediation
- **B1:** toast SPA allineato a persistenza reale (`Salvato e sincronizzato` / `Salvato su questo dispositivo…` / errore / 409). Helper `__pvSaveToast` / `__pvCreateToast` in `api-shim` + `lib/sync-state.mjs`.
- **Outbox Hub:** coda reale `viavia-platform-outbox-v1` con flush solo dopo conferma server.
- **Ruoli:** soft enforcement Hub + `trips.mjs` (403); limiti in `docs/ROLE_LIMITS.md`.
- **CORS:** `lib/cors.mjs` (Pages, Netlify, `*.vercel.app`, localhost) — nessun wildcard `*` *(superseded by 20261104c)*.
- Stamp asset/shell `20261104b`.
- Test: `test-rc-20261104b.mjs` + Playwright `e2e/run-rc-playwright.mjs`.
- Docs: `RELEASE_AUDIT.md`, `BUGS_AND_REGRESSIONS.md`, `E2E_TEST_PLAN.md` aggiornati — verdetto **PASS** (candidato), no auto-merge.

### Notes
- Nessun servizio a pagamento aggiunto.
- Compatibilità dati: ruoli in `trip.meta.roles`; legacy allow senza member header.

## [20261104a] — 2026-11-04

### Security
- Session TTL ridotto da ~10 anni a **30 giorni** (sliding refresh).
- Rate limit login/register per IP.
- Share: TTL, size limit, strip edit key in GET, protezione overwrite invite, rate limit.
- CORS allowlist (Pages, Netlify, localhost) al posto di `*`.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP base.

### Reliability
- SW precache corretto: `index-loadfix-20261029a.js` (era `loadForm`).
- `trips.mjs` propaga `source`/`local` reali da `_store` (niente “cloud” su memory).
- `api-shim` rispetta `data.local` / `source=memory` in cache.
- Indicatore salvataggio globale + outbox offline (`pv-platform`).

### Features
- Hub piattaforma: dashboard, votazioni, stats, backup/restore, reminder, tema dark/light, archivio.
- Librerie pure `lib/*` (money, polls, ics, backup, stats, sync-state).
- Documentazione: AUDIT, ROADMAP, ARCHITECTURE, SECURITY, BACKUP, DEPLOYMENT, COSTS, README.

### Tests
- Unit test Node per money/polls/backup/stats/ics/sync.
- `npm test` esegue check sintassi + unit.

### Notes
- Nessuna migrazione distruttiva; campi nuovi sotto `trip.meta` / localStorage.
- Stamp asset: `20261104a`.
