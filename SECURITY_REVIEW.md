# SECURITY REVIEW — Pronti? VIA! post PR #39 (`20261104a`)

**Data:** 4 novembre 2026 (Europe/Rome)  
**Scope:** autenticazione, sessioni, share, CORS/CSP, salvataggio, ruoli, Supabase RLS  
**Metodo:** code review + unit test; **nessun penetration test live** su produzione.  
**Nessuna modifica codice** durante la review.

---

## Sintesi

| Area | Esito | Note |
|---|---|---|
| Session TTL | **PASS** | 30 giorni sliding (era ~10 anni) |
| Password hashing server | **PASS** | scrypt + timingSafeEqual |
| Rate limit auth/share | **PASS (codice)** | in-memory per istanza |
| Share public key leak | **PASS** | `publicRecord` strip key |
| Share invite hijack | **PASS (mitigato)** | overwrite richiede Bearer |
| CORS | **PASS / FAIL parziale** | allowlist ok per Pages/Netlify; **manca vercel.app** |
| CSP / headers | **PASS (base)** | `_headers` + vercel XFO/nosniff |
| RLS Supabase | **NOT VERIFIED** | fuori repository |
| RBAC trip members | **FAIL** | libreria non collegata; gate = edit key |
| Secrets in repo | **PASS** | no private keys; URL Supabase pubblico già noto |

---

## 1. Autenticazione e sessioni

### PASS
- `SESSION_TTL_MS = 30d` in `netlify/functions/account.mjs`.
- Refresh sliding su `getSession`.
- Client `expiresAt` in `account.js` (`readSession` invalida scadute).
- Logout cancella `session:<token>`.
- Delete-account richiede password + sweep sessioni best-effort.
- Validazione username/password (lunghezza, lettera+numero).

### FAIL / rischi
- **Hash split:** locale PBKDF2 vs server scrypt — account offline e cloud non sono lo stesso store. Rischio confusione, non leak diretto.
- **Token in `localStorage`:** XSS potrebbe rubare sessione (mitigato in parte da escapeHtml; CSP non elimina totalmente inline scripts legacy).
- **Rate limit non distribuito:** su cold start multipli di Netlify Functions i bucket si resettano → **NOT VERIFIED** efficacia anti-brute in prod.

### NOT VERIFIED
- Scadenza end-to-end forzata in browser.
- Enumerazione username via timing register/login.

---

## 2. Autorizzazione viaggi

### PASS
- Edit: Bearer == `record.key`.
- View: Bearer == `key` o `viewToken`.
- DELETE solo con edit key.
- Optimistic concurrency `revision` → 409.

### FAIL
- **Ruoli owner/admin/member/readonly** (`lib/roles.mjs`) **non enforced** in UI né backend. Chiunque con edit key ha poteri pieni.
- Hub mutazioni (polls, meta) richiedono `canEdit` API, non ruolo membro.

### NOT VERIFIED
- Comportamento Supabase Edge rispetto alle stesse regole (proxy `trips.mjs`).

---

## 3. Condivisioni pubbliche

### PASS
- TTL default 90g, max 365g; GET scaduto elimina record.
- GET pubblico: `key=""`, `canEdit:false`, preview limitata.
- Invite 6 char: no overwrite anonimo.
- DELETE con `revokeToken` o key.
- Size cap ~900KB; rate limit POST.

### NOT VERIFIED
- Abuso storage Blobs oltre rate limit singolo IP.
- Contenuto `trip` in snapshot: può ancora includere note/spese se il publisher le ha messe nel record (by design share); **documenti privati** dipendono dal fatto che non siano nel payload — non auditato payload reale client.

---

## 4. CORS, CSP, headers

### PASS
- Allowlist: `andrew231716.github.io`, netlify app, localhost regex.
- `_headers`: nosniff, DENY frame, referrer no-referrer, CSP base, Permissions-Policy.
- `vercel.json`: Referrer-Policy, nosniff, X-Frame-Options.

### FAIL
- **Nessun `*.vercel.app`** nelle allowlist delle Netlify Functions. Un frontend su Vercel che chiama Netlify account/share cross-origin può ricevere CORS error.
- CSP include `'unsafe-inline'` e `'unsafe-eval'` (necessari allo stack attuale) → XSS mitigation **parziale**.

### NOT VERIFIED
- Comportamento reale CSP su tutti i browser target.
- GitHub Pages non applica `_headers` Netlify: su Pages valgono solo header Pages; difesa API resta lato function CORS.

---

## 5. Integrità dati / salvataggio

### PASS
- Dichiarazione `local`/`source` da `_store` → `trips.mjs` → `api-shim`.
- Hub non mente sul backend memory.

### FAIL (impatto sicurezza/affidabilità)
- SPA React toast **“Salvato per tutti”** ignora `local` → utente può credere a sync cloud inesistente (**data-loss social engineering involontario**).

---

## 6. Supabase RLS

| Domanda | Esito |
|---|---|
| Policy versionate nel repo? | **NOT VERIFIED** / assenti |
| Chi può leggere/scrivere trips su Edge? | **NOT VERIFIED** — solo URL pubblico progetto |
| Anon key / service role in frontend? | **PASS** — non trovate service role keys |

**Azione richiesta maintainer:** esportare policy RLS / Edge auth rules e allegarle o verificare in Dashboard prima della release stabile.

---

## 7. Superficie attacco residua

1. Edit key nei link `#trip=&key=` (se link trapela = pieno controllo). Preferire viewToken per sola lettura.  
2. XSS residui possibili in stringhe non escapate fuori Hub (mitigazione `escapeHtml` a macchia di leopardo).  
3. Pollinations / geocoding terzi: solo privacy/DoS, non auth bypass.  
4. Asset stamp vecchi `20261102ai` ancora in tree (non referenziati live) — superficie irrilevante se non serviti.

---

## 8. Checklist pre-release sicurezza

- [ ] Fix toast SPA su `local` (bloccante affidabilità)  
- [ ] Verificare RLS Supabase in console  
- [ ] Test share GET non espone key (curl staging)  
- [ ] Test logout + riuso token → 401  
- [ ] Decidere: aggiungere `vercel.app` alle allowlist **oppure** dichiarare Vercel non supportato per account API  
- [ ] Rimuovere o non promettere RBAC finché non enforced  

**Giudizio sicurezza:** migliorato sensibilmente vs pre-PR (TTL, share, CORS). **Non ancora “stabile sicuro”** senza fix toast cloud + verifica RLS + chiarezza su ruoli.
