(() => {
  const SUGGEST_ID = "pv-places-suggest";
  let activeInput = null;
  let timer = null;
  let seq = 0;

  function ensureBox() {
    let box = document.getElementById(SUGGEST_ID);
    if (box) return box;
    box = document.createElement("div");
    box.id = SUGGEST_ID;
    box.hidden = true;
    box.setAttribute("role", "listbox");
    box.style.cssText = [
      "position:absolute",
      "z-index:100001",
      "max-height:260px",
      "overflow:auto",
      "background:#fff",
      "border:1px solid #d7e4e6",
      "border-radius:14px",
      "box-shadow:0 16px 40px rgba(21,59,71,.14)",
      "padding:6px",
      "min-width:240px",
    ].join(";");
    document.body.appendChild(box);
    return box;
  }

  function hide() {
    const box = document.getElementById(SUGGEST_ID);
    if (box) box.hidden = true;
    activeInput = null;
  }

  function placeBox(input) {
    const box = ensureBox();
    const rect = input.getBoundingClientRect();
    box.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
    box.style.top = `${rect.bottom + window.scrollY + 6}px`;
    box.style.width = `${Math.max(rect.width, 280)}px`;
    box.hidden = false;
  }

  function isTargetInput(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    if (input.type && input.type !== "text" && input.type !== "search") return false;
    const field = input.closest("label, .field, .form-grid, form");
    const labelText = `${field?.textContent || ""} ${input.placeholder || ""} ${input.name || ""}`.toLowerCase();
    return (
      labelText.includes("destinazione") ||
      labelText.includes("luogo") ||
      labelText.includes("città") ||
      labelText.includes("indirizzo") ||
      input.placeholder.toLowerCase().includes("città")
    );
  }

  function fillNearbyCoords(input, place) {
    const form = input.closest("form") || document;
    const lat = form.querySelector('input[name="lat"], input[id*="lat" i]');
    const lng = form.querySelector('input[name="lng"], input[id*="lng" i], input[name="lon"]');
    if (lat && place.lat != null) {
      lat.value = String(place.lat);
      lat.dispatchEvent(new Event("input", { bubbles: true }));
      lat.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (lng && place.lng != null) {
      lng.value = String(place.lng);
      lng.dispatchEvent(new Event("input", { bubbles: true }));
      lng.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async function search(input, query) {
    const requestId = ++seq;
    try {
      const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      if (requestId !== seq || activeInput !== input) return;
      const places = Array.isArray(data.places) ? data.places : [];
      const box = ensureBox();
      if (!places.length) {
        box.innerHTML = `<div style="padding:10px 12px;color:#5b7380;font:14px/1.4 sans-serif">Nessun luogo trovato</div>`;
        placeBox(input);
        return;
      }
      box.innerHTML = places
        .map(
          (place, index) => `
          <button type="button" data-idx="${index}" role="option" style="
            display:block;width:100%;text-align:left;border:0;background:transparent;
            border-radius:10px;padding:10px 12px;cursor:pointer;font:14px/1.35 sans-serif;color:#153b47">
            <strong style="display:block">${place.title}</strong>
            <span style="color:#5b7380;font-size:12px">${place.address || ""}</span>
          </button>`
        )
        .join("");
      box.querySelectorAll("button[data-idx]").forEach((button) => {
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          const place = places[Number(button.dataset.idx)];
          if (!place) return;
          input.value = place.title;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          fillNearbyCoords(input, place);
          hide();
        });
      });
      placeBox(input);
    } catch {
      if (requestId === seq) hide();
    }
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!isTargetInput(input)) return;
    activeInput = input;
    const query = input.value.trim();
    clearTimeout(timer);
    if (query.length < 2) {
      hide();
      return;
    }
    timer = setTimeout(() => search(input, query), 350);
  });

  document.addEventListener("focusin", (event) => {
    const input = event.target;
    if (!isTargetInput(input)) return;
    if (input.value.trim().length >= 2) {
      activeInput = input;
      search(input, input.value.trim());
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });

  document.addEventListener("click", (event) => {
    const box = document.getElementById(SUGGEST_ID);
    if (!box || box.hidden) return;
    if (event.target === activeInput || box.contains(event.target)) return;
    hide();
  });
})();
