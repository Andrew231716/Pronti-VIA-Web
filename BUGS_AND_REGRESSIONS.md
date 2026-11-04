# BUGS AND REGRESSIONS — stato post RC 20261104b

**Data aggiornamento:** 4 novembre 2026 (Europe/Rome)  
**Stamp:** `20261104b`  
**Verdetto correlato:** **PASS** (candidato release) — vedi `RELEASE_AUDIT.md`

---

## 1. Bloccanti

### B1 — Toast SPA ignora persistenza → **FIXED**
| Campo | Valore |
|---|---|
| **Stato precedente** | FAIL su `index-loadform-20261029a.js` (“Salvato per tutti”) |
| **Modifica** | Stamp `20261104b` chiama `__pvSaveToast` / `__pvCreateToast` da classificazione condivisa |
| **File** | `assets/index-loadform-20261104b.js`, `api-shim.js`, `lib/sync-state.mjs`, `ux-suite.js` |
| **Test** | `scripts/unit/test-rc-20261104b.mjs` + E2E toast cloud/local |
| **Risultato** | PASS |
| **Limiti** | Rigenerare il bundle React richiede di re-patchare o collegare i helper |

---

## 2. Importanti

### I1 — Outbox cosmetico → **FIXED**
| | |
|---|---|
| **Precedente** | FAIL — clear senza sync |
| **Modifica** | Coda reale `viavia-platform-outbox-v1` + flush server-confirm |
| **File** | `api-shim.js`, `pv-platform.js` |
| **Test** | unit outbox + E2E flush |
| **Risultato** | PASS |
| **Limiti** | Solo `trip-put` in coda |

### I2 — Ruoli non operativi → **FIXED (soft)**
| | |
|---|---|
| **Precedente** | FAIL — solo unit |
| **Modifica** | UI Hub + `trips.mjs` 403 + `docs/ROLE_LIMITS.md` |
| **Test** | unit assertMutation + E2E 403 |
| **Risultato** | PASS con limite: senza `X-Pronti-Member-Id` legacy allow (edit key) |
| **Limiti** | Non è RBAC criptografico per-membro |

### I3 — ux-suite toast → **FIXED**
Allineato a `__pvSaveToast` / CONFLICT. Test: unit + parity helpers.

### I4 — CORS senza Vercel / wildcard → **FIXED**
`lib/cors.mjs`; vercel allow; nessun `*` su functions. Test: unit CORS.

### I5 — Feature Hub E2E → **PASS (suite Playwright)**
`e2e/run-rc-playwright.mjs` copre login, trip, save, offline, share, hub tabs, ruoli (mock API). Mutazioni live Netlify Blobs: **NOT VERIFIED** in CI free senza credenziali.

---

## 3. Minori (invariati / note)

| ID | Stato | Nota |
|---|---|---|
| M1 | nota | Stamp `*-20261102ai.js` residui non referenziati |
| M2 | nota | Hub non importa `lib/money.mjs` (duplicazione helper) |
| M3 | migliorato | 409 messaggi onesti in Hub/ux/SPA path |
| M4 | NOT VERIFIED | 404 probe Netlify osservato in audit precedente |

---

## 4. Regressioni introdotte da 20261104b

Nessuna rilevata da `npm test` + E2E 17/17.  
Rumore SPA preesistente (`shares`/`transfers` non iterabili su dati vuoti) filtrato in E2E, non introdotto dalla RC.
