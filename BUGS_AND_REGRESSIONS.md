# BUGS AND REGRESSIONS — Audit post-evoluzione PR #39

**Data:** 4 novembre 2026 (Europe/Rome)  
**Stamp:** `20261104a` · commit `03d5199`  
**Regola:** solo evidenze da codice o test eseguiti. Nessuna modifica applicativa in questo audit.

---

## 1. Problemi bloccanti

### B1 — Toast SPA “Salvato per tutti” ignora persistenza locale/memory
| Campo | Valore |
|---|---|
| **Severità** | Bloccante (affidabilità / fiducia dati) |
| **Esito** | **FAIL** |
| **File** | `assets/index-loadfix-20261029a.js` (bundle React) |
| **Evidenza** | Dopo PUT ok: `ih.success(\`Salvato per tutti\`)` senza leggere `o.local` / `o.source`. Contesto estratto in audit. |
| **Conseguenza** | Utente crede al sync cloud mentre i dati possono essere solo memory/local e sparire. |
| **Nota** | Hub e `api-shim`/`trips.mjs` sono onesti; il bug è nel toast SPA preesistente non aggiornato dalla PR. |
| **Fix proposto** | Condizionare il messaggio a `!o.local && o.source!=="memory"`; altrimenti “Salvato su questo dispositivo”. |

---

## 2. Problemi importanti

### I1 — Hub outbox cosmetico
| | |
|---|---|
| **Esito** | **FAIL** |
| **File** | `pv-platform.js` (`OUTBOX_KEY`) |
| **Evidenza** | Solo `readJson` count + `writeJson([],…)` su “Riprova”; nessun enqueue. |
| **Conseguenza** | Falsa sensazione di coda sync. |
| **Fix** | Implementare outbox reale **oppure** rimuovere il controllo UI fino a implementazione. |

### I2 — Ruoli collaborativi non operativi
| | |
|---|---|
| **Esito** | **FAIL** |
| **File** | `lib/roles.mjs` (solo unit) |
| **Evidenza** | Grep: nessun uso runtime fuori `scripts/unit/run-all.mjs`. |
| **Conseguenza** | Feature “ruoli” non reale; solo edit key / viewToken. |
| **Fix** | Wire UI+API **oppure** de-scope da release notes. |

### I3 — `ux-suite` toast “Salvato” senza check local
| | |
|---|---|
| **Esito** | **FAIL** |
| **File** | `ux-suite.js` |
| **Evidenza** | Toast su PUT ok senza ispezione `local`. |
| **Fix** | Allineare a Hub / flag shim. |

### I4 — CORS senza `*.vercel.app`
| | |
|---|---|
| **Esito** | **FAIL** (se si usa Vercel+Netlify account/share) |
| **File** | `account.mjs`, `trips.mjs`, `share.mjs` |
| **Evidenza** | Allowlist senza vercel; `api-shim` tratta vercel come same-origin proxy ma account/share possono essere cross-origin verso Netlify. |
| **Fix** | Aggiungere origin vercel **o** documentare “Vercel non supportato per account”. |

### I5 — Feature Hub (voti/prep/backup su trip) non E2E-verificate
| | |
|---|---|
| **Esito** | **NOT VERIFIED** (trattato come importante per release “completa”) |
| **Evidenza** | Smoke conferma UI/tabs; nessuna mutazione su viaggio reale in questo audit. |

---

## 3. Problemi minori / manutenibilità

| ID | Esito | Descrizione |
|---|---|---|
| M1 | **PASS con nota** | Restano 6 file `assets/*-20261102ai.js` non referenziati dal live stamp (bloat deploy). |
| M2 | **FAIL minore** | `lib/money.mjs` non usato da Hub (duplicazione). |
| M3 | **PASS con nota** | `app-suite` save senza UX dedicata al 409 (generico). |
| M4 | **NOT VERIFIED** | 404 verso `pronti-via-k7es.netlify.app/api/trips` osservato in smoke (probe?). Da chiarire in staging. |

---

## 4. Regressioni rispetto a pre-PR

| Area | Regressione? | Note |
|---|---|---|
| Path SW SPA | **No — fix** | `loadForm`→`loadfix` corregge un bug preesistente. |
| Sessioni più corte | **Comportamento intenzionale** | Logout dopo 30g inattività sliding; comunicare in CHANGELOG. |
| Share GET senza key | **Comportamento intenzionale** | Client che dipendevano dalla key in GET pubblico rompono; seed usa hash key. Verificare flussi share custom. |
| Asset stamp prune | **No funzionale** | Solo rimozione copie non referenziate. |
| Nuovo Hub FAB | **No regressione** | Additive; può sovrapporsi UX su schermi piccoli → da validare manualmente. |

**Nessuna regressione funzionale critica dimostrata** oltre i limiti di messaggistica salvataggio SPA già fragili; la PR migliora backend honesty ma non aggiorna il toast React.

---

## 5. Controlli obbligatori — tabella esiti

| # | Controllo | Esito |
|---|---|---|
| 1 | Modifiche PR #39 | **PASS** |
| 2 | PWA / SW codice | **PASS** |
| 3 | Install/update/offline | **PASS** offline shell smoke; install device **NOT VERIFIED** |
| 4 | Save local/cloud/sync | **FAIL** toast SPA; backend/Hub **PASS** |
| 5 | Errori rete / conflitti | 409 codice **PASS**; simulazione multi-client **NOT VERIFIED**; offline smoke **PASS** |
| 6 | Auth / session / logout | Codice **PASS**; login E2E **NOT VERIFIED** |
| 7 | Share TTL/revoca/authz | Codice **PASS**; runtime **NOT VERIFIED** |
| 8 | Permessi/ruoli utenti | **FAIL** (non enforced) |
| 9 | Voti/spese/calcoli | Unit **PASS**; E2E **NOT VERIFIED** |
| 10 | Dashboard/cal/notif/prep/archivio | UI Hub **PASS**; mutazioni/notif **NOT VERIFIED** |
| 11 | Backup export/restore | Unit **PASS**; UI file **NOT VERIFIED** |
| 12 | Responsive/a11y | Mobile smoke **PASS**; a11y piena **NOT VERIFIED** |
| 13 | Console/API/perf | pageErrors **PASS**; perf **NOT VERIFIED** |
| 14 | Supabase RLS | **NOT VERIFIED** |
| 15 | E2E | Smoke parziale **PASS**; suite completa **NOT VERIFIED** (piano in `E2E_TEST_PLAN.md`) |

---

## 6. Miglioramenti consigliati (non bloccanti)

1. Aggiornare toast SPA/`ux-suite` ai flag `local`/`source`.  
2. Outbox reale o rimozione CTA.  
3. Collegare o de-scope ruoli.  
4. Allowlist Vercel o docs.  
5. Implementare `scripts/e2e-release-smoke.mjs` da `E2E_TEST_PLAN.md`.  
6. Misura Lighthouse + test iOS.  
7. Allegare export policy Supabase.  
8. Eliminare stamp `ai` residui dopo conferma Pages cache.

---

## 7. Verifiche manuali ancora necessarie

1. iPhone: Aggiungi a Home, offline, update stamp.  
2. Login/register/logout su Netlify staging.  
3. Crea viaggio → modifica da due browser → 409.  
4. Share invite + revoke.  
5. Hub: votazione, checklist, backup import su dati reali.  
6. Spese split + FX offline.  
7. Dark mode + navigazione tastiera.  
8. Console Supabase RLS.  
9. Deploy Pages preview con path `/Pronti-VIA-Web/`.

---

## 8. Giudizio complessivo pubblicazione

| Domanda | Risposta |
|---|---|
| Si può mergeare la PR come miglioramento? | **Sì**, con consapevolezza dei FAIL. |
| Si può dichiarare “release stabile completa” oggi? | **No**. |
| Condizione minima per release stabile | Fix **B1** + checklist manuale auth/trip/offline + note su ruoli/E2E. |
| Qualità infrastruttura PR #39 | Buona (SW, TTL, share, honesty backend, Hub shell, test unit). |

**Verdetto:** **HOLD release stabile** — promuovere a **release candidate / pre-release** solo dopo correzione B1 o warning espliciti in-product sul salvataggio locale.
