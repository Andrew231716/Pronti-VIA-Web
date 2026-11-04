# Pronti? VIA!

Piattaforma web gratuita per organizzare viaggi individuali e di gruppo: idea → preventivo → itinerario → collaborazione → partenza → spese → archivio.

**Demo:** https://andrew231716.github.io/Pronti-VIA-Web/

## Caratteristiche

- Account + viaggi sincronizzati (Netlify Blobs / Supabase) con fallback locale onesto
- Itinerario, mappa Leaflet/OSM, preventivo, spese con ripartizione e FX
- Hub piattaforma: dashboard, votazioni, preparazione, calendario ICS, stats, backup, tema chiaro/scuro
- PWA installabile (iOS/Android) con shell offline
- Costo operativo obbligatorio: **zero** (vedi [COSTS.md](./COSTS.md))

## Avvio locale

```bash
npm install
npx --yes serve -l 3000 .
# oppure: node server.js
npm test
```

Apri `http://127.0.0.1:3000`. Le API `/api/*` su host statico passano da `api-shim.js` al proxy Netlify remoto o a `localStorage`.

## Documentazione

| File | Contenuto |
|---|---|
| [AUDIT.md](./AUDIT.md) | Problemi trovati e remediation |
| [ROADMAP.md](./ROADMAP.md) | Fasi e residui |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architettura |
| [CHANGELOG.md](./CHANGELOG.md) | Storia versioni |
| [SECURITY.md](./SECURITY.md) | Modello di sicurezza |
| [BACKUP.md](./BACKUP.md) | Backup / restore |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | GitHub Pages / Netlify / Vercel |
| [COSTS.md](./COSTS.md) | Servizi e limiti gratuiti |

## Struttura rapida

- `assets/index-loadfix-*.js` — SPA React (non riscrivere)
- Suite sidecar: `api-shim`, `magic-extras`, `expense-suite`, `app-suite`, `preventivo-islanda`, `ux-suite`, `pv-platform`
- `lib/*` — logica pura testabile
- `netlify/functions/*` — account, trips, share, places, search
- Stamp asset live: `20261104a`

## Principi

1. Non perdere dati né funzionalità esistenti  
2. Nessun servizio a pagamento obbligatorio  
3. Dichiarare sempre se un salvataggio è cloud o solo locale  
4. Compatibilità GitHub Pages + Netlify + Vercel  
