// public/js/modules/datalistSafariPatch.js
// Robust Safari (<datalist>) refresh patch for dynamically updated options.
// Works cross‑browser; on non‑Safari it is a no‑op performance‑wise.

export function patchSafariDatalist() {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Polyfill CSS.escape if missing (older Safari)
  if (typeof CSS === "undefined" || typeof CSS.escape !== "function") {
    window.CSS = window.CSS || {};
    CSS.escape = function (value) {
      return String(value).replace(/[^a-zA-Z0-9_\-]/g, function (c) {
        const hex = c.charCodeAt(0).toString(16);
        return "\\" + hex + " ";
      });
    };
  }

  const mainDatalist = document.getElementById("player-datalist-main");
  if (!mainDatalist) return;

  const allPlayerOptions = Array.from(mainDatalist.options);
  const ptPlayerInputs = document.querySelectorAll('input[list^="player-datalist-"]');
  if (ptPlayerInputs.length === 0) return;

  function refreshDatalistFor(input) {
    const datalistId = input.getAttribute("list");
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const selectedNames = Array.from(ptPlayerInputs)
      .filter(i => i !== input)
      .map(i => i.value.trim().toLowerCase())
      .filter(Boolean);

    // Rebuild options efficiently
    const frag = document.createDocumentFragment();
    for (const opt of allPlayerOptions) {
      if (!selectedNames.includes(opt.value.toLowerCase())) {
        frag.appendChild(opt.cloneNode(true));
      }
    }
    datalist.innerHTML = "";
    datalist.appendChild(frag);

    // Force Safari to refresh datalist suggestions
    // Trick: temporarily detach 'list' then restore it (no visible effect elsewhere).
    if (isSafari) {
      const originalList = datalistId;
      input.setAttribute("list", "");
      // Force reflow
      void input.offsetWidth;
      input.setAttribute("list", originalList);
    }
  }

  function onInputOrFocus(e) {
    const input = e.currentTarget;
    refreshDatalistFor(input);
  }

  ptPlayerInputs.forEach(input => {
    input.addEventListener("input", onInputOrFocus, { passive: true });
    input.addEventListener("focus", onInputOrFocus, { passive: true });
    input.addEventListener("change", onInputOrFocus, { passive: true });
  });

  // Initial build
  ptPlayerInputs.forEach(input => refreshDatalistFor(input));
}
