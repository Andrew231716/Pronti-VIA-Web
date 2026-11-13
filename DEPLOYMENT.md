# DEPLOYMENT — Pronti? VIA!

## GitHub Pages (gratuito, consigliato per statico)

1. Push su `main`.
2. Workflow `.github/workflows/pages.yml` pubblica su branch `gh-pages` (orphan).
3. Settings → Pages → Source: branch `gh-pages` / root.
4. URL tipico: `https://<user>.github.io/Pronti-VIA-Web/`
5. Le chiamate `/api/*` sono intercettate da `api-shim.js` e inoltrate al Netlify remoto configurato, oppure restano in `localStorage`.

Nessuna carta di credito richiesta.

## Netlify (functions + Blobs)

1. Collega il repository.
2. Build: `npm install --omit=dev` (vedi `netlify.toml`).
3. Publish directory: `.`
4. Env opzionali per Blobs espliciti:
   - `NETLIFY_SITE_ID` / `SITE_ID`
   - `NETLIFY_BLOBS_TOKEN` / `NETLIFY_API_TOKEN`
5. Redirect `/api/*` → functions già definiti in `netlify.toml`.

Piano Free: sufficiente per uso personale/piccolo gruppo. Monitora quota functions.

## Vercel

Il progetto `pronti-via` pubblica il frontend da `main`. La funzione
`/api/trip-access` gestisce gli inviti personali e i nuovi viaggi creati offline.
Usa uno store Vercel Blob privato con `BLOB_READ_WRITE_TOKEN`, letture dall'origine
e aggiornamenti condizionali. Per lo sviluppo locale senza Blob, imposta
`PRONTI_KV_DIR` a una directory temporanea esplicita.

GitHub Pages usa la stessa funzione per queste operazioni. Gli account, i viaggi
precedenti e i link storici continuano a usare il servizio dati esistente.

## Aggiornare stamp asset

1. Modifica i file root (`api-shim.js`, …, `pv-platform.js`).
2. Copia in `assets/*-<stamp>.js`.
3. Aggiorna `index.html`, `404.html`, `sw.js`, `manifest.webmanifest`, `expense-suite` `ASSET_VER`.
4. Commit + push.

## Verifica post-deploy

- [ ] Login / logout
- [ ] Creazione viaggio e reload
- [ ] Offline: shell carica (Application → SW)
- [ ] Hub → Backup export
- [ ] Nessun errore console bloccante
