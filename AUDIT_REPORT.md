# Pronti? VIA! — Rapporto di Audit Completo
**Data:** 2 Ottobre 2026 | **Versione:** 1.0

---

## 📋 Sommario Esecutivo

L'app **Pronti? VIA!** è una piattaforma web per l'organizzazione collaborativa di viaggi di gruppo, con moduli per:
- Gestione account e autenticazione
- Creazione e modifica di viaggi
- Preventivo intelligente (generato dinamicamente)
- Suggerimenti AI per itinerari
- Gestione di tappe, prenotazioni, spese e liste di controllo
- Conversione di valute e calcoli budgetari

**Stato generale:** Solida con aree di miglioramento critico.

---

## 🔴 ERRORI CRITICI TROVATI

### 1. **Sincronizzazione del preventivo non testata**
- **Localizzazione:** `preventivo-islanda.js` (linee 278-300)
- **Problema:** Il fallback del preventivo non è correttamente integrato con il salvataggio remoto del trip
- **Effetto:** Se il backend non accetta `trip.preventivo`, i dati potrebbero perdersi
- **Soluzione:** ✅ Implementata fallback robusta, ma richiede test browser

### 2. **Gestione errori incompleta in addSinglePlace()**
- **Localizzazione:** `magic-extras.js` (linea 1221)
- **Problema:** Se `data.revision` non è presente, il salvataggio fallisce silenziosamente
- **Effetto:** Luogo aggiunto all'UI ma non salvato nel trip
- **Severity:** ALTA

### 3. **Race condition in ensureCurrentUserOnTrip()**
- **Localizzazione:** `account.js` (linea 425)
- **Problema:** La variabile `joinInFlight` non è resettata se la fetch fallisce
- **Effetto:** Utente bloccato da ulteriori tentativi di join
- **Severity:** MEDIA

### 4. **Versioning inconsistente del preventivo**
- **Localizzazione:** `preventivo-islanda.js` (linea 21)
- **Problema:** VERSION = "20261002-generic-sync" non è sincronizzato con package.json
- **Effetto:** Difficile tracciare le versioni dell'app
- **Severity:** BASSA

### 5. **Nessun timeout su fetch API**
- **Localizzazione:** Tutti i file con fetch (`magic-extras.js`, `account.js`, `preventivo-islanda.js`)
- **Problema:** Le richieste network non hanno timeout definito
- **Effetto:** App appesa in caso di rete lenta
- **Severity:** MEDIA

---

## 🟡 AVVERTENZE E VULNERABILITÀ

### 1. **XSS potenziale in renderSection() del preventivo**
- **Localizzazione:** `preventivo-islanda.js` (linea 700+)
- **Problema:** Uso di `innerHTML` con valori potenzialmente untrusted
- **Mitigazione:** ✅ Presente escapeHtml(), ma verificare tutti gli usi

### 2. **localStorage illimitato**
- **Localizzazione:** `preventivo-islanda.js` (funzioni readStore/writeStore)
- **Problema:** Nessun limite di size sul salvataggio locale
- **Effetto:** Quota localStorage esaurita dopo molti viaggi/preventivi
- **Soluzione:** Implementare garbage collection per draft vecchi

### 3. **Nessuna validazione su lunghezze di input**
- **Localizzazione:** `account.js` (register/login), form generali
- **Problema:** Campi di testo non limitati a lunghezze ragionevoli
- **Effetto:** Possibili DoS via dati giganti

### 4. **Auth key presente in URL hash**
- **Localizzazione:** `index.html`, URL pattern #trip=X&key=Y
- **Problema:** Hash è visibile in history e log dei browser
- **Soluzione:** Considerare sessionStorage per key temporanei

---

## 🟢 ERRORI MINORI / PULITI

### 1. Gestione corretta di campi opzionali
✅ `readTripPreventivo()` e simili funzioni maneggiato bene i fallback

### 2. Validazione password decente
✅ `validatePassword()` e `validateUsername()` in account.mjs sono solidi

### 3. Sanitizzazione trips in backend
✅ `sanitizeTrips()` filtra campi pericolosi

---

## 💡 MIGLIORIE CONSIGLIATE (PRIORITÀ)

### **TIER 1: CRITICO (Implementare immediatamente)**

#### 1.1 Aggiungere timeout a tutte le fetch API
```javascript
function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}
```
**Impatto:** Previene app freeze, migliora UX  
**Stima:** 30 min

#### 1.2 Sincronizzazione preventivo con retry logic
```javascript
async function persistCurrentTripPreventivo() {
  // ... [existing code]
  if (!auth) { /* fallback locale */ }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await saveTripPreventivo(auth.id, auth.key, preventivo);
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
}
```
**Impatto:** Garantisce persistenza anche su rete instabile  
**Stima:** 45 min

#### 1.3 Aggiungere versioning consapevole
Creare `version.json` centralizzato:
```json
{
  "app": "1.0.0",
  "preventivo": "1.2.1",
  "api": "v1",
  "supported_browsers": ["chrome>=90", "safari>=14", "firefox>=88"]
}
```
**Impatto:** Facilita debugging, deprecation handling  
**Stima:** 20 min

#### 1.4 Reset joinInFlight su errore
```javascript
async function ensureCurrentUserOnTrip() {
  const joinKey = `${tripId}:${name.toLowerCase()}`;
  try {
    // ... fetch logic
  } catch (e) {
    joinInFlight = null; // 🔴 Reset su errore
  }
}
```
**Impatto:** Evita blocchi permanenti  
**Stima:** 10 min

---

### **TIER 2: IMPORTANTE (Implementare entro sprint prossimo)**

#### 2.1 Notifiche toast per errori di salvataggio
Aggiungere toast system centrale:
```javascript
const showToast = (message, type = 'info') => {
  const el = document.createElement('div');
  el.className = `pv-toast pv-toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};
```
**Impatto:** Utenti sanno quando salvataggio fallisce  
**Stima:** 1 ora

#### 2.2 Limite localStorage con cleanup
```javascript
function writeStore(db) {
  try {
    const serialized = JSON.stringify(db);
    if (serialized.length > 2_000_000) {
      // Cleanup: rimuovi draft più vecchi
      const keys = Object.keys(db).sort();
      keys.slice(0, Math.floor(keys.length / 2)).forEach(k => delete db[k]);
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage quota exceeded', e);
  }
}
```
**Impatto:** Previene errori di quota  
**Stima:** 30 min

#### 2.3 Validazione lunghezze input
```javascript
const validateTrip = (trip) => {
  const errors = [];
  if ((trip.title || '').length > 200) errors.push('Titolo troppo lungo');
  if ((trip.notes || '').length > 50_000) errors.push('Note troppo lunghe');
  if ((trip.stops || []).length > 500) errors.push('Troppe tappe');
  return errors;
};
```
**Impatto:** Previene DoS, errori backend  
**Stima:** 45 min

#### 2.4 Aggiungere rate limiting client-side
```javascript
const rateLimiter = new Map();
function rateLimit(key, fn, delayMs = 1000) {
  const last = rateLimiter.get(key);
  if (last && Date.now() - last < delayMs) return;
  rateLimiter.set(key, Date.now());
  return fn();
}
```
**Impatto:** Previene spam di richieste  
**Stima:** 30 min

---

### **TIER 3: MIGLIORAMENTI UX (Implementare per v1.1)**

#### 3.1 Offline support con Service Worker
```javascript
// offline-support.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => 
    console.log('SW non disponibile:', err)
  );
}
```
**Impatto:** App funziona offline, sync al ritorno  
**Stima:** 3 ore

#### 3.2 Pagina di stato per sync dati
Aggiungere indicatore visibile:
- "Salvando..." quando richieste in volo
- "Offline" quando no-connection
- "Errore di sync" con retry button
**Impatto:** Trasparenza, fiducia utente  
**Stima:** 1.5 ore

#### 3.3 Export preventivo in più formati
Aggiungere a `renderExport()`:
- PDF con stile (usa pdfkit o simile)
- Excel (.xlsx) con colonne ordinabili
- Google Sheets integration
**Impatto:** Utenti possono condividere/stampare facilmente  
**Stima:** 3 ore

#### 3.4 Suggerimenti intelligenti di budget
```javascript
function budgetComparison(totals, destination) {
  const benchmarks = {
    'Tokyo': { pp_day: 150, currency: 'EUR' },
    'Bali': { pp_day: 45, currency: 'EUR' },
    // ...
  };
  const bench = benchmarks[destination];
  if (!bench) return null;
  return {
    estimate: totals.perDay,
    benchmark: bench.pp_day,
    delta: ((totals.perDay - bench.pp_day) / bench.pp_day * 100).toFixed(1)
  };
}
```
**Impatto:** Utenti sanno se budget è realistico  
**Stima:** 1 ora

---

### **TIER 4: FEATURE COMPLETAMENTO (Roadmap v1.2)**

#### 4.1 Gestione documenti di gruppo
- Upload passport/visto info
- Calendario controllo scadenze
- Alert per rinnovamenti necessari

#### 4.2 Integrazione calendario (Google Calendar/Outlook)
- Sync automatico delle tappe
- Notifiche reminder per prenotazioni

#### 4.3 Sistema di voting per decisioni
- Dove mangiare (poll ristoranti)
- Quale alloggio (ranking 1-5)
- Attività (votazione activities)

#### 4.4 Analytics di viaggio
- Mappa calore di spesa per giorno
- Grafico di occupazione budget
- Benchmark con viaggi precedenti

#### 4.5 Integrazione pagamenti
- Divisione spese automatica
- Tracking chi ha pagato cosa
- Salvatempo per ricalcoli

#### 4.6 Chat integrata (real-time)
- Discussioni per tappe
- Condivisione file (foto, documenti)
- Menzioni per avvisi urgenti

---

## 🧪 TEST SUITE MANCANTE

### Test Coverage Attuale
- ✅ `tripManager.test.js` — test unitari basici
- ❌ `magic-extras.test.js` — **MANCA**
- ❌ `preventivo-islanda.test.js` — **MANCA**
- ❌ `account.test.js` — **MANCA**
- ❌ E2E tests (browser automation) — **MANCA**

### Test Consigliati
```javascript
// test/preventivo.test.js
test('Preventivo generates params from trip', () => {
  const trip = { destination: 'Roma', travelers: 2, start: '2026-10-15' };
  const params = buildGenericParamsFromTrip(trip);
  assert.equal(params.destination, 'Roma');
  assert.equal(params.travelers, 2);
});

test('Preventivo persists to localStorage', () => {
  const db = readStore();
  writeStore({ ...db, test_trip: { scenario: 'economico' } });
  assert.equal(readStore().test_trip.scenario, 'economico');
});

test('addSinglePlace saves to trip correctly', async () => {
  // ... mock fetch, verify trip.stops updated
});
```
**Stima:** 4 ore per full coverage

---

## 📊 PERFORMANCE AUDIT

### Metriche Attuali (da misurare con real users)
| Metrica | Target | Stato |
|---------|--------|-------|
| First Contentful Paint | < 2s | ? |
| Largest Contentful Paint | < 3s | ? |
| Cumulative Layout Shift | < 0.1 | ? |
| API response time | < 1s | ⚠️ Dipende da Supabase |
| JS bundle size | < 200KB | ⚠️ ~800KB (magic-extras.js solo 700KB!) |

### Optimization Quick Wins
1. **Code splitting:** Dividere magic-extras.js in moduli separati
2. **Lazy loading:** Tab del preventivo caricate on-demand
3. **Minificazione:** Verificare che build di produzione sia minificata
4. **Compression:** Abilitare gzip/brotli sul server

---

## 🔐 SECURITY CHECKLIST

| Item | Status | Note |
|------|--------|------|
| Password hashing (scrypt) | ✅ | Buono, con salt random |
| CORS headers | ✅ | Configurato in netlify functions |
| XSS prevention | ⚠️ | escapeHtml() presente ma controllare tutti gli use |
| CSRF protection | ❌ | MANCA — aggiungere CSRF token |
| Rate limiting | ❌ | MANCA — esporre rotte a brute force |
| Input validation | ⚠️ | Minimale, potenziare |
| Sensitive data in localStorage | ⚠️ | Auth key in URL hash (risky) |
| HTTPS enforcement | ✅ | Presunto (Netlify + custom domain) |
| Content-Security-Policy | ❌ | MANCA |
| Secure headers | ⚠️ | Verificare X-Frame-Options, X-Content-Type-Options |

---

## 📈 METRICHE E ROADMAP

### Metriche di Successo per v1.1
- [ ] 99.5% uptime
- [ ] < 5s API response time p95
- [ ] Zero critical bugs per release
- [ ] Offline support funzionante
- [ ] 100+ test cases con >80% coverage

### Timeline Proposto
```
NOW:     Bug fixes Tier 1 (Settimana 1)
         ├─ Timeout su fetch
         ├─ Retry logic preventivo
         ├─ Reset joinInFlight
         └─ Versioning

Week 2:  Feature Tier 2 (Notifiche, localStorage cleanup, validazione)

Week 3:  Testing + Performance (Profiling, unit tests)

Week 4:  UX Tier 3 (Offline, export, budget insights)

v1.1 Release: Fine di ottobre 2026
```

---

## 📝 CHECKLIST PER RELEASE v1.0.1

- [ ] Implementare timeout fetch (CRITICO)
- [ ] Retry logic per preventivo (CRITICO)
- [ ] Reset joinInFlight su errore (CRITICO)
- [ ] Versioning file (CRITICO)
- [ ] Toast notifications (IMPORTANTE)
- [ ] localStorage cleanup (IMPORTANTE)
- [ ] Input validation + lunghezze (IMPORTANTE)
- [ ] Rate limiting client (IMPORTANTE)
- [ ] Run tripManager tests: `npm test`
- [ ] Smoke test su browser (Chrome, Safari, Firefox)
- [ ] Test su mobile (iOS + Android)
- [ ] Verificare CORS headers in production
- [ ] Controllare content-type response headers
- [ ] Test con rete lenta (DevTools throttling)

---

## 📞 FOLLOW-UP

**Prossime azioni:**
1. ✅ Ho preparato il codice con le correzioni Tier 1
2. ⏳ Implementare e testare in browser
3. ⏳ Merge su main branch
4. ⏳ Tag release v1.0.1
5. ⏳ Deploy su Netlify
6. ⏳ Monitor error logs per 24h

**Domande aperte:**
- Quale è il SLA target per API response time?
- Quanti utenti simultanei target?
- Timezone preferito per logging/timestamps?

---

**Report generato:** 2 Ottobre 2026  
**Revisore:** GitHub Copilot Audit Agent  
**Versione Report:** 1.0
