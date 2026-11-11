const SESSION_KEY = "viavia-account-v1";
const USERS_KEY = "viavia-accounts-db-v1";
const TRIPS_KEY = "viavia-recent-links-v1";
const API = "/api/account";
/** Client-side session ceiling (matches server 30d sliding). Local tokens keep 30d too. */
const CLIENT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const state = {
  token: null,
  user: null,
  mode: "login",
};

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function readSession() {
  const session = readJson(SESSION_KEY, null);
  if (!session?.user?.username) return null;
  const exp = Number(session.expiresAt);
  if (Number.isFinite(exp) && Date.now() > exp) {
    writeJson(SESSION_KEY, null);
    return null;
  }
  // Legacy sessions without expiresAt: keep once, stamp a fresh 30d window.
  if (!Number.isFinite(exp) && session.token) {
    session.expiresAt = Date.now() + CLIENT_SESSION_TTL_MS;
    writeJson(SESSION_KEY, session);
  }
  return session;
}

function writeSession(session) {
  writeJson(SESSION_KEY, session);
}

function readUsers() {
  const users = readJson(USERS_KEY, {});
  return users && typeof users === "object" ? users : {};
}

function writeUsers(users) {
  writeJson(USERS_KEY, users);
}

function readLocalTrips() {
  const trips = readJson(TRIPS_KEY, []);
  return Array.isArray(trips) ? trips : [];
}

function writeLocalTrips(trips) {
  writeJson(TRIPS_KEY, trips.slice(0, 40));
}

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mergeTrips(remote = [], local = []) {
  const map = new Map();
  for (const trip of [...remote, ...local]) {
    if (!trip?.id || !trip?.key) continue;
    const prev = map.get(trip.id);
    if (!prev) {
      map.set(trip.id, {
        id: trip.id,
        key: trip.key,
        title: trip.title || "Viaggio",
      });
    } else if (trip.title && trip.title !== "Viaggio") {
      prev.title = trip.title;
      prev.key = trip.key || prev.key;
    }
  }
  return [...map.values()].slice(0, 40);
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? new Uint8Array(hexToBuffer(saltHex))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return {
    salt: bufferToHex(salt),
    hash: bufferToHex(bits),
  };
}

async function verifyPassword(password, salt, hash) {
  const next = await hashPassword(password, salt);
  return next.hash === hash;
}

async function api(action, { method = "POST", body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isGet = method === "GET";
  if (!isGet) headers["Content-Type"] = "application/json";
  const payload = isGet ? undefined : JSON.stringify({ action, ...(body || {}) });
  const query = isGet ? `?action=${encodeURIComponent(action)}` : "";
  if (action === "reset" || String(token || "").startsWith("pvacct:") || body?.username?.endsWith("@via")) {
    const response = await fetch(`https://pronti-via.vercel.app/api/recovery-account${query}`, {
      method, headers, body: payload, cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (action === "me" && !data.user)) {
      const err = new Error(data.error || "Servizio account non disponibile. Riprova.");
      err.status = response.status;
      throw err;
    }
    return data;
  }
  // Same-origin first (Netlify / shim), then direct Netlify fallback for GitHub Pages.
  const targets = [
    `${API}${query}`,
    `https://pronti-via-k7es.netlify.app/api/account${query}`,
  ];
  let lastErr;
  for (const url of targets) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: payload,
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || "Operazione non riuscita.");
        error.status = response.status;
        // Soft-fail only transport/host issues to the next target.
        if (response.status === 503 || response.status === 502 || response.status === 404) {
          lastErr = error;
          continue;
        }
        throw error;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (err?.status && err.status !== 503 && err.status !== 502 && err.status !== 404) throw err;
    }
  }
  throw lastErr || new Error("Sync account non disponibile.");
}

function ensureUi() {
  if (document.getElementById("pv-account-gate")) return;

  const brandMark = `<svg class="pv-account-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path class="pv-mark-pin" d="M20 3a13 13 0 0 0-13 13c0 8 8 15 12 19a1.4 1.4 0 0 0 2 0c4-4 12-11 12-19A13 13 0 0 0 20 3Z"/>
    <path class="pv-mark-case" d="M17 15v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"/>
  </svg>`;

  const gate = document.createElement("div");
  gate.id = "pv-account-gate";
  gate.innerHTML = `
    <div class="pv-account-card" role="dialog" aria-modal="true" aria-labelledby="pv-account-title">
      <header class="pv-account-hero">
        <div class="pv-account-brand">
          ${brandMark}
          <strong>Pronti? VIA!</strong>
        </div>
        <h1 id="pv-account-title">Accedi al tuo spazio</h1>
        <p id="pv-account-intro">Accedi per ritrovare i tuoi viaggi.</p>
      </header>
      <div class="pv-account-tabs" role="group" aria-label="Modalità accesso">
        <button type="button" data-mode="login" aria-pressed="true">Accedi</button>
        <button type="button" data-mode="register" aria-pressed="false">Crea account</button>
      </div>
      <form id="pv-account-form" class="pv-account-form">
        <div class="pv-account-field">
          <label for="pv-username">Nome utente</label>
          <input id="pv-username" name="username" autocomplete="username" required minlength="3" maxlength="32" placeholder="es. anna" enterkeyhint="next">
        </div>
        <div class="pv-account-field">
          <label for="pv-password">Password</label>
          <input id="pv-password" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="72" placeholder="Almeno 8 caratteri" enterkeyhint="go">
        </div>
        <div class="pv-account-field" id="pv-recovery-field" hidden>
          <label for="pv-recovery-code">Codice di recupero</label>
          <input id="pv-recovery-code" name="recoveryCode" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" disabled>
        </div>
        <div class="pv-account-error" id="pv-account-error" aria-live="polite"></div>
        <button class="pv-account-submit" type="submit">Entra</button>
      </form>
      <button type="button" class="pv-account-recovery-link" data-mode="reset">Password dimenticata?</button>
      <div id="pv-recovery-issued" hidden>
        <p>Salva il nome utente e il codice. Ti serviranno per reimpostare la password.</p>
        <div class="pv-account-field">
          <label for="pv-recovery-issued-user">Nome utente</label>
          <input id="pv-recovery-issued-user" readonly>
        </div>
        <div class="pv-account-field">
          <label for="pv-recovery-issued-code">Codice di recupero</label>
          <input id="pv-recovery-issued-code" readonly autocomplete="off" spellcheck="false">
        </div>
        <button class="pv-account-submit" type="button" id="pv-recovery-done">Ho salvato il codice</button>
      </div>
    </div>
  `;
  document.body.appendChild(gate);

  const chip = document.createElement("div");
  chip.id = "pv-account-chip";
  chip.hidden = true;
  chip.innerHTML = `
    <div class="pv-account-chip-main">
      <span class="pv-account-chip-who">Ciao, <strong id="pv-account-chip-label"></strong></span>
      <span class="pv-account-chip-hint" id="pv-account-chip-hint">${brandMark}Pronti? VIA!</span>
    </div>
  `;
  document.body.appendChild(chip);

  // Primary nav — schema: Home · Viaggi · HUB · Assistente IA · Profilo
  const nav = document.createElement("nav");
  nav.id = "pv-primary-nav";
  nav.hidden = true;
  nav.setAttribute("aria-label", "Navigazione principale");
  nav.innerHTML = `
    <div class="pv-primary-nav-inner" role="toolbar">
      <button type="button" class="pv-nav-item" data-nav="home" id="pv-nav-home" aria-current="page" title="Home — panoramica e nuovo viaggio">
        <span class="pv-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>
        </span>
        <span class="pv-nav-label">Home</span>
      </button>
      <button type="button" class="pv-nav-item" data-nav="trips" id="pv-nav-trips" title="Viaggi — itinerario o elenco">
        <span class="pv-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h9l2 4H7l2-4z"/><path d="M7 8v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
        </span>
        <span class="pv-nav-label">Viaggi</span>
      </button>
      <button type="button" class="pv-nav-item pv-nav-hub" data-nav="hub" id="pv-hub-nav" aria-haspopup="dialog" aria-expanded="false" title="HUB — collabora con il gruppo">
        <span class="pv-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19"/><path d="M14 14.2c1.5-.7 3.2-.5 4.8.8.6.5 1 1.2 1.2 2"/></svg>
        </span>
        <span class="pv-nav-label">HUB</span>
      </button>
      <button type="button" class="pv-nav-item pv-nav-ai" data-nav="ai" id="pv-nav-ai" aria-haspopup="dialog" aria-expanded="false" title="Assistente IA — bacchetta magica">
        <span class="pv-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.2 4.2L17.5 8.5 13.2 9.8 12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z"/><path d="M18.5 14.5 19 16l1.5.5L19 17l-.5 1.5L18 17l-1.5-.5L18 16l.5-1.5z"/></svg>
        </span>
        <span class="pv-nav-label">IA</span>
      </button>
      <button type="button" class="pv-nav-item" id="pv-nav-budget" aria-haspopup="dialog" aria-label="Preventivo intelligente">
        <span class="pv-nav-ico" aria-hidden="true"></span>
        <span class="pv-nav-label">Preventivo</span>
      </button>
      <button type="button" class="pv-nav-item" data-nav="profile" id="pv-account-menu" aria-haspopup="dialog" aria-expanded="false" title="Profilo e strumenti">
        <span class="pv-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.2-3.2 3.6-4.7 7-4.7s5.8 1.5 7 4.7"/><circle cx="18.2" cy="6.2" r="2" /><path d="M17.2 6.2h2M18.2 5.2v2"/></svg>
        </span>
        <span class="pv-nav-label">Profilo</span>
      </button>
    </div>
  `;
  document.body.appendChild(nav);

  gate.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  gate.querySelector("#pv-account-form").addEventListener("submit", onSubmit);

  function setNavCurrent(which) {
    nav.querySelectorAll(".pv-nav-item").forEach((btn) => {
      const on = btn.dataset.nav === which;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }
  window.__pvSetPrimaryNav = setNavCurrent;

  // Hub open/close is owned by pv-platform (bindHubTrigger). Fallback only if unbound.
  nav.querySelector("#pv-hub-nav").addEventListener("click", () => {
    setNavCurrent("hub");
    const hub = document.getElementById("pv-hub-nav");
    if (hub?.dataset?.pvHubBound === "1") return;
    if (typeof window.ProntiPlatform?.open === "function") {
      window.ProntiPlatform.open();
      return;
    }
    document.getElementById("pv-plat-fab")?.click();
  });

  nav.querySelector("#pv-nav-home").addEventListener("click", () => {
    setNavCurrent("home");
    if (typeof window.__pvNavHome === "function") {
      window.__pvNavHome();
      return;
    }
    if (location.hash) location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  nav.querySelector("#pv-nav-trips").addEventListener("click", () => {
    setNavCurrent("trips");
    if (typeof window.__pvNavTrips === "function") {
      window.__pvNavTrips();
      return;
    }
    document.querySelector('a[href*="I tuoi"], button, a')?.blur();
  });

  nav.querySelector("#pv-nav-ai").addEventListener("click", () => {
    setNavCurrent("ai");
    if (typeof window.__pvNavAi === "function") {
      window.__pvNavAi();
      return;
    }
    document.getElementById("pv-magic-open")?.click();
  });

  nav.querySelector("#pv-nav-budget").addEventListener("click", () => window.__pvOpenPreventivo?.());
  nav.querySelector("#pv-account-menu").addEventListener("click", () => {
    setNavCurrent("profile");
    if (typeof window.__pvOpenAccountMenu === "function") {
      window.__pvOpenAccountMenu();
      return;
    }
    const choice = window.confirm("Esci dall’account?");
    if (choice) onLogout();
  });

  // Kept for programmatic use / older hooks.
  window.__pvAccountLogout = onLogout;
  window.__pvAccountDelete = onDeleteAccount;
}

function setMode(mode) {
  state.mode = mode;
  const gate = document.getElementById("pv-account-gate");
  const reset = mode === "reset";
  const register = mode === "register";
  gate.querySelectorAll(".pv-account-tabs [data-mode]").forEach((button) => {
    const on = button.dataset.mode === mode;
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-selected", String(on)); // legacy attr kept harmless
  });
  gate.querySelector("#pv-account-title").textContent =
    reset ? "Reimposta la password" : register ? "Crea il tuo account" : "Accedi al tuo spazio";
  gate.querySelector("#pv-account-intro").textContent = reset
    ? "Usa il codice che hai salvato. Al termine riceverai un nuovo codice."
    : register ? "Scegli un nome. Aggiungeremo @via e ti daremo un codice di recupero."
      : "Accedi per ritrovare i tuoi viaggi.";
  gate.querySelector("form .pv-account-submit").textContent =
    reset ? "Reimposta password" : register ? "Crea account" : "Entra";
  const password = gate.querySelector("#pv-password");
  password.autocomplete = register || reset ? "new-password" : "current-password";
  password.labels[0].textContent = reset ? "Nuova password" : "Password";
  password.value = "";
  gate.querySelector("#pv-recovery-field").hidden = !reset;
  const code = gate.querySelector("#pv-recovery-code");
  code.disabled = !reset;
  code.required = reset;
  code.value = "";
  gate.querySelector("[data-mode=reset]").hidden = reset;
  gate.querySelector("#pv-account-error").textContent = "";
}

async function showRecoveryCode(data) {
  const gate = document.getElementById("pv-account-gate");
  const panel = gate.querySelector("#pv-recovery-issued");
  const code = panel.querySelector("#pv-recovery-issued-code");
  gate.querySelector("#pv-account-title").textContent = "Salva il codice di recupero";
  const temporarilyHidden = gate.querySelectorAll("#pv-account-intro, .pv-account-tabs, #pv-account-form, [data-mode=reset]");
  temporarilyHidden.forEach(element => { element.hidden = true; });
  panel.querySelector("#pv-recovery-issued-user").value = data.user.username;
  code.value = data.recoveryCode.match(/.{1,8}/g).join("-");
  panel.hidden = false;
  code.focus();
  await new Promise(resolve => {
    panel.querySelector("#pv-recovery-done").addEventListener("click", resolve, { once: true });
  });
  code.value = "";
  gate.querySelector("#pv-account-form").reset();
  panel.hidden = true;
  temporarilyHidden.forEach(element => { element.hidden = false; });
  setMode("login");
}

function showGate(message = "") {
  ensureUi();
  const gate = document.getElementById("pv-account-gate");
  gate.hidden = false;
  document.getElementById("pv-account-chip").hidden = true;
  const nav = document.getElementById("pv-primary-nav");
  if (nav) nav.hidden = true;
  document.body.classList.remove("pv-account-ready", "pv-primary-nav-ready");
  document.getElementById("pv-account-error").textContent = message;
  document.documentElement.style.overflow = "hidden";
}

function hideGate() {
  const gate = document.getElementById("pv-account-gate");
  if (gate) gate.hidden = true;
  document.documentElement.style.overflow = "";
}

function showChip() {
  ensureUi();
  const chip = document.getElementById("pv-account-chip");
  const label = document.getElementById("pv-account-chip-label");
  label.textContent = state.user?.displayName || state.user?.username || "Account";
  chip.hidden = false;
  const nav = document.getElementById("pv-primary-nav");
  if (nav) nav.hidden = false;
  document.body.classList.add("pv-account-ready", "pv-primary-nav-ready");
}

async function upsertLocalUser(usernameRaw, password, displayName) {
  const username = normalizeUsername(usernameRaw);
  if (username.length < 3 || username.length > 32) {
    throw new Error("Il nome utente deve avere tra 3 e 32 caratteri.");
  }
  if (!/^[a-z0-9._ -]+$/i.test(username)) {
    throw new Error("Usa solo lettere, numeri, spazi, punti, _ e -.");
  }
  if (!password || password.length < 8) {
    throw new Error("La password deve avere almeno 8 caratteri.");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Usa almeno una lettera e un numero nella password.");
  }
  const users = readUsers();
  const { salt, hash } = await hashPassword(password);
  const prev = users[username];
  users[username] = {
    username,
    displayName: String(displayName || usernameRaw || username).trim().slice(0, 40) || username,
    salt,
    hash,
    createdAt: prev?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeUsers(users);
  return users[username];
}

async function loginLocal(usernameRaw, password) {
  const username = normalizeUsername(usernameRaw);
  const users = readUsers();
  const user = users[username];
  if (!user?.salt || !user?.hash || !(await verifyPassword(password, user.salt, user.hash))) {
    throw new Error("Nome utente o password non corretti.");
  }
  return {
    token: `local:${username}`,
    user: { username: user.username, displayName: user.displayName || user.username },
    trips: readLocalTrips(),
  };
}

async function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector(".pv-account-submit");
  const error = document.getElementById("pv-account-error");
  const mode = state.mode;
  const username = form.username.value;
  const password = form.password.value;
  submit.disabled = true;
  error.textContent = "";
  try {
    const normalized = normalizeUsername(username);
    if (mode === "register" || mode === "reset" || normalized.endsWith("@via")) {
      const managedName = mode === "register" && !normalized.endsWith("@via") ? `${normalized}@via` : normalized;
      const data = await api(mode, { body: { username: managedName, password, code: form.recoveryCode.value } });
      if (!data.token || !data.user?.username || (mode !== "login" && !data.recoveryCode))
        throw new Error("Servizio account non disponibile. Riprova.");
      if (data.recoveryCode) await showRecoveryCode(data);
      await activateSession(data);
      return;
    }
    let data;
    try {
      const cloud = await api("login", { body: { username, password } });
      if (!cloud?.token || !cloud?.user?.username) throw new Error("Risposta account incompleta.");
      data = cloud;
      try { await upsertLocalUser(username, password, data.user.displayName || username); } catch { /* storage unavailable */ }
    } catch (err) {
      // Existing accounts created locally still use the device's credential cache.
      data = await loginLocal(username, password).catch(() => { throw err; });
    }

    await activateSession(data);
  } catch (err) {
    error.textContent = err.message || "Accesso non riuscito.";
  } finally {
    submit.disabled = false;
  }
}

async function onLogout() {
  try {
    if (state.token && !String(state.token).startsWith("local:")) {
      await api("logout", { token: state.token });
    }
  } catch {
    /* ignore */
  }
  state.token = null;
  state.user = null;
  writeSession(null);
  showGate();
  location.hash = "";
  location.reload();
}

function wipeLocalUser(username) {
  const users = readUsers();
  const key = normalizeUsername(username);
  if (users[key]) {
    delete users[key];
    writeUsers(users);
  }
}

async function onDeleteAccount() {
  const username = state.user?.username || "";
  if (!username) return;
  const ok = window.confirm(
    `Eliminare definitivamente l’account «${state.user?.displayName || username}»?\n\nQuesta azione cancella l’account online e su questo dispositivo. I viaggi già creati restano raggiungibili solo se hai i link.`
  );
  if (!ok) return;
  const password = window.prompt("Conferma con la password dell’account:");
  if (password == null) return;
  if (!String(password).trim()) {
    window.alert("Password obbligatoria per eliminare l’account.");
    return;
  }
  try {
    if (state.token && !String(state.token).startsWith("local:")) {
      await api("delete-account", {
        token: state.token,
        body: { username, password },
      });
    } else {
      // Local-only account: verify password then wipe.
      await loginLocal(username, password);
    }
  } catch (err) {
    // Still try cloud delete if local verify failed but cloud may have the account.
    try {
      await api("delete-account", {
        token: state.token && !String(state.token).startsWith("local:") ? state.token : undefined,
        body: { username, password },
      });
    } catch (cloudErr) {
      window.alert(cloudErr.message || err.message || "Eliminazione non riuscita.");
      return;
    }
  }
  wipeLocalUser(username);
  try {
    localStorage.removeItem("viavia-preventivo-v2");
    localStorage.removeItem("viavia-preventivo-v1");
  } catch {
    /* ignore */
  }
  state.token = null;
  state.user = null;
  writeSession(null);
  window.alert("Account eliminato.");
  showGate();
  location.hash = "";
  location.reload();
}

async function activateSession(data, { bootApp = true } = {}) {
  state.token = data.token;
  state.user = data.user;
  const expiresAt =
    Number(data.expiresAt) ||
    Date.now() + (Number(data.sessionTtlMs) || CLIENT_SESSION_TTL_MS);
  writeSession({
    token: data.token,
    user: data.user,
    guest: Boolean(data.guest),
    remembered: true,
    savedAt: new Date().toISOString(),
    expiresAt,
  });

  const ownerKey = "viavia-recent-owner-v1";
  const previousOwner = readJson(ownerKey, "");
  const nextOwner = String(data.token || "").startsWith("pvacct:") ? data.user.username : "";
  if (previousOwner !== nextOwner) {
    writeJson(`viavia-recent-owner:${previousOwner}`, readLocalTrips());
    writeLocalTrips(readJson(`viavia-recent-owner:${nextOwner}`, []));
    writeJson(ownerKey, nextOwner);
  }
  const merged = mergeTrips(data.trips || [], readLocalTrips());
  writeLocalTrips(merged);

  if (state.token && !String(state.token).startsWith("local:")) {
    try {
      await api("save-trips", {
        method: "PUT",
        token: state.token,
        body: { trips: merged },
      });
    } catch {
      /* offline / blobs unavailable */
    }
  }

  hideGate();
  showChip();
  startTripSync();
  if (bootApp) {
    try {
      await loadApp();
    } catch {
      // Session is already active — don't bounce back to the login form.
      showAppBootFallback(
        "Accesso ok, ma la home non si è aperta. Tocca Riprova oppure aggiorna la pagina."
      );
    }
  }
}

let appLoaded = false;
let appLoadPromise = null;
const APP_MODULE = "/assets/index-loadfix-20261111f.js";

function rootHasApp() {
  const root = document.getElementById("root");
  if (!root) return false;
  // React mounts topbar / workspace; ignore empty notification portals only.
  return Boolean(
    root.querySelector(".topbar, .app-shell, .workspace, .recent-trips, main, [data-pv-app]")
  );
}

function showAppBootFallback(message) {
  const root = document.getElementById("root");
  if (!root || rootHasApp()) return;
  if (root.querySelector("[data-pv-boot-fallback]")) {
    const msg = root.querySelector("[data-pv-boot-fallback] .pv-boot-msg");
    if (msg) msg.textContent = message;
    return;
  }
  const box = document.createElement("section");
  box.dataset.pvBootFallback = "1";
  box.style.cssText =
    "margin:24px 16px;padding:18px 16px;border-radius:18px;background:#fff;border:1px solid #d5e3e6;color:#12343c;font:500 14px/1.45 system-ui,sans-serif";
  box.innerHTML = `<p class="pv-boot-msg" style="margin:0 0 12px">${message}</p>
    <button type="button" data-pv-boot-retry style="appearance:none;border:0;border-radius:999px;padding:10px 14px;background:#007d82;color:#fff;font:700 13px inherit;cursor:pointer">Riprova a caricare</button>`;
  box.querySelector("[data-pv-boot-retry]")?.addEventListener("click", () => {
    void loadApp({ force: true });
  });
  root.prepend(box);
}

async function loadApp({ force = false } = {}) {
  if (appLoaded && rootHasApp() && !force) return;
  if (appLoadPromise && !force) return appLoadPromise;

  appLoadPromise = (async () => {
    try {
      if (force) appLoaded = false;
      // Bust sticky module failures after a partial deploy / SW glitch.
      const url = force ? `${APP_MODULE}?t=${Date.now()}` : APP_MODULE;
      await import(url);
      appLoaded = true;
      // Give React a tick to mount before declaring success.
      await new Promise((r) => setTimeout(r, 80));
      if (!rootHasApp()) {
        // Second attempt with cache bust
        await import(`${APP_MODULE}?t=${Date.now()}`);
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!rootHasApp()) {
        throw new Error("L’app non è comparsa dopo il login.");
      }
      document.querySelector("[data-pv-boot-fallback]")?.remove();
    } catch (err) {
      appLoaded = false;
      console.error("[pv] loadApp failed", err);
      showAppBootFallback(
        "Qualcosa non ha caricato la home. Tocca Riprova, oppure chiudi e riapri l’app (senza cache)."
      );
      throw err;
    } finally {
      appLoadPromise = null;
    }
  })();

  return appLoadPromise;
}

window.__pvLoadApp = loadApp;

function watchAppMount() {
  let tries = 0;
  const tick = () => {
    if (!document.body.classList.contains("pv-account-ready")) return;
    if (rootHasApp()) {
      document.querySelector("[data-pv-boot-fallback]")?.remove();
      return;
    }
    tries += 1;
    if (tries === 1 || tries === 3) void loadApp({ force: tries > 1 });
    if (tries >= 2) {
      showAppBootFallback(
        "La home non si è caricata. Tocca Riprova oppure riapri il sito dopo aver aggiornato la pagina."
      );
    }
    if (tries < 6) setTimeout(tick, 1200);
  };
  setTimeout(tick, 1500);
}

let syncTimer = null;
let lastPayload = "";
let joinInFlight = null;
const joinedTrips = new Set();

function currentDisplayName() {
  return (state.user?.displayName || state.user?.username || "").trim();
}

function namesMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

async function ensureCurrentUserOnTrip() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const tripId = params.get("trip");
  const key = params.get("key");
  if (!tripId || !key) return;
  const auth = { id: tripId, key };
  const personal = key.startsWith("pv-personal-");
  const session = readSession();
  const guest = session?.guest;
  const joinKey = `${tripId}:${key}`;
  if (joinedTrips.has(joinKey) || joinInFlight === joinKey) return;
  joinInFlight = joinKey;
  const isCurrent = () => {
    const current = new URLSearchParams(location.hash.slice(1));
    return current.get("trip") === tripId && current.get("key") === key;
  };

  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.trip || !isCurrent()) return;
    const onboarding = guest || personal || data.canEdit === false;
    const name = onboarding && window.__pvNotificationName
      ? await window.__pvNotificationName(auth, data.personalName || (guest ? "" : currentDisplayName()), Boolean(data.personalName))
      : currentDisplayName();
    if (!name || !isCurrent()) return;

    const members = Array.isArray(data.trip.members) ? data.trip.members : [];
    const blocked = Array.isArray(data.trip.meta?.blockedMembers) ? data.trip.meta.blockedMembers : [];
    if (blocked.some(entry => namesMatch(typeof entry === "string" ? entry : entry?.name, name))) {
      joinedTrips.add(joinKey);
      return;
    }

    if (!personal && data.canEdit !== false && !members.some(member => namesMatch(member?.name, name))) {
      if (members.length >= 30) return;
      const save = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          trip: { ...data.trip, members: [...members, { id: crypto.randomUUID(), name }] },
          revision: data.revision,
        }),
      });
      if (!save.ok || !isCurrent()) return;
    }

    if (guest && state.user && state.user.username === session.user.username) {
      state.user = { ...state.user, displayName: name };
      writeSession({ ...readSession(), user: state.user });
      showChip();
    }
    joinedTrips.add(joinKey);
    if (onboarding) window.__pvNotificationJoined?.(auth, name);
  } catch {
    /* A transient join failure can be retried. */
  } finally {
    if (joinInFlight === joinKey) joinInFlight = null;
  }
}

function startMemberJoinSync() {
  const run = () => {
    ensureCurrentUserOnTrip();
  };
  run();
  window.addEventListener("hashchange", () => {
    joinedTrips.clear();
    // Leaving a shared link while guest → back to login gate (free, no sticky ospite).
    if (!hashHasSharedTrip()) {
      const session = readSession();
      if (session?.guest) {
        clearGuestSession();
        showGate();
        return;
      }
    } else {
      const session = readSession();
      if (!session?.user?.username) {
        void activateSession(makeGuestSession(), { bootApp: true });
        return;
      }
    }
    setTimeout(run, 600);
  });
  setTimeout(run, 1500);
  setTimeout(run, 4000);
}

function startTripSync() {
  if (syncTimer) return;
  const push = async () => {
    if (!state.token || String(state.token).startsWith("local:")) return;
    const trips = readLocalTrips();
    const payload = JSON.stringify(trips);
    if (payload === lastPayload) return;
    lastPayload = payload;
    try {
      await api("save-trips", {
        method: "PUT",
        token: state.token,
        body: { trips },
      });
    } catch {
      lastPayload = "";
    }
  };
  syncTimer = setInterval(push, 4000);
  window.addEventListener("hashchange", () => setTimeout(push, 800));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") push();
  });
  startMemberJoinSync();
}

function hashHasSharedTrip() {
  try {
    const params = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    return Boolean(params.get("trip") && params.get("key"));
  } catch {
    return false;
  }
}

function makeGuestSession() {
  const suffix = Date.now().toString(36).slice(-5);
  const username = `ospite-${suffix}`;
  // Unique display name so one "Elimina" cannot block every future guest named "Ospite".
  return {
    token: `local:${username}`,
    user: { username, displayName: `Ospite ${suffix}` },
    trips: readLocalTrips(),
    guest: true,
  };
}

function clearGuestSession() {
  const session = readSession();
  if (!session?.guest) return false;
  writeSession(null);
  state.token = null;
  state.user = null;
  try {
    document.getElementById("pv-account-chip").hidden = true;
    const nav = document.getElementById("pv-primary-nav");
    if (nav) nav.hidden = true;
  } catch {
    /* ignore */
  }
  document.body.classList.remove("pv-account-ready", "pv-primary-nav-ready");
  return true;
}

async function boot() {
  ensureUi();
  const session = readSession();
  if (!session?.user?.username) {
    // Shared trip links should open without forcing registration.
    if (hashHasSharedTrip()) {
      const guest = makeGuestSession();
      await activateSession(guest, { bootApp: true });
      return;
    }
    showGate();
    return;
  }

  // Guest sessions are only for shared links — do not stick around on the home page.
  if (session.guest && !hashHasSharedTrip()) {
    clearGuestSession();
    showGate();
    return;
  }

  if (String(session.token || "").startsWith("pvacct:")) {
    try {
      const data = await api("me", { method: "GET", token: session.token });
      await activateSession({ ...data, token: session.token });
    } catch (err) {
      if (err.status === 401) {
        writeSession(null);
        showGate("Sessione scaduta. Accedi di nuovo.");
      } else {
        await activateSession({ ...session, trips: [] });
      }
    }
    return;
  }

  // Local session is enough: stay logged in across reloads until cache/site data is cleared.
  await activateSession(
    {
      token: session.token || `local:${session.user.username}`,
      user: session.user,
      trips: readLocalTrips(),
      guest: Boolean(session.guest),
    },
    { bootApp: true }
  );

  // Optional background refresh from cloud; never clears the local session on failure.
  if (session.token && !String(session.token).startsWith("local:")) {
    try {
      const data = await api("me", { method: "GET", token: session.token });
      const merged = mergeTrips(data.trips || [], readLocalTrips());
      writeLocalTrips(merged);
      if (data.user) {
        state.user = data.user;
        writeSession({
          token: session.token,
          user: data.user,
          remembered: true,
          savedAt: new Date().toISOString(),
          expiresAt:
            Number(data.expiresAt) ||
            Date.now() + (Number(data.sessionTtlMs) || CLIENT_SESSION_TTL_MS),
        });
        showChip();
      }
    } catch {
      /* keep remembered local access */
    }
  }
}

const SHELL_VER = "20261111j";
const SHELL_VER_KEY = "pv-shell-ver-v1";

async function ensureFreshShell() {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${SHELL_VER}`);
      // Ask waiting worker to activate immediately when present.
      reg?.waiting?.postMessage?.({ type: "SKIP_WAITING" });
      if (reg?.update) await reg.update().catch(() => {});
    }
  } catch {
    /* ignore */
  }
  try {
    const prev = localStorage.getItem(SHELL_VER_KEY);
    if (prev && prev !== SHELL_VER) {
      localStorage.setItem(SHELL_VER_KEY, SHELL_VER);
      // One hard reload so iOS/PWA drop the old precache.
      if (!sessionStorage.getItem("pv-shell-reloaded")) {
        sessionStorage.setItem("pv-shell-reloaded", "1");
        location.reload();
        return;
      }
    } else {
      localStorage.setItem(SHELL_VER_KEY, SHELL_VER);
    }
  } catch {
    /* ignore */
  }
}

boot().finally(() => {
  watchAppMount();
  void ensureFreshShell();
});
