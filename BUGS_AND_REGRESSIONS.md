# BUGS AND REGRESSIONS — stato post RC 20261104c

**Data aggiornamento:** 4 novembre 2026 (Europe/Rome)  
**Stamp client:** `20261104b` · **CORS patch:** `20261104c`  
**Verdetto correlato:** **PASS** (candidato release) — vedi `RELEASE_AUDIT.md`

---

## 1. Bloccanti

### B1 — Toast SPA ignora persistenza → **FIXED** (`20261104b`)
| Campo | Valore |
|---|---|
| **Modifica** | `__pvSaveToast` / `__pvCreateToast` + classificazione `local`/`source` |
| **File** | `assets/index-loadform-20261104b.js`, `api-shim.js`, `lib/sync-state.mjs`, `ux-suite.js` |
| **Test** | unit RC + E2E | **Risultato** | PASS |

### P1 — CORS `*.vercel.app` / `*.netlify.app` aperti → **FIXED** (`20261104c`)
| Campo | Valore |
|---|---|
| **Stato precedente** | FAIL (FINAL_RELEASE_REVIEW) — `evil-attacker.vercel.app` allowed |
| **Modifica** | Allowlist esplicita; no reflect unknown; `CORS_EXTRA_ORIGINS` validato |
| **File** | `lib/cors.mjs`, `scripts/unit/test-cors-20261104c.mjs` |
| **Test** | 15 unit CORS + `npm test` + E2E 17/17 |
| **Risultato** | PASS |
| **Limiti** | Nessun host Vercel concreto in repo: preview Vercel solo via env esplicita |

---

## 2. Importanti

### I1 — Outbox cosmetico → **FIXED** (`20261104b`)
Coda `viavia-platform-outbox-v1` + flush post-conferma server. PASS.

### I2 — Ruoli → **FIXED soft** (`20261104b`)
Hub + `trips.mjs` 403; limiti in `docs/ROLE_LIMITS.md`. PASS con limite edit key.

### I3 — ux-suite toast → **FIXED** (`20261104b`)

### I4 — CORS Vercel/wildcard → **FIXED** (`20261104c`)
Sostituisce la mitigazione ampia di `20261104b` (che aveva introdotto P1). Allowlist precisa Pages + Netlify progetto + localhost porte note.

### I5 — Hub E2E → **PASS** (Playwright 17/17; Blobs live NOT VERIFIED)

---

## 3. Minori

| ID | Stato | Nota |
|---|---|---|
| M1 | nota | Stamp `*-20261102ai.js` residui non referenziati |
| M2 | nota | Hub non importa `lib/money.mjs` |
| M3 | migliorato | 409 onesti |
| M4 | NOT VERIFIED | 404 probe Netlify storico |

---

## 4. Regressioni

Nessuna da `npm test` + E2E 17/17 dopo `20261104c`.  
Origini Netlify/Pages di produzione restano autorizzate; preview Netlify/Vercel generici **bloccati** di proposito.
