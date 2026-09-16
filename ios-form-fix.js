/**
 * iOS Safari can reject empty optional <input type="number" step="...">
 * with "The string did not match the expected pattern."
 * Clear that false invalid state before submit.
 */
(() => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  function softenNumberInputs(root = document) {
    root.querySelectorAll('input[type="number"]').forEach((input) => {
      if (input.required) return;
      const sync = () => {
        if (String(input.value || "").trim() === "") {
          input.setCustomValidity("");
          // Empty optional number: avoid Safari patternMismatch quirks.
          try {
            input.step = "any";
          } catch {
            /* ignore */
          }
        }
      };
      sync();
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
      input.addEventListener("invalid", (event) => {
        if (String(input.value || "").trim() === "" && !input.required) {
          event.preventDefault();
          input.setCustomValidity("");
        }
      });
    });
  }

  const boot = () => softenNumberInputs(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  const obs = new MutationObserver(() => softenNumberInputs(document));
  obs.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.querySelectorAll('input[type="number"]').forEach((input) => {
        if (!input.required && String(input.value || "").trim() === "") {
          input.setCustomValidity("");
        }
      });
    },
    true
  );
})();
