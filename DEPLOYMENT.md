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

`vercel.json` riscrive `/api/*` verso la Supabase Edge function pubblica del progetto e fa SPA fallback. Nessuna Netlify Function su Vercel: account/share locali dipendono dal proxy Supabase o dal fallback client.

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
