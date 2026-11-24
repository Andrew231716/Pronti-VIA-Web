# COSTS — conferma costo zero obbligatorio

Nessun servizio **obbligatorio** richiede abbonamento, crediti o carta di credito.

| Servizio | Ruolo | Piano | Registrazione | Chiave | Se raggiungi i limiti |
|---|---|---|---|---|---|
| GitHub Pages | Hosting statico | Free | Account GitHub | No | Soft throttle; resta online di solito |
| GitHub Actions | Deploy Pages | Free | Incluso | `GITHUB_TOKEN` auto | Minuti mensili; workflow è leggero |
| Netlify | Functions + Blobs | Free | Sì (per functions) | Env Blobs opzionale | 502 / fallback `api-shim` → localStorage |
| Supabase Edge | Trips primary | Free tier | Progetto già pubblico URL | URL in codice (no secret) | `trips.mjs` fallback KV |
| OpenStreetMap / Nominatim / Photon | Geocoding | Free | No | No | Cache client + errori soft |
| Leaflet (vendor) | Mappe | Free/OSS | No | No | — |
| Open-Meteo | Meteo | Free | No | No | Mostra ultimo dato con avviso / nasconde stale |
| Frankfurter / open.er-api | Cambio valuta | Free | No | No | Usa cache FX locale / input manuale |
| Pollinations | Testo AI opzionale | Free variabile | No | No | Fallback testo locale già in `magic-extras` |
| bytebin.lucko.me | Share overflow | Free | No | No | Share inline / Netlify share |

## Politica

- Non aggiungere API commerciali a pagamento né come fallback automatico.
- Preferire cache, timeout, retry limitati, modalità degradata offline.
- Se una feature richiederebbe un servizio a pagamento: **non attivarla**; offrire alternativa gratuita (es. ICS invece di Google Calendar sync).

## Costi nascosti da evitare

- Mappe Google / Mapbox a pagamento
- Storage foto cloud a pagamento
- SMS / email transazionali a pagamento
- LLM API con billing card

L’app è progettata per funzionare anche solo con static host + `localStorage` (funzionalità ridotta ma utilizzabile).
