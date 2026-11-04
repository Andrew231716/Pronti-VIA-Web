# RELEASE AUDIT — Pronti? VIA!

**Stamp live:** `20261104b`  
**PR:** https://github.com/Andrew231716/Pronti-VIA-Web/pull/39  
**Aggiornamento RC:** 4 novembre 2026 (Europe/Rome) — remediation `20261104b`  
**Metodo:** revisione codice + `npm test` (syntax + 12 + 12 unit) + Playwright E2E `npm run test:e2e` (17/17)

Legenda: **PASS** / **FAIL** / **NOT VERIFIED** / **HOLD**

---

## Verdetto attuale

### **PASS** — candidato alla release stabile (con limiti documentati)

Criteri HOLD precedenti (`20261104a` audit) superati:

| Criterio | Esito |
|---|---|
| B1 toast SPA onesto | **PASS** |
| Messaggio salvataggio = stato reale | **PASS** |
| Ruoli applicati o chiaramente limitati | **PASS** (soft RBAC + `docs/ROLE_LIMITS.md`) |
| Outbox non dichiara sync inesistenti | **PASS** |
| Test automatici | **PASS** |
| E2E principali | **PASS** (17/17) |
| Nessun servizio a pagamento obbligatorio | **PASS** |

**Residuo accettato (non bloccante):** RBAC forte per-membro non è criptografico (edit key condivisa). Con header `X-Pronti-Member-Id` il server rifiuta (403); senza header resta legacy allow. Dettaglio in `docs/ROLE_LIMITS.md`.

**Non unire / non pubblicare** senza approvazione esplicita del maintainer.

---

## Remediation 20261104b — per problema

### B1 — Toast SPA “Salvato per tutti”
| | |
|---|---|
| **Stato precedente** | FAIL — SPA toastava sync cloud senza leggere `local`/`source` |
| **Modifica** | Bundle `assets/index-loadform-20261104b.js` usa `__pvSaveToast` / `__pvCreateToast`; `api-shim` + `lib/sync-state.mjs` classificano; `ux-suite` / Hub allineati |
| **File** | `assets/index-loadform-20261104b.js`, `api-shim.js`, `lib/sync-state.mjs`, `ux-suite.js`, `pv-platform.js`, `account.js` |
| **Test** | unit RC toast + SPA assert; E2E B1 helpers + save cloud/local |
| **Risultato** | **PASS** |
| **Limiti** | Bundle minificato patchato (non source React); stamp successivo deve re-applicare o rigenerare |

### I1 — Outbox Hub cosmetico
| | |
|---|---|
| **Stato precedente** | FAIL — “Riprova” svuotava la coda senza sync |
| **Modifica** | Enqueue su persistenza ephemeral; `__pvFlushOutbox` PUT reale; 409/local non rimuovono; eventi `pv-save-status` / `pv-outbox-changed` |
| **File** | `api-shim.js`, `pv-platform.js`, `lib/sync-state.mjs` |
| **Test** | unit outbox; E2E flush online |
| **Risultato** | **PASS** |
| **Limiti** | Flush tipizzato `trip-put`; altre op non in coda |

### I2 — Ruoli non operativi
| | |
|---|---|
| **Stato precedente** | FAIL — `lib/roles` solo unit |
| **Modifica** | Soft enforcement Hub+`trips.mjs` (403); alias IT; doc limiti |
| **File** | `lib/roles.mjs`, `netlify/functions/trips.mjs`, `pv-platform.js`, `docs/ROLE_LIMITS.md` |
| **Test** | unit roles/assertMutation; E2E 403 readonly |
| **Risultato** | **PASS** con limite soft documentato |

### I3 — ux-suite toast
| | |
|---|---|
| **Stato precedente** | FAIL |
| **Modifica** | Usa `__pvSaveToast` + messaggio 409 |
| **File** | `ux-suite.js` |
| **Test** | unit + parity con helpers |
| **Risultato** | **PASS** |

### I4 — CORS Vercel / wildcard
| | |
|---|---|
| **Stato precedente** | FAIL (mancava vercel; alcuni `*`) |
| **Modifica** | `lib/cors.mjs` condiviso; allowlist Pages/Netlify/`*.vercel.app`/localhost; **nessun `*`**; header `X-Pronti-Member-Id`; OPTIONS ok |
| **File** | `lib/cors.mjs`, `account|trips|share|places|proxy|search.mjs` |
| **Test** | unit CORS |
| **Risultato** | **PASS** |

---

## Controlli regressione (sintesi)

| Area | Esito |
|---|---|
| Stamp `20261104b` shell/SW/assets | PASS |
| Sessioni 30g / share hardening | PASS (codice invariato funzionale) |
| Optimistic lock 409 | PASS (unit + E2E) |
| `npm test` | PASS (24 unit totali + syntax) |
| Playwright E2E | PASS 17/17 |
| PWA install device reale | NOT VERIFIED |
| Supabase RLS live | NOT VERIFIED |
| Conflitto multi-device fisico | NOT VERIFIED (simulato in E2E) |

---

## Audit storico `20261104a`

L’audit post-PR #39 dichiarò **HOLD** per B1. Quella sezione storica resta in `BUGS_AND_REGRESSIONS.md` (stato aggiornato a fixed). Questo documento riflette lo stato **dopo** remediation `20261104b`.
