# FINAL RELEASE REVIEW — Pronti? VIA! `20261104b`

**Tipo:** revisione finale **solo lettura** (pre-merge PR #39)  
**Data:** 4 novembre 2026 (Europe/Rome)  
**Oggetto:** commit `29c7d604456ece4771e2e2a4fe0fbcc5aa621cd8` · branch `cursor/evoluzione-completa-4f39` · PR https://github.com/Andrew231716/Pronti-VIA-Web/pull/39  
**Vincoli rispettati in questa sessione:** nessun modifica applicativa, nessun commit, nessun merge, nessuna pubblicazione.

Legenda esiti: **PASS** / **FAIL** / **NOT VERIFIED**

---

## Verdetto finale

### **HOLD**

La remediation RC resta tecnicamente solida su B1/outbox/test, ma il **controllo 8 (CORS)** è **FAIL**: `lib/cors.mjs` consente **qualsiasi** origine `https://*.vercel.app` e `https://*.netlify.app`, quindi anche preview non controllate dal progetto.

Il merge di PR #39 **non è raccomandato** finché:
- il maintainer **accetta esplicitamente** quel pattern come rischio consapevole (free preview), **oppure**
- l’allowlist viene ristretta a origini Vercel/Netlify note/necessarie.

Gli altri controlli richiesti risultano PASS o NOT VERIFIED come sotto; **nessun segreto** e **nessun costo obbligatorio** rilevati nel tree.

---

## 1. Controlli richiesti (1–12)

| # | Controllo | Esito | Evidenza |
|---|---|---|---|
| 1 | Commit `29c7d60` = stato PR #39 | **PASS** | `HEAD` locale = `origin/cursor/evoluzione-completa-4f39` = `29c7d60…`; GitHub PR `head.sha` identico; ultimo commit PR = RC 20261104b |
| 2 | Modifiche sul branch corretto | **PASS** | Branch `cursor/evoluzione-completa-4f39`, base PR `main`, working tree **pulito** (nessun uncommitted runtime) |
| 3 | Niente file dimenticati / esclusioni | **PASS** | Diff `main...29c7d60` include stamp `assets/*-20261104b.js`, `lib/cors.mjs`, `docs/ROLE_LIMITS.md`, unit/E2E, functions, docs audit. Root suite byte-identiche agli stamp `20261104b` (verificato `cmp`). |
| 4 | `npm test` e `npm run test:e2e` riproducibili | **PASS** | Rieseguiti in questa sessione: syntax OK; unit 12+12 PASS; Playwright **17/17 PASS** |
| 5 | Nessun falso messaggio di sync | **PASS** | Live stamp `assets/index-loadform-20261104b.js`: **assente** `Salvato per tutti`; presenti `__pvSaveToast`/`__pvCreateToast`. Classificazione via `local`/`source`/`memory` in shim + unit/E2E. |
| 6 | Outbox non perde dati a chiusura/riavvio | **PASS** | Coda in `localStorage` key `viavia-platform-outbox-v1` (persiste chiusura/riavvio stesso profilo browser). Rimozione solo dopo conferma server non-ephemeral. |
| 7 | RBAC server + limiti edit key documentati | **PASS** | `trips.mjs` chiama `assertMutationAllowed` → **403**; legacy allow se manca memberId; limiti in `docs/ROLE_LIMITS.md` espliciti |
| 8 | CORS non autorizza Vercel non controllate | **FAIL** | Regex `/^https:\/\/[a-z0-9-]+\.vercel\.app$/i` (e analoga Netlify) **riflette** origini arbitrarie. Prova: `https://evil-attacker.vercel.app` → `allowed=true`. Nessun `*`, ma subdomain platform-wide sì. |
| 9 | Nessun segreto/token/chiave privata in repo | **PASS** | Nessun `.env`/`.pem` tracciato; nessun match `BEGIN PRIVATE KEY` / `sk_live_` / `ghp_` / `xox` con valore. Solo riferimenti `process.env.NETLIFY_*` e URL Edge Supabase **pubblico** (non service_role). |
| 10 | Nessun costo/servizio a pagamento obbligatorio | **PASS** | `package.json` deps: solo `@netlify/blobs`. Playwright installato on-the-fly in E2e, non dependency di produzione. Allineato a `COSTS.md`. |
| 11 | Compatibilità GitHub Pages + Netlify Functions | **PASS** (codice) / deploy live **NOT VERIFIED** | Pages workflow copia `assets/`, stamp `20261104b` in manifest; `netlify.toml` redirect `/api/*` → functions; CORS header su OPTIONS. **Nessun deploy Pages/Netlify eseguito in questa review.** |
| 12 | Rollback senza perdita dati | **PASS** (schema/dati) / procedura prod **NOT VERIFIED** | Nessuna migrazione distruttiva; ruoli additivi in `trip.meta.roles`; stamp `20261104a` ancora nel tree; commit precedenti `03d5199`/`5104c07` disponibili. Rollback = redeploy commit precedente. **Non eseguito** su hosting reale. |

---

## 2. Controlli superati (sintesi)

- Allineamento git/PR sul commit RC dichiarato.
- Working tree pulito sul branch della PR.
- Asset stamp live coerenti e toast SPA onesto sul path `20261104b`.
- Suite automatiche riprodotte con successo.
- Soft RBAC server presente + documentazione limiti edit key.
- Nessun segreto committed; nessuna dipendenza a pagamento obbligatoria.
- Outbox persistente su `localStorage` (no wipe cosmetico).
- Struttura deploy Pages/Netlify compatibile a livello di repository.

---

## 3. Problemi trovati

### P1 — CORS platform-wide Vercel/Netlify (**FAIL** sul controllo 8)
- **File:** `lib/cors.mjs` (usato da account/trips/share/places/proxy/search).
- **Fatto:** qualsiasi sottodominio `*.vercel.app` / `*.netlify.app` ottiene `Access-Control-Allow-Origin` echo.
- **Impatto:** un sito Vercel/Netlify di terzi può effettuare richieste browser cross-origin alle functions (resta necessaria edit key/Bearer per i dati sensibili; CORS non sostituisce l’auth, ma amplia la superficie browser).
- **Nota:** `foo.com` e `*` restano correttamente **non** echoati.

### P2 — Bundle SPA storici ancora con toast legacy (non live)
- `assets/index-loadform.js` e `assets/index-loadform-20261029a.js` contengono ancora `Salvato per tutti`.
- **Non referenziati** da `index.html` / `sw.js` / `account.js` (live = `20261104b`).
- Rischio solo se un client o un link esterno carica lo stamp vecchio.

### P3 — Flush outbox a cold-start già online
- Flush automatico su evento `online` e bottone Hub; **nessun** `flushOutbox()` obbligatorio al boot se il browser è già online.
- Le modifiche **non si perdono** (restano in `localStorage`), ma la sync può ritardare fino a offline→online o “Riprova sincronizzazione”.

---

## 4. Limitazioni residue

1. **RBAC soft:** senza `X-Pronti-Member-Id` chi ha la edit key condivisa può mutare (legacy). Documentato in `docs/ROLE_LIMITS.md`.
2. **Outbox tipizzata:** coda reale principalmente per `trip-put`.
3. **E2E trip API mockate** per ripetibilità free: non dimostrano Blobs/Supabase live.
4. **Pattern CORS preview** ampio (vedi P1).
5. Rumore SPA preesistente (`shares`/`transfers` non iterabili) filtrato in E2E, non introdotto come blocco funzionale dimostrato.

---

## 5. Verifiche che richiedono console Supabase o dispositivi fisici

| Voce | Esito |
|---|---|
| Policy RLS / Edge Function auth Supabase in console | **NOT VERIFIED** |
| Persistenza Blobs Netlify in produzione | **NOT VERIFIED** |
| Deploy reale GitHub Pages post-merge | **NOT VERIFIED** |
| Install PWA iOS/Android + offline device | **NOT VERIFIED** |
| Conflitto 409 multi-device fisico | **NOT VERIFIED** (solo simulato E2E) |
| Share publish/revoke end-to-end su Blobs live | **NOT VERIFIED** |
| Rollback deploy reale + verifica dati utente | **NOT VERIFIED** |
| Accettazione formale rischio CORS `*.vercel.app` | **NOT VERIFIED** (decisione humana)

---

## 6. Riproduzione test (eseguita qui)

```text
npm test
→ syntax OK
→ scripts/unit/run-all.mjs: 12 passed
→ scripts/unit/test-rc-20261104b.mjs: 12 passed

npm run test:e2e
→ 17/17 PASS
```

---

## 7. Raccomandazione al maintainer

1. **Non mergeare** finché P1 non è accettato o corretto.  
2. Se si vuole chiudere HOLD CORS senza cambiare prodotto: documentare esplicitamente “allowlist intenzionale di tutti i preview `*.vercel.app` / `*.netlify.app`” e procedere.  
3. Opzione minima di fix (fuori scope di questa review read-only): sostituire le regex aperte con origini Vercel/Netlify concrete note, lasciando Pages + localhost.

**Questo file non è stato committato** (vincolo: no commit in questa fase).
