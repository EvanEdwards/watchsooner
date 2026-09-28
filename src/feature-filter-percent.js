// Pure logic for reading YouTube's watched-progress bar and deciding
// whether a playlist item should stay visible under a min/max percent filter.
// Loaded as a plain script in the extension (exposes window.WatchSoonerFilter)
// and required as CommonJS in tests (module.exports).
(function (root) {
  function extractPercentFromStyle(styleWidth) {
    if (styleWidth === null || styleWidth === undefined) return null;
    const match = /^([\d.]+)%$/.exec(String(styleWidth).trim());
    if (!match) return null;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  // YouTube renders the watched-progress bar differently across rollouts:
  // older markup uses an element with id="progress"; newer markup
  // (ytw-thumbnail-overlay-resume-playback-renderer) uses an unlabeled <div>
  // inside the overlay, identified only by its inline percent width style.
  function getWatchedPercent(itemEl) {
    if (!itemEl || typeof itemEl.querySelector !== 'function') return null;

    const namedBar = itemEl.querySelector('#progress');
    if (namedBar && namedBar.style) {
      const percent = extractPercentFromStyle(namedBar.style.width);
      if (percent !== null) return percent;
    }

    const overlay = itemEl.querySelector(
      'ytw-thumbnail-overlay-resume-playback-renderer, ytd-thumbnail-overlay-resume-playback-renderer'
    );
    if (!overlay) return null;

    const bars = overlay.querySelectorAll('div');
    for (const bar of bars) {
      const percent = extractPercentFromStyle(bar.style && bar.style.width);
      if (percent !== null) return percent;
    }
    return null;
  }

  function shouldShow(percent, minPercent, maxPercent) {
    // Videos with no progress bar (never started) are treated as 0% watched.
    const value = percent === null || percent === undefined ? 0 : percent;
    return value >= minPercent && value <= maxPercent;
  }

  const api = { extractPercentFromStyle, getWatchedPercent, shouldShow };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.WatchSoonerFilter = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
