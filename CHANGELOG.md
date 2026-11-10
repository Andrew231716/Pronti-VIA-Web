# CHANGELOG — Pronti? VIA!

## [20261107j] — 2026-11-10

### Spese Splitpay + IA
- **Fix critico:** su host statici il PUT spese andava sul cloud (404 «Viaggio non trovato») senza fallback locale — ora salva in locale se il viaggio è sul dispositivo.
- Categorie tappa legacy (`Cultura`, …) accettate / normalizzate così non bloccano lo Splitpay.
- Fix: capsule nav non intercetta più i tap sul select «Come dividiamo?» (Importi personalizzati).
- Guard toast se le quote personalizzate non sommano il totale.
- IA: contesto spese del viaggio + guida a split/rimborsi.
- QA script `scripts/qa-spese-ai-split.mjs`.

## [20261107i] — 2026-11-10

### Visual polish — più fluida, stessa UX
- Atmosfera soft sul body, chip e capsule nav più glass, stati attivi Hub/IA in famiglia teal.
- Menu/sheet/toast con motion più morbida; card Home e Hub più leggibili.
- Nessuna funzionalità cambiata. Stamp `20261107i`.

## [20261107h] — 2026-11-10

### Fix QA — funzioni e grafica
- Menu Profilo: rilevamento tab SPA più robusto (`#root`, fallback Itinerario); più padding sopra la nav capsule.
- Hub: etichetta **Inviti** (meno wrap); griglia tab uniforme su mobile.
- `tripDays` a prova di trip assente; magic CSS gate e `expense-suite` SW `ASSET_VER` allineati allo stamp corrente.
- Test E2E/verify aggiornati a stamp `20261107h` (non più 04j/04e).

## [20261104j] — 2026-11-04

### UX polish — Hub groups, banner, home cards
- Hub: tab raggruppate in **Collabora** (Panoramica, Votazioni, Preparazione, Numeri) e **Organizza** (Calendario, Ricordi, Backup, Impostazioni).
- Banner «solo su questo dispositivo»: chip compatto, copy più corta.
- Home/Recent: card viaggio con thumb + meta; filtri Tutti / In arrivo / Passati.
- Stamp `20261104j` (`pv-platform` + `ux-suite` + shell CSS).

## [20261104i] — 2026-11-04

### UX polish post-riferimenti
- Bacchetta flottante nascosta con nav primaria (IA nella capsule); Preventivo solo, sollevato.
- Hub: copy umana (backup/settings/dash), countdown in italiano, «Prossimi passi».
- Onboarding spiega Home/Viaggi/HUB/IA/Profilo (anche fuori viaggio).
- Profilo: Hub demoted, eliminazioni in zona pericolosa; elenco viaggi senza ID criptici.
- Safe-area top chip + padding sheet/toast sopra la capsule.
- Stamp `20261104i`.

## [20261104h] — 2026-11-04

### UX — navigazione primaria stile riferimento
- Bottom nav a 5 sezioni: **Home · Viaggi · HUB · IA · Profilo** (schema concettuale dell’utente).
- Capsula glassmorphism, icone + etichette, safe-area; Hub e Profilo non più pill isolate in top bar.
- Top chip semplificato (saluto + brand); HUB come ambiente collaborativo (pannello dashboard, padding sopra la nav).
- Assistente IA raggiungibile dalla nav (oltre alla bacchetta flottante, sollevata sopra la capsule).
- Stamp shell `20261104h`. Nessuna funzionalità rimossa; magic-extras invariato.

## [20261104g] — 2026-11-04

### UX/UI redesign — Hub, Menu, navigazione
- **Hub** integrato nella top bar account (`#pv-hub-nav`) accanto a Menu: non è più un FAB flottante «alieno». Il FAB resta solo fallback se il chip non è montato.
- Titolo pannello **Hub · Collabora** + lead chiaro sulle funzioni di gruppo; tab con etichette parlanti (Panoramica, Votazioni, Preparazione…).
- **Menu** riorganizzato per categorie: Azioni rapide · Organizza · Soldi · Collabora · Altro · Account · Zona pericolosa (fuori viaggio: I tuoi viaggi · Collabora).
- Voce Menu **Apri Hub** (stesso pannello collaborativo).
- Chip offline riposizionato in alto al centro (libera il basso a destra per la bacchetta).
- Bacchetta magica / Lingua / endpoint IA **invariati** (`magic-extras-20261104e`).
- Stamp shell `pv-shell-20261104g`; asset `pv-platform-20261104g` + `ux-suite-20261104g`.
- Docs: `docs/UX_REDESIGN_20261104g.md` (mappa prima/dopo, architettura menu/Hub).
- Test unit aggiornati + E2E Hub su `#pv-hub-nav`.
- Verifica approfondita: fixture trip SPA-completa (`e2e/fixtures/valid-trip.mjs`) elimina falsi `shares is not iterable`; E2E 30/30 + `npm run test:verify-ux` 30/30 (mobile/desktop).
- Nessuna funzionalità rimossa; nessun merge/deploy automatico.

## [20261104f] — 2026-11-04

### Hub panel — tab switch fluido
- Cambio sezione Hub **non** riavvia più l’animazione di ingresso (su/giù).
- Chrome del pannello riusato; contenuto tab caricato e poi scambiato (niente flash «Caricamento…» che collassa l’altezza).
- Stamp `pv-platform-20261104f`; test `test-hub-panel-fluid-20261104f.mjs`.

## [20261104e] — 2026-11-04

### Bacchetta · Lingua — parlare sul posto
- Tab **Lingua** riorientata ad aiutare a **parlare nella lingua del posto** (non solo dizionario).
- Situazioni: Essenziali / Ristorante / Direzioni / Emergenza.
- «Come si dice…» (IT → lingua locale) + **Ascolta** via Web Speech API (gratuita, on-device).
- Destinazioni mappate a lingue reali (no/sv/da/nl/el/…); frasario dinamico via MyMemory quando manca il curato.
- Stamp `magic-extras-20261104e`; test `test-lingua-speak-20261104e.mjs`.
- Nessun servizio a pagamento.

## [20261104d] — 2026-11-04

### Post-merge regression fix
- **Bacchetta magica:** non era rimossa — era **coperta** dall’Hub FAB (`z-index` 120100 vs magic-root 80) sullo stesso angolo destro. Ripristinata la visibilità alzando lo stacking della bacchetta e spostando Hub a **sinistra**.
- **Gate spinner:** `renderFab` non tratta più lo schermo errore SPA (`main.loading` senza `.spin`) come loading — la bacchetta torna montabile anche se il trip fallisce l’apertura.
- **Hub overlap:** `#pv-plat-fab` ancorato a sinistra + safe-area; nascosto con `body.pv-magic-open`; chip offline spostato per non collidere.
- **Fluidità:** transizione Hub panel; `prefers-reduced-motion`; skip `tick()` magic quando `document.hidden`.
- Stamp shell/assets `20261104d`.
- Test: `test-fab-layout-20261104d.mjs` + E2E assert Hub a sinistra + `#pv-magic-open` visible / no overlap.
- Nessun merge/publish in questo fix (branch dedicato).

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
