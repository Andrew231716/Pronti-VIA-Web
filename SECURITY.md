# SECURITY — Pronti? VIA!

## Autenticazione

- Password server-side: **scrypt** + salt random 16 byte, confronto `timingSafeEqual`.
- Session token: 32 byte hex casuali, salvati in Netlify Blobs come `session:<token>`.
- **TTL sessione: 30 giorni** con refresh sliding su `GET me` (prima: ~10 anni).
- Client: `expiresAt` in `localStorage`; sessione scaduta → logout automatico.
- Logout / delete-account revocano il token corrente (delete-account tenta sweep sessioni utente).

## Rate limiting

- Login: max 20 richieste / 15 min / IP (in-memory per istanza function).
- Register: max 10 / 15 min / IP.
- Share POST: max 30 / 15 min / IP.

## Viaggi e chiavi

- Ogni viaggio ha `key` (edit) e `viewToken` (sola lettura).
- Optimistic locking su `revision` → HTTP 409 in caso di conflitto.
- Budget privato non viene scritto nel blob condiviso (`api-shim` forza `budget: 0` in cache condivisa).

## Condivisioni pubbliche

- Snapshot con **TTL** (default 90 giorni, max 365).
- GET pubblico **non espone** la edit `key`.
- Invite code 6 caratteri: overwrite solo con Bearer = revokeToken/key.
- DELETE con revoke token.
- Limite payload ~900 KB.

## CORS e headers

- Allowlist: GitHub Pages del progetto, `*.netlify.app`, localhost.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP base in `_headers`.
- Referrer-Policy: `no-referrer`.

## Cosa non fare

- Non committare token Blobs / service role Supabase.
- Non mettere password in URL.
- Non trattare i link `#trip=&key=` come segreti eterni: chi ha il link edit può modificare; usa viewToken per sola lettura.

## XSS

- Le suite usano `escapeHtml` sui contenuti utente in `innerHTML`.
- Nuovo hub (`pv-platform`) escapa tutti i campi renderizzati.
- Segnalare eventuali residui in `magic-extras` POI fields.

## Report

Apri una issue privata o contatta il maintainer del repository GitHub.
