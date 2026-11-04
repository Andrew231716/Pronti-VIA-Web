# E2E TEST PLAN — Pronti? VIA! (gratuito)

**Stamp:** `20261104b`  
**Aggiornamento:** 4 novembre 2026 (Europe/Rome)  
**Runner:** Playwright (free) + Chrome di sistema — `npm run test:e2e`  
**File:** `e2e/run-rc-playwright.mjs`

---

## 0. Prerequisiti

```bash
node -v          # >= 18
npm test         # syntax + unit (obbligatorio)
npm run test:e2e # installa playwright on-the-fly se assente (--no-save)
```

Base URL interna: `http://127.0.0.1:3457/` (server statico nello script).  
Nessuna dipendenza a pagamento. Playwright non è dependency di produzione.

---

## 1. Suite RC eseguita (`20261104b`)

| # | Caso | Esito |
|---|---|---|
| 1 | Login / sessione locale | **PASS** |
| 2 | Creazione/apertura viaggio | **PASS** |
| 3–4 | Modifica + salvataggio cloud (toast onesto) | **PASS** |
| 4b | Salvataggio locale + outbox | **PASS** |
| 5 | Ricaricamento pagina | **PASS** |
| 6 | Offline shell | **PASS** |
| 7 | Online + flush outbox | **PASS** |
| 8 | Condivisione / guest | **PASS** |
| 9 | Votazioni (tab Hub) | **PASS** |
| 10 | Spese (presenza UI) | **PASS** |
| 11 | Backup (tab Hub) | **PASS** |
| 12 | Ruoli — PUT non autorizzato → 403 | **PASS** |
| + | Stamp `20261104b`, helpers B1, Hub FAB | **PASS** |

**Risultato run:** 17/17 PASS.

Note: API trip mockate in browser (incl. rewrite Netlify) per ripetibilità free senza Blobs credentials. Mutazioni live su Netlify/Supabase restano **NOT VERIFIED** in CI senza secret.

---

## 2. Unit correlati

```bash
npm test
# include scripts/unit/run-all.mjs (12) + test-rc-20261104b.mjs (12)
```

Coprono: toast cloud/local/error, outbox, 409 detect, roles/IT aliases, CORS no-wildcard, SPA senza “Salvato per tutti”.

---

## 3. Mapping controlli release

| Tema | Stato |
|---|---|
| Toast SPA onesto (ex B1) | PASS |
| Sync / outbox / 409 | PASS (E2E + unit) |
| Auth locale | PASS (E2E); cloud account live NOT VERIFIED |
| Share guest | PASS (E2E soft-login) |
| Ruoli soft | PASS (E2E 403 + unit); limite in `docs/ROLE_LIMITS.md` |
| Hub tabs | PASS presenza |
| PWA offline shell | PASS |
| iOS device / RLS Supabase | NOT VERIFIED (accettati) |

---

## 4. Definition of Done (release candidato)

- [x] B3/B1 toast honesty PASS  
- [x] Offline shell PASS  
- [x] Suite Playwright casi 1–12 PASS  
- [x] `npm test` PASS  
- [x] Limiti RBAC documentati  
- [ ] Approvazione umana merge/publish  
- [ ] (opzionale) smoke live Netlify con secret CI free
