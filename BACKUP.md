# BACKUP — Pronti? VIA!

## Perché

Il backup è indipendente da GitHub Pages, Netlify e Supabase. Serve a non perdere viaggi se cambia hosting o scade un piano free.

## Export

1. Apri l’app → pulsante **Hub** → tab **Backup**.
2. **Scarica backup JSON**.
3. Il file ha:
   - `kind: "pronti-via-backup"`
   - `schema: 1`
   - `trips[]` (copie da `viavia-local-trips-v1`)
   - `preferences`, `localStores` (recent, archive)
   - metadati account **senza password/token**

## Import

1. Hub → Backup → seleziona file.
2. L’app **valida** kind/schema e mostra riepilogo (conteggio, titoli, data).
3. **Applica merge sicuro**:
   - aggiunge viaggi assenti;
   - sostituisce solo se `revision` importata è maggiore;
   - non cancella viaggi locali non presenti nel file.

## Altri export

| Formato | Dove |
|---|---|
| JSON viaggio singolo | Hub → Statistiche |
| CSV spese | Hub → Statistiche |
| ICS calendario | Hub → Calendario |
| Testo / KML / HTML offline | Menu strumenti esistenti (`ux-suite` / `app-suite`) |

## Ripristino emergenza

Se il cloud non risponde, `api-shim` continua a leggere/scrivere `localStorage`. Esporta un backup appena possibile quando torni online.

## Schema futuro

Incrementare `schema` solo in modo additivo. Import di schema più nuovo rispetto al client viene rifiutato con messaggio chiaro.
