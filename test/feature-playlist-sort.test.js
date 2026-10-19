const test = require('node:test');
const assert = require('node:assert/strict');
const sort = require('../src/feature-playlist-sort.js');

const {
  parsePublishedDays,
  sortItems,
  planMoves,
  buildMoveActions,
  buildAddActions,
  longestIncreasingSubsequence,
  estimateRequests,
  chunk,
  firstDifference,
  parseHrefIndex,
  parseHrefVideoId,
  MOVE_BATCH_SIZE,
  WARN_MOVES,
} = sort;

// Mirrors what YouTube does with our actions (see "Move to top" in its menus:
// AFTER with no predecessor = top).
function applyActions(order, actions) {
  const list = order.slice();
  for (const a of actions) {
    assert.equal(a.action, 'ACTION_MOVE_VIDEO_AFTER');
    list.splice(list.indexOf(a.setVideoId), 1);
    const at = a.movedSetVideoIdPredecessor ? list.indexOf(a.movedSetVideoIdPredecessor) + 1 : 0;
    list.splice(at, 0, a.setVideoId);
  }
  return list;
}

function seededShuffle(list, seed) {
  const out = list.slice();
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

test('parsePublishedDays understands YouTube relative times', () => {
  assert.equal(parsePublishedDays('6y ago'), 6 * 365);
  assert.equal(parsePublishedDays('5mo ago'), 150);
  assert.equal(parsePublishedDays('3w ago'), 21);
  assert.equal(parsePublishedDays('2d ago'), 2);
  assert.equal(parsePublishedDays('4h ago'), 4 / 24);
  assert.equal(parsePublishedDays('12 min ago'), 12 / 1440);
  assert.equal(parsePublishedDays('Streamed 2w ago'), 14);
  assert.equal(parsePublishedDays('6 years ago'), 6 * 365);
  assert.equal(parsePublishedDays('1 month ago'), 30);
});

test('parsePublishedDays returns null for missing or non-time text', () => {
  assert.equal(parsePublishedDays(null), null);
  assert.equal(parsePublishedDays(''), null);
  assert.equal(parsePublishedDays('702K'), null);
  assert.equal(parsePublishedDays('Premiered tomorrow'), null);
});

const items = [
  { setVideoId: 's1', channel: 'Zed', title: 'b', durationSec: 300, watchedPct: 0, publishedText: '2y ago' },
  { setVideoId: 's2', channel: 'alpha', title: 'a', durationSec: 60, watchedPct: 100, publishedText: '1w ago' },
  { setVideoId: 's3', channel: 'Zed', title: 'C', durationSec: null, watchedPct: 40, publishedText: null },
  { setVideoId: 's4', channel: 'Beta', title: 'a2', durationSec: 600, watchedPct: 0, publishedText: '3mo ago' },
];
const ids = (list) => list.map((i) => i.setVideoId);

test('sortItems by channel is case-insensitive and keeps ties in playlist order', () => {
  assert.deepEqual(ids(sortItems(items, 'channel-asc')), ['s2', 's4', 's1', 's3']);
  assert.deepEqual(ids(sortItems(items, 'channel-desc')), ['s1', 's3', 's4', 's2']);
});

test('sortItems by title and watched %', () => {
  assert.deepEqual(ids(sortItems(items, 'title-asc')), ['s2', 's4', 's1', 's3']);
  assert.deepEqual(ids(sortItems(items, 'watched-desc')), ['s2', 's3', 's1', 's4']);
  assert.deepEqual(ids(sortItems(items, 'watched-asc')), ['s1', 's4', 's3', 's2']);
});

test('sortItems puts missing durations and dates last in either direction', () => {
  assert.deepEqual(ids(sortItems(items, 'duration-asc')), ['s2', 's1', 's4', 's3']);
  assert.deepEqual(ids(sortItems(items, 'duration-desc')), ['s4', 's1', 's2', 's3']);
  assert.deepEqual(ids(sortItems(items, 'published-new')), ['s2', 's4', 's1', 's3']);
  assert.deepEqual(ids(sortItems(items, 'published-old')), ['s1', 's4', 's2', 's3']);
});

test('sortItems manual (or unknown) mode returns a copy in the original order', () => {
  const out = sortItems(items, 'manual');
  assert.deepEqual(ids(out), ['s1', 's2', 's3', 's4']);
  assert.notEqual(out, items);
  assert.deepEqual(ids(sortItems(items, 'nope')), ['s1', 's2', 's3', 's4']);
});

test('longestIncreasingSubsequence finds a longest run', () => {
  assert.equal(longestIncreasingSubsequence([0, 1, 2, 3]).size, 4);
  assert.equal(longestIncreasingSubsequence([3, 2, 1, 0]).size, 1);
  assert.equal(longestIncreasingSubsequence([2, 0, 1, 3, 4]).size, 4);
  assert.equal(longestIncreasingSubsequence([]).size, 0);
});

test('planMoves needs no moves when the order already matches', () => {
  assert.deepEqual(planMoves(['a', 'b', 'c'], ['a', 'b', 'c']), []);
});

test('planMoves moves a single misplaced video once', () => {
  const moves = planMoves(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'a']);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], { id: 'a', afterId: 'd' });
});

test('planMoves uses a null predecessor to move a video to the top', () => {
  const moves = planMoves(['a', 'b', 'c'], ['c', 'a', 'b']);
  assert.deepEqual(moves, [{ id: 'c', afterId: null }]);
});

test('planMoves reversing a list of n needs n-1 moves', () => {
  const current = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(planMoves(current, current.slice().reverse()).length, 4);
});

test('planMoves rejects orders that are not the same set of videos', () => {
  assert.throws(() => planMoves(['a', 'b'], ['a']));
  assert.throws(() => planMoves(['a', 'b'], ['a', 'x']));
});

test('applying planMoves actions always reproduces the target order', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const n = 1 + (seed % 40);
    const current = Array.from({ length: n }, (_, i) => `v${i}`);
    const target = seededShuffle(current, seed);
    const moves = planMoves(current, target);
    const result = applyActions(current, buildMoveActions(moves));
    assert.deepEqual(result, target, `seed ${seed}`);
    assert.ok(moves.length <= Math.max(0, n - 1));
  }
});

test('planMoves is minimal: n minus the longest increasing run', () => {
  const current = Array.from({ length: 30 }, (_, i) => `v${i}`);
  const target = seededShuffle(current, 7);
  const pos = new Map(current.map((id, i) => [id, i]));
  const lis = longestIncreasingSubsequence(target.map((id) => pos.get(id))).size;
  assert.equal(planMoves(current, target).length, current.length - lis);
});

test('buildMoveActions omits the predecessor only for a move to the top', () => {
  const actions = buildMoveActions([
    { id: 'x', afterId: null },
    { id: 'y', afterId: 'x' },
  ]);
  assert.deepEqual(actions, [
    { action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: 'x' },
    { action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: 'y', movedSetVideoIdPredecessor: 'x' },
  ]);
});

test('buildAddActions and chunk', () => {
  assert.deepEqual(buildAddActions(['a', 'b']), [
    { action: 'ACTION_ADD_VIDEO', addedVideoId: 'a' },
    { action: 'ACTION_ADD_VIDEO', addedVideoId: 'b' },
  ]);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

test('estimateRequests only asks for confirmation above the move threshold', () => {
  assert.equal(estimateRequests(500, WARN_MOVES).needsConfirm, false);
  assert.equal(estimateRequests(500, WARN_MOVES + 1).needsConfirm, true);
});

test('estimateRequests offers a sorted copy only when it takes fewer requests', () => {
  assert.equal(estimateRequests(900, 10).offerCopy, false);
  const big = estimateRequests(900, 880);
  assert.equal(big.reorder, Math.ceil(880 / MOVE_BATCH_SIZE));
  assert.equal(big.copy, 9);
  assert.equal(big.offerCopy, true);
  assert.equal(estimateRequests(50, MOVE_BATCH_SIZE).offerCopy, false);
  assert.equal(estimateRequests(50, MOVE_BATCH_SIZE + 1).offerCopy, true);
});

test('firstDifference locates the first mismatch or -1', () => {
  assert.equal(firstDifference(['a', 'b'], ['a', 'b']), -1);
  assert.equal(firstDifference(['a', 'b', 'c'], ['a', 'c', 'b']), 1);
  assert.equal(firstDifference(['a'], ['a', 'b']), 1);
});

test('parseHrefIndex and parseHrefVideoId read watch links', () => {
  const href = '/watch?v=wnMqT8QbvaM&list=WL&index=8&pp=abc';
  assert.equal(parseHrefIndex(href), 8);
  assert.equal(parseHrefVideoId(href), 'wnMqT8QbvaM');
  assert.equal(parseHrefIndex('/watch?v=wnMqT8QbvaM'), null);
  assert.equal(parseHrefIndex(null), null);
  assert.equal(parseHrefVideoId(undefined), null);
});
