# UX/UI redesign — Hub, Menu e navigazione (`20261104g`)

**Branch:** `cursor/ux-ui-redesign-nav-hub-4f39`  
**Principio:** semplicità nell’utilizzo, completezza nelle funzionalità. Nessuna funzione eliminata o nascosta definitivamente.

---

## 1. Mappa funzionalità — PRIMA

### Chrome superiore
| Elemento | Dove | Note |
|---|---|---|
| Ciao, {nome} | `#pv-account-chip` | Solo saluto + Menu |
| Menu | `#pv-account-menu` | Lista piatta di strumenti |

### FAB flottanti
| ID | Ruolo | Posizione |
|---|---|---|
| `#pv-plat-fab` | Hub piattaforma | Basso-sinistra (post 20261104d) |
| `#pv-magic-open` / root bacchetta | IA Pronty | Basso-destra |
| `#pv-offline-chip` | Stato offline | Basso-sinistra (vicino Hub) |
| Preventivo launch | Isolanda/preventivo | Stack destro |

### Menu account (in viaggio) — struttura precedente
Sezione unica «Questo viaggio» con voci miste: Compagni, Preventivo vs spese, Codice invito, Checklist, Cerca, Altro + Account + Zona pericolosa.

### Menu (fuori viaggio)
Viaggi (gestisci / apri) + Account + Zona pericolosa.

### Hub (`pv-platform.js`) — funzioni (invariate)
Panoramica · Votazioni · Preparazione · Numeri · Calendario · Ricordi · Backup · Impostazioni  
(API, ruoli, outbox, theme, reminder locali — invariati.)

### Tab viaggio SPA (invariate)
Itinerario, Esplora/Luoghi, Preventivo, Prenotazioni, Spese, Documenti, Valigia, Note, ecc. — navigazione primaria del trip.

### Bacchetta magica (invariata)
`magic-extras-20261104e`: suggerimenti, Lingua sul posto, Web Speech, MyMemory.

### Problemi individuati
- Hub percepito come strumento «esterno» (FAB).
- Menu senza categorie → voci tecniche affollate.
- Duplicità: collabora solo via FAB; Menu non menzionava Hub.
- Offline chip + Hub competono in basso a sinistra.
- Bacchetta a rischio copertura (già mitigato in 20261104d spostando Hub a sinistra).

---

## 2. Mappa funzionalità — DOPO

### Chrome superiore (navigazione principale)
| Elemento | ID | Ruolo |
|---|---|---|
| Ciao, {nome} | chip label | Contesto account |
| **Hub** | `#pv-hub-nav` | Collabora (stesso pannello di prima) |
| **Menu** | `#pv-account-menu` | Strumenti e impostazioni account |

### FAB
| ID | Stato |
|---|---|
| `#pv-plat-fab` | **Nascosto** se `#pv-hub-nav` presente (`body.pv-hub-nav-ready`); resta fallback early-boot |
| Bacchetta | Invariata, basso-destra |
| Offline chip | **Alto-centro** sotto la chip account |

### Menu — nuova architettura

**In viaggio**
1. **Azioni rapide** — strumenti della sezione attiva + Cerca nel viaggio  
2. **Organizza** — Compagni · Invita con codice · Checklist partenza  
3. **Soldi** — Preventivo e spese  
4. **Collabora** — Apri Hub  
5. **Altro** — Attività, template, versioni, export (secondo livello)  
6. **Account** — Esci · Elimina account  
7. **Zona pericolosa** — Elimina viaggio  

**Fuori viaggio**
1. **I tuoi viaggi** — Gestisci · Crea/apri hint  
2. **Collabora** — Apri Hub (backup/impostazioni/panoramica)  
3. **Account** / **Zona pericolosa**

### Hub — organizzazione
- Titolo: **Hub · Collabora**
- Lead: «Voti, preparazione, numeri e backup…»
- Tab (stesse funzioni, etichette più chiare): Panoramica, Votazioni, Preparazione, Numeri, Calendario, Ricordi, Backup, Impostazioni
- Accesso: top-nav **Hub** + voce Menu **Apri Hub** (+ FAB fallback)

### Bacchetta / IA
Nessuna modifica a logica, endpoint o stamp `20261104e`.

---

## 3. Design system (coerenza)

| Token / pattern | Uso |
|---|---|
| Teal `#007d82` | Menu primario, Hub attivo, accent piattaforma |
| Hub chip idle | Fondo `#e7f4f4`, bordo teal soft |
| Hub chip attivo | Fondo teal, testo bianco (`aria-expanded`) |
| Tipografia Hub head | Georgia serif per titolo pannello |
| Hit target | `min-height` 36–40px, safe-area rispettate |
| Motion | Enter Hub solo all’apertura; tab switch senza bounce; `prefers-reduced-motion` |

---

## 4. File toccati

- `account.js` / `account.css` — Hub in chip + stili toolbar
- `pv-platform.js` → `assets/pv-platform-20261104g.js`
- `ux-suite.js` → `assets/ux-suite-20261104g.js`
- `index.html`, `404.html`, `sw.js` — stamp shell `20261104g`
- `e2e/run-rc-playwright.mjs`, `scripts/unit/test-fab-layout-20261104d.mjs`, `scripts/unit/test-hub-panel-fluid-20261104f.mjs`
- `CHANGELOG.md`, questo documento

---

## 5. Accessibilità funzioni (checklist regressione)

| Funzione | Raggiungibile via |
|---|---|
| Hub / voti / prep / backup / theme | Top Hub · Menu→Apri Hub · FAB fallback |
| Cerca, checklist, invitati, compagni | Menu → Organizza / Azioni rapide |
| Preventivo vs spese | Menu → Soldi |
| Template / export / revisioni | Menu → Altro |
| Bacchetta IA + Lingua | FAB destro (invariato) |
| Tab viaggio | SPA (invariata) |
| Account logout / delete | Menu → Account |
| Offline status | Chip alto-centro |

---

## 6. Non modificato di proposito

Backend Netlify, schema trip, CORS, sync/outbox, magic-extras, React SPA bundle, servizi a pagamento (nessuno introdotto).

## 7. Verifica approfondita

Vedi `docs/VERIFY_UX_20261104g.md`.  
E2E **30/30** + deep verify mobile/desktop **30/30** dopo fixture trip SPA-completa (`e2e/fixtures/valid-trip.mjs`).

## 8. Evoluzione stile (20261104h) — riferimenti utente

Applicato lo schema concettuale **Home · Viaggi · HUB · Assistente IA · Profilo**:
- navigazione primaria a capsula (glass) in basso;
- HUB come tab dedicata dell’ambiente collaborativo;
- IA sempre raggiungibile dalla nav (+ bacchetta flottante sopra la capsule);
- Profilo apre gli strumenti/account (ex Menu).

Brand teal Pronti? VIA! mantenuto; accenti soft su HUB/IA solo per stato attivo.


## 9. Polish 20261104i

- IA solo in capsule (bacchetta flottante nascosta con nav)
- Hub copy umana + Prossimi passi
- Onboarding 5 tab; Profilo ripulito; viaggi senza ID criptici
- Safe-area e stack FAB/Preventivo
