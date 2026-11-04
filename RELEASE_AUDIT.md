# RELEASE AUDIT — Pronti? VIA! post PR #39

**Riferimento report:** Report evoluzione — Pronti? VIA! · stamp `20261104a`  
**PR:** https://github.com/Andrew231716/Pronti-VIA-Web/pull/39 · commit `03d5199`  
**Data audit:** 4 novembre 2026 (Europe/Rome)  
**Metodo:** revisione codice reale + `npm test` + smoke Puppeteer headless su `http://localhost:3456`  
**Vincolo rispettato:** nessuna modifica al codice applicativo durante questo audit.

Legenda esiti: **PASS** / **FAIL** / **NOT VERIFIED**

---

## 0. Ambito PR #39

| Voce | Valore | Esito |
|---|---|---|
| Commit unico | `03d5199` | PASS |
| Diff vs `main` | 188 file, +4388 / −362160 (principalmente asset stamp obsolete) | PASS |
| Stamp live | `20261104a` in `index.html`, `404.html`, `sw.js`, suite | PASS |
| Stamp root ↔ assets sync | `api-shim`, `magic-extras`, `pv-platform` byte-identici allo stamp | PASS |
| Nuove dipendenze a pagamento | Nessuna (`@netlify/blobs` già presente) | PASS |

**Prova:** `git diff --stat origin/main...origin/cursor/evoluzione-completa-4f39`; confronto byte stamp; `package.json`.

---

## 1. PWA / Service Worker

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Precache path SPA | **PASS** | `sw.js` elenca `./assets/index-loadfix-20261029a.js`; file presente su disco; allineato a `account.js` import. Nessun `loadForm` nel path (solo commento). |
| Tutti i file precache esistono | **PASS** | Script Python: `MISSING_COUNT 0` su 23 entry PRECACHE. |
| Hub in precache | **PASS** | `./assets/pv-platform-20261104a.js` in `sw.js` e caricato da `index.html`. |
| Registrazione SW runtime | **PASS** | Smoke: `active = /sw.js?v=20261104a`, state `activated`, scope `/`. |
| Cache name | **PASS** | Smoke: `caches = ["pv-shell-20261104a"]`. |
| Install / activate / skipWaiting | **PASS** | Codice `sw.js` install→`skipWaiting`, activate→delete altre cache + `clients.claim`. |
| Offline shell | **PASS** | Smoke: `setOfflineMode(true)` + reload → titolo app, login gate e Hub FAB ancora presenti; messaggio locale cloud non raggiungibile. |
| Install prompt iOS/Android UX | **NOT VERIFIED** | Banner “Installa” visibile in smoke desktop; install reale su iPhone/Android non eseguita. |
| Update SW su utenti già installati | **NOT VERIFIED** | Logica codice ok; non testato su PWA già installata con cache `ai`. |
| Safari iOS standalone | **NOT VERIFIED** | Nessun device iOS in questa sessione. |

---

## 2. Salvataggio locale / cloud / sync

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Backend dichiara memory come non durevole | **PASS** | `trips.mjs` `persistenceFlags()` → `local:true` se `backend==="memory"`. |
| `api-shim` rispetta ephemeral | **PASS** | `isEphemeralPersistence()` + forzatura `local:true` in `cacheTripRecord` e path PUT/POST. |
| Hub mostra stato onesto | **PASS** | `pv-platform.js` controlla `out.local` / `source==="memory"` prima del toast. |
| SPA React toast “Salvato per tutti” | **FAIL** | In `assets/index-loadfix-20261029a.js`, dopo PUT ok: `ih.success(\`Salvato per tutti\`)` **senza** leggere `o.local`/`source`. |
| `ux-suite` toast generico | **FAIL** | `toast("Salvato", …)` su PUT ok senza check `local`. |
| Optimistic lock 409 server | **PASS** | `trips.mjs` confronta `clientRev` vs `serverRev`, risponde 409. |
| 409 gestito in SPA | **PASS** | Stesso file SPA: `e.status===409&&await Ge(n,!0)` poi throw. |
| 409 in Hub | **PASS** | `pv-platform` messaggio conflitto esplicito. |
| Outbox Hub “Riprova sincronizzazione” | **FAIL** | `OUTBOX_KEY` solo letto/svuotato; **nessun enqueue** di operazioni fallite. UI cosmetica. |
| Coda `app-suite` sync | **PASS (parziale)** | Coda reale per meta spese; non coda trip PUT generica. |
| Serializzazione write | **PASS** | `__pvEnqueueTripWrite` catena in-memory. |
| Conflitto multi-device end-to-end | **NOT VERIFIED** | Non simulato con due client reali sullo stesso trip. |
| Persistenza Netlify Blobs in prod | **NOT VERIFIED** | Dipende da env/deploy; non interrogato. |

---

## 3. Autenticazione / sessioni / logout

| Controllo | Esito | Motivo / prova |
|---|---|---|
| TTL server 30 giorni | **PASS** | `SESSION_TTL_MS = 1000*60*60*24*30` in `account.mjs` (non più 10 anni). |
| Sliding refresh | **PASS** | `getSession` rinnova `expiresAt`. |
| Client `expiresAt` | **PASS** | `account.js` `CLIENT_SESSION_TTL_MS`, check in `readSession`, stamp su login/`me`. |
| Logout revoca token | **PASS** | `action===logout` → `store.delete(session:…)`. |
| Rate limit login/register | **PASS (codice)** | Map in-memory; login 20/15m, register 10/15m. |
| Rate limit multi-istanza | **NOT VERIFIED** | Non condiviso tra isolate Netlify. |
| Login gate runtime | **PASS** | Smoke: form Accedi/Crea account renderizzato, senza pageerror. |
| Sessione scaduta UX | **NOT VERIFIED** | Non forzata scadenza artificiale in browser. |
| Hash password client≠server | **PASS (documentato rischio)** | PBKDF2 locale vs scrypt server: intenzionale per fallback offline, non unificato. |

---

## 4. Condivisioni / autorizzazioni

| Controllo | Esito | Motivo / prova |
|---|---|---|
| TTL share | **PASS** | `DEFAULT_TTL_DAYS=90`; GET scaduto → delete + 404. |
| Strip edit key in GET pubblico | **PASS** | `publicRecord` imposta `key:""`, `canEdit:false`. |
| Invite overwrite protetto | **PASS** | 409 senza Bearer owner. |
| Revoca DELETE | **PASS** | Richiede `revokeToken`/`key`. |
| Rate limit + size limit share | **PASS** | 30/15m IP; max ~900KB. |
| Flusso browser publish/revoke | **NOT VERIFIED** | Solo analisi codice; nessun POST share live. |
| Link `#trip&key=` guest | **PASS (codice)** | Guest session su hash share. Runtime join **NOT VERIFIED**. |

---

## 5. Ruoli / permessi tra utenti

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Libreria `lib/roles.mjs` | **PASS** | Unit test ruoli verdi. |
| Enforcement UI/backend | **FAIL** | `can` / `roleMapFromTrip` usati **solo** in `scripts/unit/run-all.mjs`. Nessun import in suite runtime. |
| Gate reale | **PASS (modello attuale)** | Edit key Bearer vs `viewToken` / `canEdit`. |
| RBAC collaborativo “owner/admin/member/readonly” come feature prodotto | **FAIL** | Dichiarata in roadmap/hub docs ma **non operativa** nell’app. |

---

## 6. Votazioni / spese / calcoli

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Logica polls unit | **PASS** | `lib/polls` create/vote/close 12/12 suite. |
| UI Hub tab Voti | **PASS (smoke UI)** | Tab `polls` presente; create/vote richiedono viaggio aperto → **NOT VERIFIED** end-to-end su trip reale. |
| Spese UI | **PASS (presenza)** | `expense-suite-20261104a.js` caricato; non rieseguito E2E spese in questo audit. |
| Calcoli money unit | **PASS** | split/balances/settle unit PASS. |
| Hub usa `lib/money` | **FAIL (manutenibilità)** | Duplica helper; non importa `lib/money.mjs`. |
| Script storico spese | **NOT VERIFIED** | `scripts/test-expense-fx.mjs` non rieseguito (richiede Puppeteer + API). |

---

## 7. Dashboard / calendario / notifiche / preparazione / archivio

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Hub FAB + panel | **PASS** | Smoke: FAB visibile; click apre panel con tabs Dashboard…Impostazioni; empty state “Benvenuto”. |
| API `ProntiPlatform` | **PASS** | `typeof window.ProntiPlatform === "object"`. |
| Dashboard con viaggio reale | **NOT VERIFIED** | Nessun trip creato in smoke. |
| Calendario ICS generazione | **PASS (unit + codice)** | `lib/ics` + download Hub; file ICS non scaricato in browser smoke. |
| Notifiche locali | **NOT VERIFIED** | Codice guarda `Notification`; permesso/scheduling non testati. |
| Preparazione / archivio UI | **PASS (presenza tab)** | Tab presenti; mutazioni su trip **NOT VERIFIED**. |
| Backup export/import UI | **PASS (codice + unit)** | validate/planRestore unit PASS; UI tab Backup presente; click file input **NOT VERIFIED**. |

---

## 8. Responsive / accessibilità

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Viewport mobile 390×844 | **PASS** | Smoke: shell + Hub FAB + gate leggibili. |
| Viewport desktop 1280×800 | **PASS** | Hub FAB presente. |
| Focus / tastiera / screen reader | **NOT VERIFIED** | Non eseguito audit a11y strumentale. |
| Contrasto dark mode | **NOT VERIFIED** | Tema `light` applicato; dark non esercitato in smoke. |
| Safe-area iPhone | **NOT VERIFIED** | Solo CSS presente. |

---

## 9. Console / API / prestazioni

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Page errors JS | **PASS** | Smoke: `pageErrors: []`. |
| Console error attesi offline | **PASS (atteso)** | `ERR_INTERNET_DISCONNECTED` verso Netlify trips in offline. |
| 404 Netlify `/api/trips` online | **NOT VERIFIED / attenzione** | Anche online compare 404 verso `pronti-via-k7es.netlify.app/api/trips` (probe senza auth?). Non bloccante per gate, da chiarire in staging. |
| Bundle size / LCP | **NOT VERIFIED** | Non misurato Lighthouse. |
| Prestazioni Hub | **NOT VERIFIED** | Nessun profiling. |

---

## 10. Supabase RLS

| Controllo | Esito | Motivo / prova |
|---|---|---|
| Policy nel repository | **NOT VERIFIED** | Nessun `.sql` / migration RLS. Solo URL Edge in codice. |
| Comportamento Edge live | **NOT VERIFIED** | Richiede accesso progetto Supabase. |

---

## 11. Test automatici eseguiti in questo audit

| Suite | Esito | Prova |
|---|---|---|
| `npm test` syntax + 12 unit | **PASS** | Output completo 12 passed, 0 failed |
| Smoke Puppeteer SW/Hub/offline | **PASS (parziale)** | Artifact `/opt/cursor/artifacts/pv-runtime-smoke.json` |
| E2E legacy `scripts/test-expense-fx.mjs` ecc. | **NOT VERIFIED** | Non rieseguiti |

---

## Sintesi giudiziaria (dettaglio in BUGS_AND_REGRESSIONS.md)

### Problemi bloccanti
1. **Messaggio “Salvato per tutti” della SPA anche quando `local/source=memory`** — rischio perdita dati percepita come sync cloud.

### Problemi importanti
1. Hub outbox cosmetico (nessuna coda reale).  
2. Ruoli `lib/roles` non enforced.  
3. CORS senza `*.vercel.app` se si usa Vercel + Netlify account/share.  
4. Feature collaborative (voti/backup/prep su trip) non E2E-verificate.

### Miglioramenti consigliati
- Collegare toast SPA/ux-suite a `local`/`source`.  
- Enqueue outbox reale o rimuovere UI fuorviante.  
- Wired roles o de-scope dalla release notes.  
- Pulire stamp `*-20261102ai.js` residui.  
- Suite E2E gratuita (vedi `E2E_TEST_PLAN.md`).

### Verifiche manuali ancora necessarie
- iPhone PWA install + offline.  
- Due dispositivi stesso viaggio (conflict 409).  
- Share publish/revoke con invite.  
- Login → create trip → save → reload.  
- Backup export/import su dati reali.  
- Supabase RLS in console.  
- Dark mode + a11y tastiera.

### Giudizio release

**NON PRONTA come “release stabile” dichiarata completa** finché il FAIL bloccante sul toast SPA di salvataggio non è corretto (o mitigato in release notes + Hub-only messaging).

**Condizionatamente pubblicabile come pre-release / release candidata** se:
- si documenta chiaramente il limite toast SPA, **e**
- si completa checklist manuale minima (login, create trip, offline shell, Hub empty state già verificato in smoke), **e**
- non si commercializza RBAC/votazioni multiutente come “completati al 100%” senza E2E.

Stabilità shell PWA / stamp / sessioni 30g / share hardening lato codice: **buona base**. Affidabilità percepita del salvataggio cloud: **ancora insufficiente** per dichiarazione di release completa.
