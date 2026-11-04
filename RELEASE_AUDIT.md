# RELEASE AUDIT — Pronti? VIA!

**Stamp client live:** `20261104b`  
**Security CORS patch:** `20261104c`  
**PR:** https://github.com/Andrew231716/Pronti-VIA-Web/pull/39  
**Aggiornamento:** 4 novembre 2026 (Europe/Rome)  
**Metodo:** codice + `npm test` (syntax + unit 12+12+15) + Playwright E2E 17/17

Legenda: **PASS** / **FAIL** / **NOT VERIFIED** / **HOLD**

---

## Verdetto attuale

### **PASS** — candidato alla release stabile (con limiti documentati)

Il HOLD della final human review su **P1 CORS** è chiuso da `20261104c`.

| Criterio | Esito |
|---|---|
| B1 toast SPA onesto | **PASS** |
| Messaggio salvataggio = stato reale | **PASS** |
| Ruoli applicati o chiaramente limitati | **PASS** (soft RBAC + `docs/ROLE_LIMITS.md`) |
| Outbox non dichiara sync inesistenti | **PASS** |
| CORS allowlist esplicita (no `*.vercel.app` / `*.netlify.app`) | **PASS** (`20261104c`) |
| Test automatici | **PASS** |
| E2E principali | **PASS** (17/17) |
| Nessun servizio a pagamento obbligatorio | **PASS** |

**Residuo accettato:** RBAC soft (edit key condivisa) — vedi `docs/ROLE_LIMITS.md`.  
**Non unire / non pubblicare** senza approvazione esplicita.

---

## CORS — origini autorizzate (`20261104c`)

| Origine | Motivo |
|---|---|
| `https://andrew231716.github.io` | GitHub Pages del progetto (`package.json` homepage) |
| `https://pronti-via-k7es.netlify.app` | Sito Netlify Functions + Blobs (`api-shim` `NETLIFY_API`) |
| `http://localhost:3000` / `127.0.0.1:3000` | Dev locale |
| `http://localhost:8888` / `127.0.0.1:8888` | Netlify CLI tipico |
| `http://localhost:3456` / `127.0.0.1:3456` | Smoke/static serve usato in audit |
| `http://localhost:3457` / `127.0.0.1:3457` | Playwright E2E |

**Non in allowlist statica:** nessun hostname `*.vercel.app` concreto risulta nel repository (`vercel.json` riscrive `/api` same-origin verso Supabase; non serve CORS Netlify per un host Vercel inventato). Preview Vercel aggiuntive: solo via env `CORS_EXTRA_ORIGINS` con origini assolute validate.

**Rifiutati (prova unit):** `evil-attacker.vercel.app`, `evil-attacker.netlify.app`, lookalike, `*`, ftp/ws/file, domini esterni. Origini rifiutate **non** ricevono header `Access-Control-Allow-Origin`.

Consumatori: `account|trips|share|places|proxy|search.mjs` → `lib/cors.mjs`.

---

## Remediation 20261104c — P1 CORS

| | |
|---|---|
| **Stato precedente** | FAIL (final review) — regex platform-wide Vercel/Netlify |
| **Modifica** | Allowlist esplicita; no reflect unknown; env extras validati |
| **File** | `lib/cors.mjs`, `scripts/unit/test-cors-20261104c.mjs`, `package.json`, docs |
| **Test** | unit CORS 15/15 + `npm test` + E2E 17/17 |
| **Risultato** | **PASS** |

---

## Remediation 20261104b (sintesi)

B1 toast, outbox reale, soft RBAC, stamp client `20261104b` — restano **PASS** (dettaglio in `BUGS_AND_REGRESSIONS.md`).

---

## NOT VERIFIED

- Deploy live Pages/Netlify post-merge  
- Supabase RLS console  
- Device iOS/Android  
- Conflitto multi-device fisico  
