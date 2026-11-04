# E2E TEST PLAN — Pronti? VIA! (gratuito e ripetibile)

**Obiettivo:** suite end-to-end a costo zero (Chrome/Chromium + Node), eseguibile in locale e su CI free-tier con matrix ridotta.  
**Stato attuale (4 nov 2026 Europe/Rome):** eseguiti `npm test` (12 unit) + smoke Puppeteer SW/Hub/offline. Gli E2E legacy in `scripts/` non sono stati rieseguiti in questo audit.

---

## 0. Prerequisiti (free)

```bash
node -v          # >= 18
npm test         # syntax + unit (obbligatorio prima di E2E)
python3 -m http.server 3456 --bind 127.0.0.1
# oppure: npx --yes serve -l 3456 .
```

Browser: Google Chrome / Chromium headless (già usato in audit).  
Opzionale: `npm i -D puppeteer-core` in una cartella tool **senza** aggiungerlo alle dipendenze obbligatorie di produzione.

Base URL: `http://127.0.0.1:3456/` (o `http://localhost:3456/`).

---

## 1. Smoke già eseguito (audit post-PR #39)

Comando equivalente usato:

- Launch Chrome headless via `puppeteer-core`
- Goto `/`
- Assert: title, script stamp `20261104a`, `#pv-plat-fab`, SW `activated`, cache `pv-shell-20261104a`
- Open Hub → tabs presenti
- Offline reload → shell ancora disponibile

**Esito:** PASS parziale (vedi `RELEASE_AUDIT.md` e artifact `pv-runtime-smoke.json`).

---

## 2. Suite raccomandata (ripetibile)

### A. Auth & sessione

| ID | Caso | Passi | Atteso |
|---|---|---|---|
| A1 | Register | Crea account username+password validi | Token + redirect app / chip account |
| A2 | Login | Logout → login | Sessione ripristinata |
| A3 | Logout | Esci | Gate login; token server revocato (se cloud) |
| A4 | Expiry | Imposta `expiresAt` passato in `localStorage` `viavia-account-v1` → reload | Gate login |
| A5 | Guest share | Apri `#trip=<id>&key=<editKey>` senza account | Guest session, viaggio apribile |

### B. Trip CRUD & salvataggio

| ID | Caso | Passi | Atteso |
|---|---|---|---|
| B1 | Create trip | Home → nuovo viaggio → salva | ID+key in hash; compare in recent |
| B2 | Edit + reload | Modifica titolo → reload | Persistenza |
| B3 | Local honesty | Simula risposta `{local:true,source:"memory"}` (mock) | UI **non** dice “Salvato per tutti” (**oggi FAIL noto SPA**) |
| B4 | Conflict 409 | Due tab: A salva rev1, B salva con rev stale | 409 + messaggio / refresh |
| B5 | Offline edit | Offline → modifica → online | Dati locali presenti; sync best-effort |

### C. PWA

| ID | Caso | Atteso |
|---|---|---|
| C1 | SW register | `sw.js?v=20261104a` active |
| C2 | Cache shell | `pv-shell-20261104a` contiene index + suite + SPA |
| C3 | Offline navigate | Reload offline mostra app (non blank) |
| C4 | Update stamp | Dopo deploy nuovo stamp, cache vecchia eliminata |

### D. Hub piattaforma

| ID | Caso | Atteso |
|---|---|---|
| D1 | Empty dashboard | Senza trip: “Benvenuto” / crea viaggio |
| D2 | Poll create/vote/close | Su trip editabile |
| D3 | Prep docs + checklist | Persistiti in `trip.meta` |
| D4 | ICS download | File `.ics` scaricato, parseable |
| D5 | Backup export | JSON `kind=pronti-via-backup` schema 1 |
| D6 | Backup import merge | Solo revisioni più nuove sostituiscono |
| D7 | Theme dark/light | `data-pv-theme` cambia |

### E. Spese & share

| ID | Caso | Atteso |
|---|---|---|
| E1 | Add expense + split | Saldi coerenti (cent) |
| E2 | FX offline cache | Usa ultimo tasso / manuale |
| E3 | Share publish | Restituisce ref; GET pubblico senza edit key |
| E4 | Share expire/revoke | 404 dopo TTL/DELETE |

### F. Responsive / a11y smoke

| ID | Caso | Atteso |
|---|---|---|
| F1 | 390×844 | Gate + Hub usabili, target ≥40px |
| F2 | Tab order Hub | Focus visibile su Chiudi/tabs |
| F3 | Reduced motion | Nessun blocco funzionale |

---

## 3. Comando unico proposto (da implementare dopo approvazione)

> Non aggiunto al repo in questo audit (vincolo: no code change). Dopo review, suggerito:

```bash
npm test && node scripts/e2e-release-smoke.mjs
```

Lo smoke può riusare Puppeteer con `CHROME_PATH` / `PV_BASE` env, timeout 60s, exit≠0 su FAIL.

### Criteri CI free-tier

- Run solo su `pull_request` verso `main` (non su ogni push di docs).
- Job unico ubuntu, no matrix browser multipla.
- Skip se `[skip e2e]` nel commit message.
- Artifact: screenshot fallimenti + JSON result.

---

## 4. Mapping a controlli utente (1–15)

| # | Controllo | Copertura piano | Stato oggi |
|---|---|---|---|
| 1 | Modifiche PR | Review diff + stamp | PASS |
| 2–3 | PWA/SW/offline | C1–C3 + smoke eseguito | PASS parziale |
| 4–5 | Save/sync/conflict | B1–B5 | FAIL noto B3; B4/B5 NOT VERIFIED |
| 6 | Auth | A1–A5 | A1–A3 NOT VERIFIED runtime; A4 codice PASS |
| 7 | Share | E3–E4 | NOT VERIFIED runtime |
| 8 | Ruoli | — | FAIL (non enforced) |
| 9 | Voti/spese | D2, E1 | unit PASS; E2E NOT VERIFIED |
| 10 | Hub sezioni | D1–D7 | UI smoke PASS; mutazioni NOT VERIFIED |
| 11 | Backup | D5–D6 | unit PASS; UI NOT VERIFIED |
| 12 | Responsive/a11y | F1–F3 | F1 smoke PASS; F2–F3 NOT VERIFIED |
| 13 | Console/API | smoke errors | PASS pageErrors; 404 Netlify da indagare |
| 14 | RLS Supabase | fuori repo | NOT VERIFIED |
| 15 | E2E | questo piano + smoke | Parziale |

---

## 5. Definition of Done E2E per release stabile

- [ ] A1–A3, B1–B2, B4, C1–C3, D1, D5–D6 PASS in CI o checklist firmata
- [ ] B3 PASS (richiede fix toast SPA)  
- [ ] Nessun `pageerror` su happy path  
- [ ] Offline shell PASS  
- [ ] Documentati i casi NOT VERIFIED accettati (RLS, iOS device)
