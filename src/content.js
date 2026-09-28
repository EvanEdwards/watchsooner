// Adds a "watched %" range filter to the Watch Later playlist view and to
// the Playlists panel shown next to the video player. Relies on
// src/percent-filter.js (window.WatchSoonerFilter) being loaded first.
(function () {
  const { getWatchedPercent, shouldShow } = window.WatchSoonerFilter;

  const TARGETS = [
    {
      mountId: 'watchsooner-controls-playlist',
      containerSelector: 'ytd-playlist-video-list-renderer',
      itemSelector: 'ytd-playlist-video-renderer',
    },
    {
      mountId: 'watchsooner-controls-panel',
      containerSelector: 'ytd-playlist-panel-renderer #items',
      itemSelector: 'ytd-playlist-panel-video-renderer',
    },
  ];

  function createControl(onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'watchsooner-filter';
    wrap.innerHTML = [
      '<span class="watchsooner-filter__label">Watched %</span>',
      '<span class="watchsooner-filter__track">',
      '<span class="watchsooner-filter__range"></span>',
      '<input type="range" class="watchsooner-filter__min" min="0" max="100" value="0" step="1">',
      '<input type="range" class="watchsooner-filter__max" min="0" max="100" value="100" step="1">',
      '</span>',
      '<span class="watchsooner-filter__values">Any</span>',
    ].join('');

    const minInput = wrap.querySelector('.watchsooner-filter__min');
    const maxInput = wrap.querySelector('.watchsooner-filter__max');
    const values = wrap.querySelector('.watchsooner-filter__values');
    const range = wrap.querySelector('.watchsooner-filter__range');

    function emit() {
      let min = Number(minInput.value);
      let max = Number(maxInput.value);
      if (min > max) {
        [min, max] = [max, min];
      }
      values.textContent = min === 0 && max === 100 ? 'Any' : `${min}–${max}%`;
      range.style.left = `${min}%`;
      range.style.width = `${max - min}%`;
      onChange(min, max);
    }

    minInput.addEventListener('input', emit);
    maxInput.addEventListener('input', emit);

    return { element: wrap, emit };
  }

  function applyFilter(container, itemSelector, min, max) {
    container.querySelectorAll(itemSelector).forEach((item) => {
      const percent = getWatchedPercent(item);
      item.style.display = shouldShow(percent, min, max) ? '' : 'none';
    });
  }

  function mount(target) {
    if (document.getElementById(target.mountId)) return;
    const container = document.querySelector(target.containerSelector);
    if (!container || !container.parentElement) return;

    const { element, emit } = createControl((min, max) =>
      applyFilter(container, target.itemSelector, min, max)
    );
    element.id = target.mountId;
    container.parentElement.insertBefore(element, container);
    emit();

    const observer = new MutationObserver(emit);
    observer.observe(container, { childList: true, subtree: true });
  }

  function mountAll() {
    TARGETS.forEach(mount);
  }

  mountAll();
  document.addEventListener('yt-navigate-finish', mountAll);
  new MutationObserver(mountAll).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
