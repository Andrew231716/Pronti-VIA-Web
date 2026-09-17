const SESSION_KEY = "viavia-account-v1";
const USERS_KEY = "viavia-accounts-db-v1";
const TRIPS_KEY = "viavia-recent-links-v1";
const API = "/api/account";

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
  const url = isGet ? `${API}?action=${encodeURIComponent(action)}` : API;
  const response = await fetch(url, {
    method,
    headers,
    body: isGet ? undefined : JSON.stringify({ action, ...(body || {}) }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
  return data;
}

function ensureUi() {
  if (document.getElementById("pv-account-gate")) return;

  const gate = document.createElement("div");
  gate.id = "pv-account-gate";
  gate.innerHTML = `
    <div class="pv-account-card" role="dialog" aria-modal="true" aria-labelledby="pv-account-title">
      <div class="pv-account-brand">
        <img class="pv-account-mark" src="/logo.png" width="34" height="34" alt="">
        <strong>Pronti? VIA!</strong>
      </div>
      <h1 id="pv-account-title">Accedi al tuo spazio</h1>
      <p>Con un nome utente i tuoi viaggi restano salvati su questo dispositivo finché non cancelli i dati del browser.</p>
      <div class="pv-account-tabs" role="tablist">
        <button type="button" data-mode="login" aria-selected="true">Accedi</button>
        <button type="button" data-mode="register" aria-selected="false">Crea account</button>
      </div>
      <form id="pv-account-form">
        <div class="pv-account-field">
          <label for="pv-username">Nome utente</label>
          <input id="pv-username" name="username" autocomplete="username" required minlength="3" maxlength="32" placeholder="es. anna">
        </div>
        <div class="pv-account-field">
          <label for="pv-password">Password</label>
          <input id="pv-password" name="password" type="password" autocomplete="current-password" required minlength="4" maxlength="72" placeholder="almeno 4 caratteri">
        </div>
        <div class="pv-account-error" id="pv-account-error" aria-live="polite"></div>
        <button class="pv-account-submit" type="submit">Entra</button>
      </form>
      <div class="pv-account-note">
        L’accesso resta attivo anche dopo aver chiuso il sito. Si resetta solo se fai Esci o cancelli cache/dati del browser.
      </div>
    </div>
  `;
  document.body.appendChild(gate);

  const chip = document.createElement("div");
  chip.id = "pv-account-chip";
  chip.hidden = true;
  chip.innerHTML = `
    <span>Account <strong id="pv-account-chip-label"></strong></span>
    <button type="button" id="pv-account-logout">Esci</button>
  `;
  document.body.appendChild(chip);

  gate.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  gate.querySelector("#pv-account-form").addEventListener("submit", onSubmit);
  chip.querySelector("#pv-account-logout").addEventListener("click", onLogout);
}

function setMode(mode) {
  state.mode = mode === "register" ? "register" : "login";
  const gate = document.getElementById("pv-account-gate");
  gate.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.mode === state.mode));
  });
  gate.querySelector("#pv-account-title").textContent =
    state.mode === "register" ? "Crea il tuo account" : "Accedi al tuo spazio";
  gate.querySelector(".pv-account-submit").textContent =
    state.mode === "register" ? "Crea account" : "Entra";
  gate.querySelector("#pv-password").autocomplete =
    state.mode === "register" ? "new-password" : "current-password";
  gate.querySelector("#pv-account-error").textContent = "";
}

function showGate(message = "") {
  ensureUi();
  const gate = document.getElementById("pv-account-gate");
  gate.hidden = false;
  document.getElementById("pv-account-chip").hidden = true;
  document.body.classList.remove("pv-account-ready");
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
  document.body.classList.add("pv-account-ready");
}

async function registerLocal(usernameRaw, password) {
  const username = normalizeUsername(usernameRaw);
  if (username.length < 3 || username.length > 32) {
    throw new Error("Il nome utente deve avere tra 3 e 32 caratteri.");
  }
  if (!/^[a-z0-9._ -]+$/i.test(username)) {
    throw new Error("Usa solo lettere, numeri, spazi, punti, _ e -.");
  }
  if (!password || password.length < 4) {
    throw new Error("La password deve avere almeno 4 caratteri.");
  }

  const users = readUsers();
  if (users[username]) throw new Error("Questo nome utente è già in uso su questo dispositivo.");

  const { salt, hash } = await hashPassword(password);
  users[username] = {
    username,
    displayName: usernameRaw.trim().slice(0, 40) || username,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  writeUsers(users);

  return {
    token: `local:${username}`,
    user: { username, displayName: users[username].displayName },
    trips: readLocalTrips(),
  };
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
  const username = form.username.value;
  const password = form.password.value;
  submit.disabled = true;
  error.textContent = "";
  try {
    const data =
      state.mode === "register"
        ? await registerLocal(username, password)
        : await loginLocal(username, password);

    // Best-effort cloud mirror; never blocks local persistent access.
    try {
      const cloud = await api(state.mode === "register" ? "register" : "login", {
        body: { username, password, displayName: username },
      });
      data.token = cloud.token || data.token;
      data.trips = mergeTrips(cloud.trips || [], data.trips || []);
    } catch {
      /* keep local session */
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

async function activateSession(data, { bootApp = true } = {}) {
  state.token = data.token;
  state.user = data.user;
  // Persist until the browser site data is cleared (or explicit logout).
  writeSession({
    token: data.token,
    user: data.user,
    remembered: true,
    savedAt: new Date().toISOString(),
  });

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
  if (bootApp) await loadApp();
}

let appLoaded = false;
async function loadApp() {
  if (appLoaded) return;
  appLoaded = true;
  await import("/assets/index-loadfix-20260917w.js");
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
  const name = currentDisplayName();
  if (!name) return;

  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const tripId = params.get("trip");
  const key = params.get("key");
  if (!tripId || !key) return;

  const joinKey = `${tripId}:${name.toLowerCase()}`;
  if (joinedTrips.has(joinKey) || joinInFlight === joinKey) return;
  joinInFlight = joinKey;

  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.trip) return;
    if (data.canEdit === false) {
      joinedTrips.add(joinKey);
      return;
    }

    const members = Array.isArray(data.trip.members) ? data.trip.members : [];
    if (members.some((member) => namesMatch(member?.name, name))) {
      joinedTrips.add(joinKey);
      return;
    }

    const nextTrip = {
      ...data.trip,
      members: [
        ...members,
        { id: crypto.randomUUID(), name },
      ].slice(0, 30),
    };

    const save = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        trip: nextTrip,
        revision: data.revision,
      }),
    });
    if (save.ok) {
      joinedTrips.add(joinKey);
      // Do not reload — a full reload during "Apriamo il tuo viaggio…" can leave
      // Safari stuck on the loading screen when the trips proxy is slow.
    }
  } catch {
    /* ignore transient join failures */
  } finally {
    if (joinInFlight === joinKey) joinInFlight = null;
  }
}

function startMemberJoinSync() {
  const run = () => {
    ensureCurrentUserOnTrip();
  };
  run();
  window.addEventListener("hashchange", () => setTimeout(run, 600));
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

async function boot() {
  ensureUi();
  const session = readSession();
  if (!session?.user?.username) {
    showGate();
    return;
  }

  // Local session is enough: stay logged in across reloads until cache/site data is cleared.
  await activateSession(
    {
      token: session.token || `local:${session.user.username}`,
      user: session.user,
      trips: readLocalTrips(),
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
        });
        showChip();
      }
    } catch {
      /* keep remembered local access */
    }
  }
}

boot();
