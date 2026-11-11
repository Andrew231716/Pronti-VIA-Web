(() => {
  const storageKey = "viavia-trip-push-v1";
  const host = "https://pronti-via.vercel.app";
  const endpoint = "/api/trip-notifications";
  let currentDialog;
  let joinedAuth;
  let joinedName = "";
  let publicKey;

  function read() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
    catch { return {}; }
  }

  function save(auth, values) {
    const all = read();
    const previous = all[auth.id]?.key === auth.key ? all[auth.id] : {};
    all[auth.id] = { ...previous, ...values, key: auth.key };
    localStorage.setItem(storageKey, JSON.stringify(all));
  }

  function authForPage() {
    const query = new URLSearchParams(location.hash.slice(1));
    const id = query.get("trip");
    const key = query.get("key");
    return id && key ? { id, key } : null;
  }

  function active(auth) {
    const current = authForPage();
    return current?.id === auth.id && current.key === auth.key;
  }

  function openNotificationTrip() {
    const trip = new URLSearchParams(location.hash.slice(1)).get("pv-notification");
    if (!trip || !/^[a-zA-Z0-9_-]{1,128}$/.test(trip)) return;
    const stored = read()[trip];
    history.replaceState(null, "", stored?.key
      ? `#trip=${encodeURIComponent(trip)}&key=${encodeURIComponent(stored.key)}`
      : location.pathname + location.search);
  }
  openNotificationTrip();

  async function request(auth, body) {
    if (location.origin !== host) throw new Error("Apri il viaggio su Pronti? VIA! su Vercel.");
    const res = await fetch(endpoint, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.key}` },
      body: JSON.stringify({ tripId: auth.id, ...body }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Notifiche non disponibili. Riprova.");
    return result;
  }

  function availability() {
    if (location.origin !== host) return "Apri il viaggio su Pronti? VIA! su Vercel per attivare le notifiche.";
    if (!("Notification" in window) || !("PushManager" in window) || !navigator.serviceWorker) {
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
        return "Su iPhone e iPad, aggiungi l’app alla schermata Home e riaprila da lì per attivare le notifiche.";
      }
      return "Questo browser non supporta le notifiche push.";
    }
    if (Notification.permission === "denied") return "Le notifiche sono bloccate. Riattivale nelle impostazioni del browser o del telefono.";
    return "";
  }

  function fetchPublicKey() {
    publicKey ||= fetch(endpoint, { cache: "no-store" }).then(async res => {
      if (!res.ok) throw new Error("Servizio notifiche non disponibile. Riprova.");
      const { publicKey: key } = await res.json();
      if (!key) throw new Error("Servizio notifiche non disponibile. Riprova.");
      return Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
    }).catch(error => { publicKey = null; throw error; });
    return publicKey;
  }

  function dialog(title, markup) {
    currentDialog?.close();
    const modal = document.createElement("dialog");
    modal.className = "pv-trip-push";
    modal.setAttribute("aria-labelledby", "pv-trip-push-title");
    modal.innerHTML = `<form><h2 id="pv-trip-push-title">${title}</h2>${markup}<p class="pv-trip-push-status" role="status"></p></form>`;
    document.body.append(modal);
    currentDialog = modal;
    modal.addEventListener("close", () => {
      modal.remove();
      if (currentDialog === modal) currentDialog = null;
    }, { once: true });
    modal.showModal();
    return modal;
  }

  async function chooseName(auth, suggested = "", fixed = false) {
    const previous = read()[auth.id];
    if (previous?.key === auth.key && previous.name) return previous.name;
    if (!active(auth)) return "";
    const modal = dialog("Entra nel viaggio", `
      <p>Scrivi il nome che vedranno gli altri viaggiatori.</p>
      <label>Il tuo nome <input name="name" maxlength="80" autocomplete="name" required></label>
      <div><button class="pv-trip-push-primary" type="submit">Continua</button></div>`);
    const field = modal.querySelector("input");
    field.value = suggested;
    field.readOnly = fixed;
    return new Promise(resolve => {
      modal.addEventListener("close", () => resolve(""), { once: true });
      modal.querySelector("form").addEventListener("submit", event => {
        event.preventDefault();
        const name = field.value.trim();
        if (!name) return;
        save(auth, { name });
        resolve(name);
        modal.close();
      });
    });
  }

  function openPreferences(auth, name, first = false) {
    if (!active(auth)) return;
    const stored = read()[auth.id];
    const previous = stored?.key === auth.key ? stored : null;
    let saved = false;
    if (first && previous?.key === auth.key && previous?.decided) return;
    const modal = dialog("Notifiche del viaggio", `
      <p>Scegli quali avvisi ricevere anche quando l’app è chiusa.</p>
      <label><input name="updates" type="checkbox"> Aggiunte e modifiche al viaggio</label>
      <label><input name="expenses" type="checkbox"> Promemoria per le spese da saldare</label>
      <p>Puoi cambiare la scelta in Hub → Impostazioni.</p>
      <div><button class="pv-trip-push-primary" type="submit">${first ? "Accetta" : "Salva preferenze"}</button>
      <button type="button" data-push-cancel>${first ? "No, grazie" : "Chiudi"}</button></div>`);
    const form = modal.querySelector("form");
    const status = modal.querySelector("[role=status]");
    const submit = form.querySelector("[type=submit]");
    const cancel = form.querySelector("[data-push-cancel]");
    form.elements.updates.checked = !previous?.decided || Boolean(previous.updates);
    form.elements.expenses.checked = !previous?.decided || Boolean(previous.expenses);
    const unavailable = availability();
    if (unavailable) status.textContent = unavailable;
    else void fetchPublicKey().catch(() => {});
    function decline() {
      if (first && !saved) save(auth, { decided: true, updates: false, expenses: false, name });
      modal.close();
    }
    cancel.addEventListener("click", decline);
    modal.addEventListener("cancel", event => { event.preventDefault(); decline(); });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const updates = form.elements.updates.checked;
      const expenses = form.elements.expenses.checked;
      const deviceId = previous?.deviceId || crypto.randomUUID();
      submit.disabled = cancel.disabled = true;
      try {
        if (!updates && !expenses) {
          if (previous?.deviceId && (previous.updates || previous.expenses)) {
            await request(auth, { action: "disable", deviceId });
          }
        } else {
          const blocked = availability();
          if (blocked) throw new Error(blocked);
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            save(auth, { decided: true, name, updates: false, expenses: false });
            if (previous?.deviceId && (previous.updates || previous.expenses)) {
              await request(auth, { action: "disable", deviceId });
            }
            throw new Error(availability() || "Consenso non concesso. Puoi riprovare dalle impostazioni.");
          }
          const applicationServerKey = await fetchPublicKey();
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration?.active) throw new Error("Riapri l’app e riprova dalle impostazioni.");
          const subscription = await registration.pushManager.getSubscription() ||
            await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
          const result = await request(auth, { action: "subscribe", deviceId, name, updates, expenses, subscription: subscription.toJSON() });
          if (expenses && !result.linked) {
            status.textContent = "Preferenze salvate. Per ricevere promemoria spese, il tuo nome deve corrispondere a un partecipante.";
          }
        }
        save(auth, { decided: true, name, deviceId, updates, expenses });
        saved = true;
        if (!status.textContent.includes("Preferenze salvate")) modal.close();
        else cancel.textContent = "Chiudi";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = cancel.disabled = false;
      }
    });
  }

  window.__pvNotificationName = chooseName;
  window.__pvNotificationJoined = (auth, name) => {
    joinedAuth = auth;
    joinedName = name;
    openPreferences(auth, name, true);
  };
  window.__pvOpenTripNotifications = () => {
    const auth = authForPage();
    if (!auth) return;
    const stored = read()[auth.id];
    let session;
    try { session = JSON.parse(localStorage.getItem("viavia-session-v1") || "null"); } catch { /* no session */ }
    const name = (joinedAuth?.id === auth.id && joinedAuth.key === auth.key ? joinedName : "") || stored?.name ||
      session?.user?.displayName || session?.user?.username || "";
    openPreferences(auth, name);
  };
  window.__pvPublishTripNotification = (id, key) => {
    if (location.origin !== host) return;
    const stored = read()[id];
    void request({ id, key }, { action: "change", deviceId: stored?.key === key ? stored.deviceId : undefined }).catch(() => {});
  };
  window.__pvSendExpenseReminder = (auth, from, to) => request(auth, { action: "reminder", from, to });
  addEventListener("hashchange", () => {
    currentDialog?.close();
    openNotificationTrip();
  });
})();
