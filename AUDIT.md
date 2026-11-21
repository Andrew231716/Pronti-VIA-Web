# AUDIT — Pronti? VIA!

**Data:** 4 novembre 2026 (Europe/Rome)  
**Branch di lavoro:** `cursor/evoluzione-completa-4f39`  
**Stamp asset live di partenza:** `20261102ai`

## Sommario

App statica (React SPA in `assets/index-loadfix-*.js`) arricchita da suite IIFE (`api-shim`, `magic-extras`, `expense-suite`, `app-suite`, `preventivo-islanda`, `ux-suite`) e account gate (`account.js`). Backend: Netlify Functions + Netlify Blobs, con proxy verso Supabase Edge e fallback KV/file/memoria. Hosting: GitHub Pages + Netlify/Vercel.

Stato: funzionalità di viaggio, spese, preventivo, mappa, meteo e PWA presenti; criticità su **onestà del salvataggio**, **sessione troppo lunga**, **share non protetto**, **SW con path errato**, **asset duplicati**.

---

## Problemi (con gravità)

### A1 — Service Worker precache path errato
| Campo | Valore |
|---|---|
| **File** | `sw.js` |
| **Righe** | 15 |
| **Descrizione** | Precache di `./assets/index-loadForm-20261029a.js` (Form). Su disco e in `account.js:509` il file reale è `index-loadfix-20261029a.js` (fix). |
| **Gravità** | Critica |
| **Conseguenza** | Precache fallisce per lo SPA React; offline PWA senza shell dell’app. |
| **Soluzione** | Allineare a `index-loadfix-20261029a.js`; aggiungere check CI case-sensitive. |

### A2 — Salvataggio “cloud” quando il backend è solo memoria
| Campo | Valore |
|---|---|
| **File** | `netlify/functions/trips.mjs`, `netlify/functions/_store.mjs` |
| **Righe** | `trips.mjs` 139–149, 205–214; `_store.mjs` 78–97 |
| **Descrizione** | `setJSON` può restituire `{ backend: "memory" }` ma la risposta API forza `local: false` / `source: "store"`. |
| **Gravità** | Critica |
| **Conseguenza** | Toast “salvato per tutti” mentre i dati spariscono al cold start del function worker. |
| **Soluzione** | Propagare `backend`; se `memory` → `local: true` (o 503) e UI onesta. |

### A3 — `api-shim` marca sempre cloud ok
| Campo | Valore |
|---|---|
| **File** | `api-shim.js` |
| **Righe** | ~1371–1460 |
| **Descrizione** | Su risposta OK stessa-origine/remota cache con `local: false` senza leggere `data.local` / `data.source`. |
| **Gravità** | Alta |
| **Conseguenza** | `__pvIsTripLocalOnly` mentisce; banner locale assente. |
| **Soluzione** | `local: Boolean(data.local) \|\| data.source === "memory"`. |

### A4 — Sessione ~10 anni
| Campo | Valore |
|---|---|
| **File** | `netlify/functions/account.mjs` |
| **Righe** | 3, 104–121, 176–179, 200–204 |
| **Descrizione** | `SESSION_TTL_MS = 10 anni` con refresh sliding; client salva token in `localStorage` senza scadenza. |
| **Gravità** | Alta (sicurezza) |
| **Conseguenza** | Token rubato ≈ accesso permanente. |
| **Soluzione** | TTL 30 giorni sliding + scadenza client + logout/revoca. |

### A5 — Share pubblico senza auth/TTL/protezione overwrite
| Campo | Valore |
|---|---|
| **File** | `netlify/functions/share.mjs` |
| **Righe** | 62–91 |
| **Descrizione** | POST senza autenticazione; invite 6 char sovrascrivibili; GET restituisce record intero (può includere `key`); nessun TTL reale. |
| **Gravità** | Alta |
| **Conseguenza** | Hijack invite, leak chiave edit, abuso storage. |
| **Soluzione** | Bearer edit key, TTL, strip `key` in GET, anti-overwrite, size limit, rate limit. |

### A6 — CORS `Access-Control-Allow-Origin: *`
| Campo | Valore |
|---|---|
| **File** | `_headers`, tutte le functions Netlify |
| **Righe** | varie |
| **Descrizione** | CORS aperto a qualsiasi origine. |
| **Gravità** | Media |
| **Conseguenza** | Siti terzi possono chiamare le API dal browser della vittima (con token se noto). |
| **Soluzione** | Allowlist GitHub Pages + Netlify + localhost. |

### A7 — Nessun rate limit su login/register
| Campo | Valore |
|---|---|
| **File** | `netlify/functions/account.mjs` |
| **Descrizione** | Nessuna protezione brute-force. |
| **Gravità** | Media |
| **Conseguenza** | Attacchi a dizionario sulle password. |
| **Soluzione** | Rate limit per IP/username (sliding window). |

### A8 — Manifest `start_url` stale
| Campo | Valore |
|---|---|
| **File** | `manifest.webmanifest`, `.github/workflows/pages.yml` |
| **Righe** | manifest 5; workflow ~87 |
| **Descrizione** | `?v=20261102x` mentre shell è `ai`. |
| **Gravità** | Bassa |
| **Conseguenza** | iOS può tenere shell vecchia. |
| **Soluzione** | Allineare stamp. |

### A9 — Decine di copie stampate obsolete in `assets/`
| Campo | Valore |
|---|---|
| **File** | `assets/*-20261102{c…ah}.js` |
| **Descrizione** | ~15 MB di duplicati non referenziati da `index.html`/`sw.js`. |
| **Gravità** | Media (manutenibilità / deploy size) |
| **Conseguenza** | Deploy lento, confusione versioni. |
| **Soluzione** | Conservare solo stamp live + SPA React; documentare policy. |

### A10 — Hash password client ≠ server
| Campo | Valore |
|---|---|
| **File** | `account.js` (PBKDF2 locale), `account.mjs` (scrypt) |
| **Gravità** | Media |
| **Conseguenza** | Account locale e cloud non compatibili 1:1. |
| **Soluzione** | Auth cloud-only quando online; locale solo fallback esplicito. |

### A11 — XSS residuo
| Campo | Valore |
|---|---|
| **File** | `magic-extras.js` (es. interpolazione `poi.day`) |
| **Gravità** | Media |
| **Conseguenza** | HTML injection se POI malevoli. |
| **Soluzione** | `escapeHtml` su tutti i campi in `innerHTML`. |

### A12 — Security headers incompleti
| Campo | Valore |
|---|---|
| **File** | `_headers`, `vercel.json` |
| **Descrizione** | Manca CSP, X-Frame-Options, X-Content-Type-Options. |
| **Gravità** | Media |
| **Soluzione** | Headers difensivi compatibili con Pages/Netlify. |

### A13 — README vuoto / docs incomplete
| Campo | Valore |
|---|---|
| **File** | `README.md` (16 byte) |
| **Gravità** | Bassa |
| **Soluzione** | Documentazione completa (questa evoluzione). |

### A14 — Test automatici insufficienti
| Campo | Valore |
|---|---|
| **File** | `package.json` script `test` = solo `--check` sintassi |
| **Gravità** | Media |
| **Soluzione** | Unit + integration + smoke Playwright/Puppeteer. |

### A15 — Funzionalità piattaforma incomplete
| Area | Stato |
|---|---|
| Dashboard intelligente | Parziale (filtri home) |
| Votazioni gruppo | Assente |
| Calendario + reminder | Parziale (ICS) |
| Backup/restore completo | Parziale (export account) |
| Statistiche multi-viaggio | Assente |
| Ruoli/permessi granulari | Parziale (canEdit / viewToken) |
| Archivio ricordi | Parziale |

---

## Inventario servizi esterni

| Servizio | Uso | Costo | Chiave | Limiti tipici |
|---|---|---|---|---|
| GitHub Pages | Hosting statico | Free | No | Soft bandwidth |
| Netlify Free | Functions + Blobs | Free | Env token Blobs | Quota funzioni/mese |
| Supabase Edge | Trips primary | Free tier | URL pubblico progetto | Rate edge |
| OpenStreetMap / Nominatim / Photon | Geocoding | Free | No | Usage policy, cache obbligatoria |
| Open-Meteo | Meteo | Free | No | Fair use |
| Frankfurter / open.er-api | FX | Free | No | Cache consigliata |
| Leaflet (vendor) | Mappe | Free | No | — |
| Pollinations | Testo AI “Pronty” | Free (variabile) | No | Rate/credit variabili → fallback locale già presente |
| bytebin.lucko.me | Share overflow | Free | No | TTL esterno |

Nessun servizio a pagamento obbligatorio è richiesto per il funzionamento base.

---

## Checkpoint

Audit completato prima delle modifiche di codice. Le fasi successive partono da questo elenco (A1–A15) e dalla roadmap.
