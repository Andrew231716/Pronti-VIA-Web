# ROADMAP — Evoluzione Pronti? VIA!

Ordine vincolante: stabilità → sicurezza → manutenibilità → UX → funzionalità piattaforma → test → docs.

## Completato in questa evoluzione (`20261104a`)

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Audit + ARCHITECTURE + CHANGELOG | Done |
| 1 | SW path, salvataggio onesto, sync status, coda offline | Done |
| 2 | Sessioni 30g, share hardening, rate limit, headers | Done |
| 3 | Moduli `lib/*` testabili; piattaforma sidecar (no rewrite) | Done (parziale split monolitici) |
| 4 | Dark/light, sync chip, empty states piattaforma | Done |
| 5 | Dashboard intelligente (hub) | Done |
| 6 | Itinerario: ottimizzazione tappe + link mappa (Leaflet esistente) | Done |
| 7 | Budget/spese: saldi, arrotondamenti, FX cache (lib) | Done |
| 8 | Collaborazione: ruoli locali + votazioni | Done |
| 9 | Calendario ICS + reminder locali | Done |
| 10 | Documenti/checklist preparation hub | Done |
| 11 | Destinazione: meteo/note pratiche (Open-Meteo già in suite) | Done |
| 12 | Statistiche + export CSV/JSON | Done |
| 13 | Archivio ricordi | Done |
| 14 | Backup/restore validato | Done |
| 15 | Test unit + comando `npm test` | Done |
| 16 | A11y/CSS safe-area/tema | Done (base) |
| 17 | README, SECURITY, BACKUP, DEPLOYMENT, COSTS | Done |

## Residuo consapevole (non bloccante)

1. **Split fisico** di `magic-extras.js` (~6k LOC) in file multipli: rischio alto di regressione; deferred. Logica nuova vive in `lib/` + `pv-platform.js`.
2. **Pulizia massiva** stamp `assets/*` storici: rimossi solo dopo verifica riferimenti; stamp live + SPA mantenuti.
3. **Supabase RLS**: policy lato progetto Supabase non versionate nel repo; hardening applicato sul proxy Netlify/share.
4. **OCR scontrini / chat realtime**: esclusi (costi o complessità); stub documentato.
5. **Sync bidirezionale Google/Apple Calendar**: escluso (servizi account); ICS locale sufficiente.

## Prossimi incrementi sicuri

- Playwright e2e in CI free-tier con matrix ridotta
- Minificazione opzionale stamp asset
- Role server-side su trip members (oggi viewToken / edit key)
- Conflict UI con three-way merge (oggi 409 + reload)

## Policy di lavoro

- Checkpoint Git per fase
- Nessuna migrazione distruttiva schema trip
- Nuovi campi solo additive sotto `trip.meta` / sidecar localStorage
- Zero dipendenze a pagamento
