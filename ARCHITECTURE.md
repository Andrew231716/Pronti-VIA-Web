# ARCHITECTURE — Pronti? VIA!

## Panoramica

```
Browser (PWA)
├── index.html (shell)
├── account.js          → gate login / sessione / import SPA
├── api-shim.js         → patch fetch /api/* (Netlify → localStorage)
├── magic-extras.js     → itinerario, Pronty, map pins, save helpers
├── expense-suite.js    → spese, FX, SW register
├── app-suite.js        → dock strumenti, home filters, sync chip, pack
├── preventivo-islanda.js → preventivo intelligente
├── ux-suite.js         → menu/FABs UX
├── pv-platform.js      → dashboard, voti, stats, backup, tema, reminder
├── assets/index-loadfix-*.js → React SPA (trip CRUD UI)
└── sw.js               → offline shell cache

Netlify Functions
├── account.mjs   → register/login/logout/me/save-trips (Blobs)
├── trips.mjs     → proxy Supabase + KV fallback (_store)
├── share.mjs     → snapshot pubblici (TTL + strip key)
├── places.mjs    → geocoding proxy
├── search.mjs    → live search preventivo
├── proxy.mjs     → catch-all /api/*
└── _store.mjs    → Blobs → file → memory (backend dichiarato)

Hosting
├── GitHub Pages (statico, api-shim → Netlify remoto)
├── Netlify (functions + static)
└── Vercel (rewrite → Supabase; no functions repo)
```

## Flusso salvataggio viaggio

1. UI/React o suite chiama `PUT /api/trips/:id` con `Authorization: Bearer <editKey>` e `revision`.
2. `api-shim` serializza le write (`__pvEnqueueTripWrite`).
3. Stesso-origin Netlify → `trips.mjs` prova Supabase; se 5xx → `_store`.
4. Risposta include `local`, `source` (`blobs`|`file`|`memory`|`supabase`), `revision`.
5. Client: se `local` o `source===memory` → stato “solo dispositivo”; altrimenti “cloud”.
6. Conflict 409 → messaggio utente, no overwrite silenzioso.
7. Coda offline (`viavia-sync-queue-v1` + `viavia-platform-outbox-v1`) riprovata su `online`.

## Modello dati viaggio (additive)

Campi React storici: `title`, `destination`, `start`, `end`, `members`, `stops`, `bookings`, `expenses`, `transfers`, `checklist`, `notes`, `budget`, `files`…

Estensioni non distruttive:

```json
{
  "meta": {
    "blockedMembers": [],
    "roles": { "<memberId>": "owner|admin|member|readonly" },
    "polls": [],
    "preparation": { "docs": [], "departureChecklist": [] },
    "destinationNotes": {},
    "archive": { "memories": [], "diary": [] },
    "reminders": []
  }
}
```

Sidecar localStorage (non sensibili): preferenze tema, FX cache, coda sync, meta card home.

## Auth

- Password server: scrypt + salt random.
- Session token: 32 byte hex, TTL 30 giorni sliding su `me`.
- Trip auth: edit `key` (Bearer) vs `viewToken` read-only.
- Guest: hash `#trip=&key=` senza account persistente forzato.

## PWA

- Cache name versionata `pv-shell-<stamp>`.
- Precache shell + suite + SPA `index-loadfix-*` + Leaflet vendor.
- Network-first same-origin GET; offline → cache; navigate → `index.html`.
- API `/api/*` mai cachate dal SW.

## Principi

1. Non riscrivere lo SPA React minificato.
2. Suite sidecar + `lib/` per nuova logica testabile.
3. Costo zero: OSM, Open-Meteo, Frankfurter, Blobs free, Pages.
4. Dichiarare sempre la verità sul persistenza (`local`/`source`).
