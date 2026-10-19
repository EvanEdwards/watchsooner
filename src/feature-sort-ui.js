// UI for sorting a playlist: a "Sort by" dropdown that temporarily reorders the
// list on screen, and "Save Sort", which makes that order permanent on YouTube
// (or builds a sorted copy). Relies on src/feature-playlist-sort.js
// (window.WatchSoonerSort) and the MAIN-world src/page-bridge.js.
(function () {
  const {
    SORT_MODES,
    MOVE_BATCH_SIZE,
    CREATE_CHUNK,
    ADD_CHUNK,
    modeById,
    sortItems,
    planMoves,
    buildMoveActions,
    buildAddActions,
    estimateRequests,
    firstDifference,
    parseHrefIndex,
    parseHrefVideoId,
  } = window.WatchSoonerSort;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const LAST = '1000000';
  const AFTER_LAST = '2000000';

  let nextRequestId = 1;
  const pending = new Map();

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (event.source !== window || !msg || !pending.has(msg.id)) return;
    const call = pending.get(msg.id);
    if (msg.wsoon === 'progress') {
      if (call.onProgress) call.onProgress(msg);
    } else if (msg.wsoon === 'res') {
      pending.delete(msg.id);
      if (msg.ok) call.resolve(msg.result);
      else call.reject(Object.assign(new Error(msg.error), { applied: msg.applied }));
    }
  });

  function bridge(op, payload, onProgress) {
    const id = nextRequestId++;
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      window.postMessage({ wsoon: 'req', id, op, payload }, window.location.origin);
    });
    promise.requestId = id;
    return promise;
  }

  let bridgeChecked = false;
  async function ensureBridge() {
    if (bridgeChecked) return;
    const timeout = sleep(3000).then(() => {
      throw new Error('The page helper did not respond. Reload the extension, then this page.');
    });
    await Promise.race([bridge('ping'), timeout]);
    bridgeChecked = true;
  }

  function currentPlaylistId() {
    return new URLSearchParams(window.location.search).get('list');
  }

  function playlistTitle(playlistId, container) {
    if (playlistId === 'WL') return 'Watch later';
    const panel = container.closest('ytd-playlist-panel-renderer');
    const heading =
      (panel && panel.querySelector('h3 a, .title')) ||
      document.querySelector('ytd-playlist-header-renderer h1, yt-page-header-renderer h1');
    return (heading && heading.textContent.trim()) || 'Playlist';
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function confirmSave({ modeLabel, total, moves, est }) {
    return new Promise((resolve) => {
      const overlay = el('div', 'watchsooner-modal');
      const dialog = el('div', 'watchsooner-modal__dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', 'Save sort to playlist');

      dialog.appendChild(el('h2', 'watchsooner-modal__title', 'Save this sort to the playlist?'));
      dialog.appendChild(el('p', '', `${modeLabel}.`));
      dialog.appendChild(
        el(
          'p',
          '',
          `Reordering changes the real order of this playlist: ${total} videos, ${moves} moves, ` +
            `about ${est.reorder} requests. YouTube has no undo for this.`
        )
      );
      if (est.offerCopy) {
        dialog.appendChild(
          el(
            'p',
            '',
            `A sorted copy takes about ${est.copy} requests and leaves this playlist untouched.`
          )
        );
      }

      const buttons = el('div', 'watchsooner-modal__buttons');
      const reorder = el('button', 'watchsooner-modal__primary', 'Reorder this playlist');
      const copy = el('button', 'watchsooner-modal__secondary', 'Create sorted copy');
      const cancel = el('button', 'watchsooner-modal__secondary', 'Cancel');
      [reorder, copy, cancel].forEach((b) => (b.type = 'button'));
      buttons.appendChild(reorder);
      if (est.offerCopy) buttons.appendChild(copy);
      buttons.appendChild(cancel);
      dialog.appendChild(buttons);
      overlay.appendChild(dialog);

      function finish(choice) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        resolve(choice);
      }
      function onKey(event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          finish('cancel');
        }
      }
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish('cancel');
      });
      reorder.addEventListener('click', () => finish('reorder'));
      copy.addEventListener('click', () => finish('copy'));
      cancel.addEventListener('click', () => finish('cancel'));

      document.body.appendChild(overlay);
      cancel.focus();
    });
  }

  function createSortRow({ container, itemSelector, isPanel }) {
    const row = el('div', 'watchsooner-sort');
    row.hidden = isPanel;

    const select = el('select', 'watchsooner-sort__select');
    select.setAttribute('aria-label', 'Sort playlist');
    SORT_MODES.forEach((mode) => {
      const option = el('option', '', mode.label);
      option.value = mode.id;
      select.appendChild(option);
    });
    const saveButton = el('button', 'watchsooner-sort__save', 'Save Sort');
    saveButton.type = 'button';
    saveButton.disabled = true;
    const status = el('span', 'watchsooner-sort__status');
    status.setAttribute('role', 'status');
    row.append(select, saveButton, status);

    let moreButton = null;
    if (isPanel) {
      moreButton = el('button', 'watchsooner-more', '⋮');
      moreButton.type = 'button';
      moreButton.setAttribute('aria-label', 'Sort options');
      moreButton.setAttribute('aria-expanded', 'false');
      moreButton.addEventListener('click', () => {
        row.hidden = !row.hidden;
        moreButton.setAttribute('aria-expanded', String(!row.hidden));
        moreButton.classList.toggle('watchsooner-more--on', !row.hidden);
      });
    }

    let activeMode = 'manual';
    let runToken = 0;
    let cache = null;
    let ranks = null;
    let ranksPlaylistId = null;
    let savedStyle = null;
    let saving = false;
    let locked = false;
    let savePromise = null;
    let reapplyTimer = null;

    function setStatus(text, extra) {
      status.textContent = text;
      if (extra) status.append(' ', extra);
    }

    function refreshControls() {
      select.classList.toggle('watchsooner-sort__select--active', activeMode !== 'manual');
      select.disabled = saving || locked;
      saveButton.disabled = locked || (!saving && activeMode === 'manual');
      saveButton.textContent = saving ? 'Cancel' : 'Save Sort';
    }

    const itemsInView = () => Array.from(container.querySelectorAll(itemSelector));

    function entryOf(item) {
      const a = item.querySelector('a[href*="/watch"]');
      const href = a ? a.getAttribute('href') : null;
      return { index: parseHrefIndex(href), videoId: parseHrefVideoId(href) };
    }

    function clearOrder() {
      if (!savedStyle) return;
      const { parent, display, flexDirection } = savedStyle;
      Array.from(parent.children).forEach((child) => child.style.removeProperty('order'));
      parent.style.display = display;
      parent.style.flexDirection = flexDirection;
      savedStyle = null;
    }

    // Reorders on screen with CSS `order`, so nothing in YouTube's own DOM moves
    // and "Manual order" is just removing these styles.
    function applyOrder() {
      const items = itemsInView();
      if (!items.length || !ranks) return;
      const parent = items[0].parentElement;
      if (!savedStyle) {
        savedStyle = { parent, display: parent.style.display, flexDirection: parent.style.flexDirection };
      }
      parent.style.display = 'flex';
      parent.style.flexDirection = 'column';
      Array.from(parent.children).forEach((child) => (child.style.order = AFTER_LAST));
      let unranked = 0;
      items.forEach((item) => {
        const { index, videoId } = entryOf(item);
        const hit = ranks.get(index);
        item.style.order = hit && hit.videoId === videoId ? String(hit.rank) : String(Number(LAST) + unranked++);
      });
    }

    function reset() {
      runToken++;
      clearOrder();
      ranks = null;
      activeMode = 'manual';
      select.value = 'manual';
      setStatus('');
      refreshControls();
    }

    function reapply() {
      if (activeMode === 'manual' || !ranks) return;
      if (ranksPlaylistId !== currentPlaylistId()) {
        reset();
        return;
      }
      if (reapplyTimer) return;
      reapplyTimer = setTimeout(() => {
        reapplyTimer = null;
        applyOrder();
      }, 150);
    }

    async function getData(force) {
      const playlistId = currentPlaylistId();
      if (!playlistId) throw new Error('This page has no playlist.');
      if (!force && cache && cache.playlistId === playlistId) return cache;
      await ensureBridge();
      setStatus('Reading playlist…');
      const result = await bridge('fetchPlaylist', { playlistId }, (p) => setStatus(`Reading playlist… ${p.loaded}`));
      cache = { playlistId, ...result };
      return cache;
    }

    // Scrolls the list so YouTube loads the rest of it. The watch-page panel may
    // not load more, in which case we sort what is there and say so.
    async function loadAllIntoView(total, token) {
      const count = () => itemsInView().length;
      let stalled = 0;
      let last = count();
      const stallLimit = isPanel ? 3 : 6;
      while (count() < total && token === runToken && stalled < stallLimit) {
        setStatus(`Loading videos… ${count()} / ${total}`);
        if (isPanel) container.scrollTop = container.scrollHeight;
        else window.scrollTo(0, document.documentElement.scrollHeight);
        await sleep(700);
        const now = count();
        stalled = now === last ? stalled + 1 : 0;
        last = now;
      }
      if (isPanel) container.scrollTop = 0;
      else window.scrollTo(0, 0);
    }

    async function selectMode(modeId) {
      const token = ++runToken;
      activeMode = modeId;
      refreshControls();
      if (modeId === 'manual') {
        clearOrder();
        ranks = null;
        setStatus('');
        return;
      }
      try {
        const data = await getData(false);
        if (token !== runToken) return;
        const sorted = sortItems(data.items, modeId);
        await loadAllIntoView(sorted.length, token);
        if (token !== runToken) return;
        ranks = new Map(sorted.map((item, rank) => [item.index, { rank, videoId: item.videoId }]));
        ranksPlaylistId = data.playlistId;
        applyOrder();
        const loaded = itemsInView().length;
        if (loaded < sorted.length) {
          setStatus(
            `Only ${loaded} of ${sorted.length} videos are loaded here, so only those are sorted. ` +
              (isPanel ? 'Open the playlist page to sort all of them.' : 'Choose the sort again to load the rest.')
          );
        } else {
          setStatus(`Sorted ${sorted.length} videos. This view is temporary until you Save Sort.`);
        }
      } catch (e) {
        if (token !== runToken) return;
        clearOrder();
        ranks = null;
        activeMode = 'manual';
        select.value = 'manual';
        setStatus(`Couldn't sort: ${e.message}`);
        refreshControls();
      }
    }

    // Once edits have reached YouTube, the positions in this page's DOM are stale,
    // so the sort controls stay locked until the page is reloaded.
    function lockAndReload(text) {
      locked = true;
      const reload = el('button', 'watchsooner-link', 'Reload page');
      reload.type = 'button';
      reload.addEventListener('click', () => window.location.reload());
      setStatus(text, reload);
    }

    async function saveReorder(data, target, plan) {
      const actions = buildMoveActions(plan);
      savePromise = bridge(
        'editPlaylist',
        { playlistId: data.playlistId, params: data.editParams, actions, batchSize: MOVE_BATCH_SIZE },
        (p) => setStatus(`Saving… ${p.done} / ${p.total} moves`)
      );
      const result = await savePromise;
      if (result.cancelled) {
        if (result.done > 0) {
          lockAndReload(`Cancelled after ${result.done} of ${result.total} moves. Reload, then Save Sort again to finish.`);
        } else {
          setStatus('Cancelled before anything was changed.');
        }
        return;
      }
      setStatus('Checking the saved order…');
      const fresh = await bridge('fetchPlaylist', { playlistId: data.playlistId });
      cache = { playlistId: data.playlistId, ...fresh };
      const diff = firstDifference(
        fresh.items.map((i) => i.setVideoId),
        target.map((i) => i.setVideoId)
      );
      lockAndReload(
        diff === -1
          ? 'Saved, and the new order is confirmed on YouTube. Reload to see it.'
          : `Saved, but YouTube's order differs from the sort at position ${diff + 1}. Reload and Save Sort again.`
      );
    }

    async function saveAsCopy(data, target, modeLabel) {
      const videoIds = target.map((i) => i.videoId);
      const title = `${playlistTitle(data.playlistId, container)} (${modeLabel.replace(/^Sort by /, 'sorted by ')})`;
      setStatus('Creating a new playlist…');
      const created = await bridge('createPlaylist', { title, videoIds: videoIds.slice(0, CREATE_CHUNK) });
      const rest = videoIds.slice(CREATE_CHUNK);
      if (rest.length) {
        savePromise = bridge(
          'editPlaylist',
          { playlistId: created.playlistId, params: null, actions: buildAddActions(rest), batchSize: ADD_CHUNK },
          (p) => setStatus(`Adding videos… ${CREATE_CHUNK + p.done} / ${videoIds.length}`)
        );
        const result = await savePromise;
        if (result.cancelled) {
          setStatus(`Cancelled. The new playlist has ${CREATE_CHUNK + result.done} of ${videoIds.length} videos.`);
          return;
        }
      }
      const link = el('a', 'watchsooner-link', 'Open the new playlist');
      link.href = `/playlist?list=${encodeURIComponent(created.playlistId)}`;
      setStatus(`Created a private playlist with ${videoIds.length} videos, in order.`, link);
    }

    async function onSave() {
      if (saving) {
        if (savePromise) bridge('cancel', { requestId: savePromise.requestId });
        setStatus('Cancelling after the current request…');
        return;
      }
      if (activeMode === 'manual' || locked) return;
      saving = true;
      savePromise = null;
      refreshControls();
      try {
        const data = await getData(true);
        const mode = modeById(activeMode);
        const target = sortItems(data.items, activeMode);
        const plan = planMoves(
          data.items.map((i) => i.setVideoId),
          target.map((i) => i.setVideoId)
        );
        if (!plan.length) {
          setStatus('The playlist is already in this order. Nothing to save.');
          return;
        }
        const est = estimateRequests(target.length, plan.length);
        let choice = 'reorder';
        if (est.needsConfirm) {
          choice = await confirmSave({ modeLabel: mode.label, total: target.length, moves: plan.length, est });
        }
        if (choice === 'cancel') {
          setStatus('Save cancelled. The playlist was not changed.');
        } else if (choice === 'copy') {
          await saveAsCopy(data, target, mode.label);
        } else {
          await saveReorder(data, target, plan);
        }
      } catch (e) {
        if (e.applied) {
          lockAndReload(`Couldn't finish saving: ${e.message} (${e.applied} edits were applied). Reload, then Save Sort again.`);
        } else {
          setStatus(`Couldn't save: ${e.message}`);
        }
      } finally {
        saving = false;
        savePromise = null;
        refreshControls();
      }
    }

    select.addEventListener('change', () => selectMode(select.value));
    saveButton.addEventListener('click', onSave);
    refreshControls();

    return { row, moreButton, reapply };
  }

  window.WatchSoonerSortUI = { createSortRow };
})();
