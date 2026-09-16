(() => {
  const SUGGEST_ID = "pv-places-suggest";
  let activeInput = null;
  let timer = null;
  let seq = 0;
  let highlight = -1;
  let currentPlaces = [];

  function ensureStyles() {
    if (document.getElementById("pv-places-suggest-style")) return;
    const style = document.createElement("style");
    style.id = "pv-places-suggest-style";
    style.textContent = `
      #pv-places-suggest {
        position: absolute;
        z-index: 100001;
        max-height: 280px;
        overflow: auto;
        background: #fff;
        border: 1px solid #d7e4e6;
        border-radius: 14px;
        box-shadow: 0 18px 44px rgba(21, 59, 71, 0.16);
        padding: 6px;
        min-width: 260px;
        box-sizing: border-box;
      }
      #pv-places-suggest[hidden] { display: none !important; }
      #pv-places-suggest .pv-place-option {
        display: grid;
        gap: 2px;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        border-radius: 10px;
        padding: 10px 12px;
        cursor: pointer;
        font: 14px/1.35 "Segoe UI", "Helvetica Neue", sans-serif;
        color: #153b47;
      }
      #pv-places-suggest .pv-place-option[aria-selected="true"],
      #pv-places-suggest .pv-place-option:hover {
        background: #eef6f6;
      }
      #pv-places-suggest .pv-place-option strong {
        font-weight: 700;
      }
      #pv-places-suggest .pv-place-option span {
        color: #5b7380;
        font-size: 12px;
      }
      #pv-places-suggest .pv-place-empty,
      #pv-places-suggest .pv-place-loading {
        padding: 10px 12px;
        color: #5b7380;
        font: 14px/1.4 "Segoe UI", "Helvetica Neue", sans-serif;
      }
      .pv-destination-field input {
        background-image: linear-gradient(180deg, #fff, #f8fbfb);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBox() {
    ensureStyles();
    let box = document.getElementById(SUGGEST_ID);
    if (box) return box;
    box = document.createElement("div");
    box.id = SUGGEST_ID;
    box.hidden = true;
    box.setAttribute("role", "listbox");
    box.setAttribute("aria-label", "Suggerimenti destinazione");
    document.body.appendChild(box);
    return box;
  }

  function hide() {
    const box = document.getElementById(SUGGEST_ID);
    if (box) box.hidden = true;
    activeInput = null;
    highlight = -1;
    currentPlaces = [];
  }

  function placeBox(input) {
    const box = ensureBox();
    const rect = input.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const left = Math.min(
      Math.max(8, rect.left + window.scrollX),
      window.scrollX + document.documentElement.clientWidth - width - 8
    );
    box.style.left = `${left}px`;
    box.style.top = `${rect.bottom + window.scrollY + 6}px`;
    box.style.width = `${width}px`;
    box.hidden = false;
  }

  function isDestinationInput(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    if (input.dataset.pvPlaces === "destination") return true;
    if (input.closest(".pv-destination-field")) return true;
    const label = input.closest("label.field");
    const span = label?.querySelector(":scope > span");
    return (span?.textContent || "").trim() === "Destinazione";
  }

  function setReactInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function choosePlace(place) {
    if (!activeInput || !place) return;
    const input = activeInput;
    setReactInputValue(input, place.title);
    hide();
    input.focus();
  }

  function renderPlaces(input, places, { loading = false } = {}) {
    const box = ensureBox();
    currentPlaces = places;
    if (loading) {
      box.innerHTML = `<div class="pv-place-loading">Cerco città e paesi…</div>`;
      placeBox(input);
      return;
    }
    if (!places.length) {
      box.innerHTML = `<div class="pv-place-empty">Nessuna città o paese trovato</div>`;
      placeBox(input);
      return;
    }
    box.innerHTML = places
      .map(
        (place, index) => `
        <button type="button" class="pv-place-option" role="option" data-idx="${index}" aria-selected="${
          index === highlight ? "true" : "false"
        }">
          <strong>${escapeHtml(place.title)}</strong>
          <span>${escapeHtml(place.subtitle || place.address || place.type || "")}</span>
        </button>`
      )
      .join("");
    box.querySelectorAll(".pv-place-option").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        choosePlace(places[Number(button.dataset.idx)]);
      });
    });
    placeBox(input);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function search(input, query) {
    const requestId = ++seq;
    renderPlaces(input, [], { loading: true });
    try {
      const response = await fetch(
        `/api/places?scope=destination&q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      const data = await response.json().catch(() => ({}));
      if (requestId !== seq || activeInput !== input) return;
      const places = Array.isArray(data.places) ? data.places : [];
      highlight = places.length ? 0 : -1;
      renderPlaces(input, places);
    } catch {
      if (requestId === seq && activeInput === input) {
        renderPlaces(input, []);
      }
    }
  }

  function scheduleSearch(input) {
    activeInput = input;
    const query = input.value.trim();
    clearTimeout(timer);
    if (query.length < 2) {
      hide();
      activeInput = input;
      return;
    }
    timer = setTimeout(() => search(input, query), 280);
  }

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!isDestinationInput(input)) return;
    scheduleSearch(input);
  });

  document.addEventListener("focusin", (event) => {
    const input = event.target;
    if (!isDestinationInput(input)) return;
    activeInput = input;
    if (input.value.trim().length >= 2) scheduleSearch(input);
  });

  document.addEventListener("keydown", (event) => {
    const box = document.getElementById(SUGGEST_ID);
    if (!box || box.hidden || !activeInput) return;
    if (event.key === "Escape") {
      hide();
      return;
    }
    if (!currentPlaces.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight = (highlight + 1) % currentPlaces.length;
      renderPlaces(activeInput, currentPlaces);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight = (highlight - 1 + currentPlaces.length) % currentPlaces.length;
      renderPlaces(activeInput, currentPlaces);
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      choosePlace(currentPlaces[highlight]);
    }
  });

  document.addEventListener("click", (event) => {
    const box = document.getElementById(SUGGEST_ID);
    if (!box || box.hidden) return;
    if (event.target === activeInput || box.contains(event.target)) return;
    hide();
  });

  window.addEventListener(
    "resize",
    () => {
      if (activeInput && !document.getElementById(SUGGEST_ID)?.hidden) {
        placeBox(activeInput);
      }
    },
    { passive: true }
  );
})();
