const SESSION_KEY = "viavia-account-v1";
const TRIPS_KEY = "viavia-recent-links-v1";
const API = "/api/account";

const state = {
  token: null,
  user: null,
  mode: "login",
};

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readLocalTrips() {
  try {
    const trips = JSON.parse(localStorage.getItem(TRIPS_KEY) || "[]");
    return Array.isArray(trips) ? trips : [];
  } catch {
    return [];
  }
}

function writeLocalTrips(trips) {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips.slice(0, 40)));
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

async function api(action, { method = "POST", body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isGet = method === "GET";
  if (!isGet) headers["Content-Type"] = "application/json";
  const url = isGet
    ? `${API}?action=${encodeURIComponent(action)}`
    : API;
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
        <div class="pv-account-mark" aria-hidden="true">PV</div>
        <strong>Pronti? VIA!</strong>
      </div>
      <h1 id="pv-account-title">Accedi al tuo spazio</h1>
      <p>Con un nome utente i tuoi viaggi restano salvati e li ritrovi anche da un altro dispositivo.</p>
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
        Puoi ancora condividere un viaggio con il link. L’account serve a ritrovare e tenere insieme i tuoi viaggi.
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
    const data = await api(state.mode === "register" ? "register" : "login", {
      body: { username, password, displayName: username },
    });
    await activateSession(data);
  } catch (err) {
    error.textContent = err.message || "Accesso non riuscito.";
  } finally {
    submit.disabled = false;
  }
}

async function onLogout() {
  try {
    if (state.token) await api("logout", { token: state.token });
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
  writeSession({ token: data.token, user: data.user });

  const merged = mergeTrips(data.trips || [], readLocalTrips());
  writeLocalTrips(merged);
  if (JSON.stringify(merged) !== JSON.stringify(data.trips || [])) {
    try {
      await api("save-trips", {
        method: "PUT",
        token: state.token,
        body: { trips: merged },
      });
    } catch {
      /* offline-ish: keep local */
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
  await import("/assets/index-D3TxuNMT.js");
}

let syncTimer = null;
let lastPayload = "";
function startTripSync() {
  if (syncTimer) return;
  const push = async () => {
    if (!state.token) return;
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
}

async function boot() {
  ensureUi();
  const session = readSession();
  if (!session?.token) {
    showGate();
    return;
  }
  try {
    const data = await api("me", { method: "GET", token: session.token });
    await activateSession({ token: session.token, user: data.user, trips: data.trips });
  } catch {
    writeSession(null);
    showGate("Sessione scaduta. Accedi di nuovo.");
  }
}

boot();
