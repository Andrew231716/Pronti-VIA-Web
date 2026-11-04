# POST-MERGE REGRESSION AUDIT & FIX — `20261104d`

**Branch:** `cursor/fix-post-merge-regressions-4f39`  
**Base:** `main` (post merge PR #39 / `1bc39bf`)  
**Data:** 4 novembre 2026 (Europe/Rome)  
**Merge/publish:** non eseguiti (in attesa approvazione)

---

## 1. Cause individuate

### Bacchetta magica “scomparsa”
| | |
|---|---|
| **Ultima versione visibile/funzionante** | Pre-PR #39 tip `81fa2da` — `magic-extras` caricato, FAB `#pv-magic-open` (“Pronty · Bacchetta magica”) |
| **Commit in cui era presente** | Introdotta in `7d8593d` / ripristinata in `03a8693`; codice ancora nel tree post-merge |
| **Modifica che l’ha fatta “scomparire”** | `03d5199` (PR #39) introduce `pv-platform.js` con `#pv-plat-fab` a **destra**, `bottom: 72px`, **`z-index: 120100`**, mentre `#pv-magic-root` restava a **`z-index: 80`**. In più `ux-suite` forza la bacchetta a `bottom: 18px !important` (stesso angolo). L’Hub **copre** la bacchetta: non è stata eliminata dal codice. |
| **Gate secondario verificato** | `renderFab()` usava `document.querySelector("main.loading")`, ma la SPA riusa `class="loading"` anche sullo schermo errore («Non riusciamo ad aprire il viaggio»). Su trip falliti la bacchetta non veniva mai montata (CSS mai iniettato). |
| **Evidenza** | `index.html` carica ancora `magic-extras-*.js`; AI Pollinations / tabs Idee·Chiedi·Lingua invariati |

### Hub che si sovrappone
Causa: nuovo FAB destro in collisione con Pronty / Preventivo / dock / home indicator.

### Fluidità percepita peggiore
Cause verificabili: (1) due FAB che si combattono sullo stesso angolo; (2) Hub panel senza transizione; (3) work del `MutationObserver` magic anche in background tab. Non risulta una riscrittura massiva del path di rendering React.

---

## 2. File modificati

- `pv-platform.js` (+ stamp `assets/pv-platform-20261104d.js`)
- `magic-extras.js` (+ stamp) — stacking + gate spinner-only + hide Hub su `pv-magic-open`
- `ux-suite.js` (+ stamp) — z-index FAB destra + chip offline offset
- `index.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `account.js`, `.github/workflows/pages.yml`
- `assets/*-20261104d.js` (copie stamp)
- `scripts/unit/test-fab-layout-20261104d.mjs`
- `e2e/run-rc-playwright.mjs` — assert Hub left + `#pv-magic-open` visible + no overlap
- `package.json`, `CHANGELOG.md`, questo report

---

## 3. Problemi corretti

1. Hub spostato a **sinistra** (safe-area), panel desktop ancorato a sinistra.  
2. Bacchetta: `magic-root` → z-index `120040` / btn `120050`; non più sotto Hub.  
3. `body.pv-magic-open` nasconde Hub (e viceversa non invade lo sheet).  
4. Chip offline spostato a destra dell’Hub.  
5. Transizione Hub + reduced-motion; skip tick magic se tab nascosta.  
6. `renderFab` blocca solo su `main.loading .spin` (non sullo schermo errore).

---

## 4. Ripristino bacchetta magica

**Non ricreata:** ripristinati stacking/posizionamento del componente originale in `magic-extras.js` (stesso `#pv-magic-open`, tabs Idee/Chiedi/Lingua, Pollinations/fallback locale).  
Visibile di nuovo a **destra** quando c’è sessione + hash `#trip&key=` (comportamento originale `renderFab`).  
Verifica browser: panel Pronty apre con chip Itinerario / Dove mangiare / Cosa vedere e chat «Scrivi a Pronty…».

---

## 5. Miglioramenti prestazionali ottenuti

- Meno contesa layout FAB (causa principale della “pesantezza” percepita).  
- Hub panel con transform/opacity + `contain`.  
- Nessun tick magic su tab `document.hidden`.  
- Non è stato spezzato `magic-extras.js` (fuori scope; rischio regressione).

---

## 6. Test eseguiti

| Suite | Risultato |
|---|---|
| `npm test` (syntax + unit incl. FAB layout) | **PASS** |
| `npm run test:e2e` | **21/21 PASS** (Hub left + `#pv-magic-open` visible + no overlap) |
| Screenshot mobile/desktop Hub+Pronty | **PASS** (`hub-left-magic-right-*.png`) |
| Apertura panel bacchetta | **PASS** (`bacchetta-panel-open.png`) |

E2E geometry (desktop viewport Playwright): Hub `left≈24px`, magic `left≈1204`, `overlap:false`.

---

## 7. Problemi ancora aperti

- Bacchetta resta nascosta su home/login senza viaggio aperto (**by design** preesistente).  
- Verifica tattile su iPhone reale / safe-area hardware: **NOT VERIFIED** qui.  
- Prestazioni Lighthouse/React profiling: **NOT VERIFIED**.  
- AI live Pollinations dipende dalla rete free-tier (error path già gestito).  
- Animazione float FAB può far risultare «unstable» i click Playwright (forzati in smoke shot; UX reale ok al tap).

---

## 8. Verifiche su dispositivo fisico consigliate

- iPhone: Hub sinistra + Pronty destra con viaggio aperto, safe-area home indicator.  
- Aprire bacchetta → Hub nascosto → chiudere → Hub torna.  
- Chat “Chiedi” con rete on/off.
