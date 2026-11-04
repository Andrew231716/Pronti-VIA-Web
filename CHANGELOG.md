# CHANGELOG — Pronti? VIA!

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
