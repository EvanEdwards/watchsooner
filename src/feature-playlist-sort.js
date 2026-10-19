// Sorting and playlist-reorder logic: sort modes, publication-time parsing, and
// planning the minimum set of "move" edits that turns one order into another.
// Pure and dependency-free. UMD-ish: module.exports under Node,
// window.WatchSoonerSort in the browser.
(function (root) {
  // Edits per request when reordering / adding videos. Requests are sent one at a
  // time with a short pause between them.
  const MOVE_BATCH_SIZE = 25;
  const CREATE_CHUNK = 100;
  const ADD_CHUNK = 100;
  // Reorders needing more than this many moves ask for confirmation first.
  const WARN_MOVES = 50;

  const UNIT_DAYS = { min: 1 / 1440, h: 1 / 24, d: 1, w: 7, mo: 30, y: 365 };

  // YouTube only shows relative times ("6y ago", "Streamed 2w ago"), so this is
  // approximate. Returns null when there is no usable time.
  function parsePublishedDays(text) {
    if (!text) return null;
    const m = /(\d+)\s*(minutes?|min|hours?|h|days?|d|weeks?|w|months?|mo|years?|y)\b\s*ago/i.exec(text);
    if (!m) return null;
    const unit = m[2].toLowerCase();
    let key;
    if (unit.startsWith('mo')) key = 'mo';
    else if (unit.startsWith('min')) key = 'min';
    else key = unit[0];
    return parseInt(m[1], 10) * UNIT_DAYS[key];
  }

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  function byText(get, dir) {
    return (a, b) => dir * collator.compare(get(a) || '', get(b) || '');
  }

  // Missing values always sort last, whichever direction is chosen.
  function byNumber(get, dir) {
    return (a, b) => {
      const x = get(a);
      const y = get(b);
      const xNull = x === null || x === undefined;
      const yNull = y === null || y === undefined;
      if (xNull || yNull) return xNull === yNull ? 0 : xNull ? 1 : -1;
      return dir * (x - y);
    };
  }

  const SORT_MODES = [
    { id: 'manual', label: 'Sort: Manual order', compare: null },
    { id: 'channel-asc', label: 'Sort by Channel Name (A–Z)', compare: byText((i) => i.channel, 1) },
    { id: 'channel-desc', label: 'Sort by Channel Name (Z–A)', compare: byText((i) => i.channel, -1) },
    { id: 'title-asc', label: 'Sort by Title (A–Z)', compare: byText((i) => i.title, 1) },
    { id: 'duration-asc', label: 'Sort by Duration (shortest first)', compare: byNumber((i) => i.durationSec, 1) },
    { id: 'duration-desc', label: 'Sort by Duration (longest first)', compare: byNumber((i) => i.durationSec, -1) },
    { id: 'watched-desc', label: 'Sort by Watched % (most first)', compare: byNumber((i) => i.watchedPct, -1) },
    { id: 'watched-asc', label: 'Sort by Watched % (least first)', compare: byNumber((i) => i.watchedPct, 1) },
    {
      id: 'published-new',
      label: 'Sort by Publication Time (newest first)',
      compare: byNumber((i) => parsePublishedDays(i.publishedText), 1),
    },
    {
      id: 'published-old',
      label: 'Sort by Publication Time (oldest first)',
      compare: byNumber((i) => parsePublishedDays(i.publishedText), -1),
    },
  ];

  function modeById(id) {
    return SORT_MODES.find((m) => m.id === id);
  }

  // Stable: ties keep their current playlist order, so sorting by channel also
  // groups videos by channel without scrambling each channel's own order.
  function sortItems(items, modeId) {
    const mode = modeById(modeId);
    if (!mode || !mode.compare) return items.slice();
    return items
      .map((item, position) => ({ item, position }))
      .sort((a, b) => mode.compare(a.item, b.item) || a.position - b.position)
      .map((x) => x.item);
  }

  // Indices (into seq) of one longest strictly increasing subsequence.
  function longestIncreasingSubsequence(seq) {
    const tails = [];
    const prev = new Array(seq.length).fill(-1);
    for (let i = 0; i < seq.length; i++) {
      let lo = 0;
      let hi = tails.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (seq[tails[mid]] < seq[i]) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0) prev[i] = tails[lo - 1];
      tails[lo] = i;
    }
    const keep = new Set();
    for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = prev[i]) keep.add(i);
    return keep;
  }

  // The fewest "move X right after Y" edits that turn currentIds into targetIds.
  // Videos already in a longest run of correct relative order stay put; every
  // other video is moved, in target order, to just after its target predecessor
  // (afterId null = move to the top).
  function planMoves(currentIds, targetIds) {
    if (currentIds.length !== targetIds.length) {
      throw new Error('Current and target orders must contain the same videos.');
    }
    const position = new Map(currentIds.map((id, i) => [id, i]));
    const seq = targetIds.map((id) => {
      if (!position.has(id)) throw new Error('Current and target orders must contain the same videos.');
      return position.get(id);
    });
    const keep = longestIncreasingSubsequence(seq);
    const moves = [];
    targetIds.forEach((id, i) => {
      if (!keep.has(i)) moves.push({ id, afterId: i === 0 ? null : targetIds[i - 1] });
    });
    return moves;
  }

  // YouTube's own "Move to top" is ACTION_MOVE_VIDEO_AFTER with no predecessor.
  function buildMoveActions(moves) {
    return moves.map((m) => {
      const action = { action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: m.id };
      if (m.afterId) action.movedSetVideoIdPredecessor = m.afterId;
      return action;
    });
  }

  function buildAddActions(videoIds) {
    return videoIds.map((id) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id }));
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  // Request counts for reordering in place versus building a sorted copy.
  function estimateRequests(total, moveCount) {
    const reorder = Math.ceil(moveCount / MOVE_BATCH_SIZE);
    const copy = 1 + Math.ceil(Math.max(0, total - CREATE_CHUNK) / ADD_CHUNK);
    return { reorder, copy, offerCopy: copy < reorder, needsConfirm: moveCount > WARN_MOVES };
  }

  function firstDifference(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
    return -1;
  }

  function parseHrefIndex(href) {
    const m = /[?&]index=(\d+)/.exec(href || '');
    return m ? parseInt(m[1], 10) : null;
  }

  function parseHrefVideoId(href) {
    const m = /[?&]v=([\w-]{11})/.exec(href || '');
    return m ? m[1] : null;
  }

  const api = {
    MOVE_BATCH_SIZE,
    CREATE_CHUNK,
    ADD_CHUNK,
    WARN_MOVES,
    SORT_MODES,
    modeById,
    parsePublishedDays,
    sortItems,
    longestIncreasingSubsequence,
    planMoves,
    buildMoveActions,
    buildAddActions,
    chunk,
    estimateRequests,
    firstDifference,
    parseHrefIndex,
    parseHrefVideoId,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.WatchSoonerSort = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
