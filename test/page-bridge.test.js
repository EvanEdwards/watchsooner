const test = require('node:test');
const assert = require('node:assert/strict');
const { findKey, findToken, parseItem, parsePlaylistPage } = require('../src/page-bridge.js');

function renderer(n, overrides = {}) {
  return {
    playlistVideoRenderer: {
      videoId: `vid${String(n).padStart(8, '0')}`,
      setVideoId: `set${n}`,
      index: { simpleText: String(n) },
      title: { runs: [{ text: `Title ${n}` }] },
      shortBylineText: {
        runs: [{ text: 'DUST', navigationEndpoint: { browseEndpoint: { browseId: 'UC123' } } }],
      },
      lengthSeconds: '600',
      videoInfo: { runs: [{ text: '2.7M' }, { text: ' • ' }, { text: '6y ago' }] },
      thumbnailOverlays: [
        { thumbnailOverlayTimeStatusRenderer: {} },
        { thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: 42 } },
      ],
      menu: { items: [{ playlistEditEndpoint: { playlistId: 'WL', params: 'PARAMS12345', actions: [] } }] },
      ...overrides,
    },
  };
}

const continuation = {
  continuationItemRenderer: {
    continuationEndpoint: {
      commandExecutorCommand: {
        commands: [{ somethingElse: {} }, { continuationCommand: { token: 'TOKEN-1' } }],
      },
    },
  },
};

test('parseItem extracts the fields used for sorting and reordering', () => {
  const item = parseItem(renderer(7).playlistVideoRenderer);
  assert.deepEqual(item, {
    index: 7,
    videoId: 'vid00000007',
    setVideoId: 'set7',
    title: 'Title 7',
    channel: 'DUST',
    channelId: 'UC123',
    durationSec: 600,
    watchedPct: 42,
    publishedText: '6y ago',
  });
});

test('parseItem defaults: 0% watched, no duration, no date', () => {
  const item = parseItem(
    renderer(1, { thumbnailOverlays: [], lengthSeconds: undefined, videoInfo: { runs: [] } }).playlistVideoRenderer
  );
  assert.equal(item.watchedPct, 0);
  assert.equal(item.durationSec, null);
  assert.equal(item.publishedText, null);
});

test('parsePlaylistPage reads a first page: items, token and edit params', () => {
  const data = {
    contents: {
      twoColumn: { list: { playlistVideoListRenderer: { contents: [renderer(1), renderer(2), continuation] } } },
    },
  };
  const page = parsePlaylistPage(data);
  assert.equal(page.items.length, 2);
  assert.equal(page.items[1].setVideoId, 'set2');
  assert.equal(page.token, 'TOKEN-1');
  assert.equal(page.editParams, 'PARAMS12345');
});

test('parsePlaylistPage reads a continuation page and the final page (no token)', () => {
  const middle = {
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [renderer(3), continuation] } }],
  };
  assert.equal(parsePlaylistPage(middle).token, 'TOKEN-1');
  const last = {
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [renderer(4)] } }],
  };
  const page = parsePlaylistPage(last);
  assert.equal(page.items.length, 1);
  assert.equal(page.token, null);
});

test('parsePlaylistPage tolerates an empty or unexpected response', () => {
  assert.deepEqual(parsePlaylistPage({}), { items: [], token: null, editParams: null });
});

test('findKey and findToken search nested objects and arrays', () => {
  assert.equal(findKey({ a: [{ b: { c: 5 } }] }, 'c'), 5);
  assert.equal(findKey({ a: 1 }, 'zzz'), undefined);
  assert.equal(findToken({ x: [{ continuationCommand: { token: 'T' } }] }), 'T');
  assert.equal(findToken({ x: 1 }), null);
});
