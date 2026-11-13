/**
 * iOS Safari form quirks + force-refresh after deploys.
 */
(() => {
  // Cache-bust note for operators: bump this when shipping iOS fixes.
  window.__PV_FORM_FIX__ = "ios2";

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.setAttribute("novalidate", "");
      form.querySelectorAll('input[type="number"]').forEach((input) => {
        if (!input.required && String(input.value || "").trim() === "") {
          input.setCustomValidity("");
        }
      });
    },
    true
  );
})();
