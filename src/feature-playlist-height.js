// Adds a "Show all" toggle to the Playlists panel that expands it to its full
// content height (so the page scrolls instead of a cramped internal scrollbar).
// UMD-ish: module.exports under Node, window.WatchSoonerHeightToggle in the browser.
(function (root) {
  // YouTube caps the Playlists panel via a `--ytd-watch-flexy-panel-max-height`
  // custom property. That property is normally set on the shared ytd-watch-flexy
  // ancestor, and other unrelated boxes (ads, related panels, etc.) read it too --
  // overriding it there leaks into all of them. Setting it directly on the panel
  // element itself scopes the override to just this panel and its descendants;
  // removing it afterwards falls back to the inherited (live-managed) value from
  // ytd-watch-flexy, so no caching of the "original" value is needed.
  function applyHeightOverride(panel, enabled) {
    if (!panel || typeof panel.querySelector !== 'function') return;
    const items = panel.querySelector('#items');
    if (!items) return;

    if (enabled) {
      panel.style.setProperty('--ytd-watch-flexy-panel-max-height', 'none');
      panel.style.setProperty('max-height', 'none', 'important');
      items.style.setProperty('overflow-y', 'visible', 'important');
      items.style.setProperty('height', 'auto', 'important');
    } else {
      panel.style.removeProperty('--ytd-watch-flexy-panel-max-height');
      panel.style.removeProperty('max-height');
      items.style.removeProperty('overflow-y');
      items.style.removeProperty('height');
    }
  }

  function createHeightToggle(panel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'watchsooner-height-toggle';
    button.textContent = 'Show all';
    button.setAttribute('aria-pressed', 'false');

    let enabled = false;
    button.addEventListener('click', () => {
      enabled = !enabled;
      button.classList.toggle('watchsooner-height-toggle--on', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      applyHeightOverride(panel, enabled);
    });

    return button;
  }

  const api = { applyHeightOverride, createHeightToggle };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.WatchSoonerHeightToggle = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
