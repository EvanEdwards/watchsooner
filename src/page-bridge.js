// Runs in the page's own JS world (manifest `world: "MAIN"`) so it can use
// YouTube's session (window.ytcfg + the SAPISID cookie) to call InnerTube, the
// API youtube.com itself uses. Isolated-world scripts talk to it with
// window.postMessage. The parsing helpers are pure and exported for tests.
(function (root) {
  function findKey(node, key) {
    if (!node || typeof node !== 'object') return undefined;
    if (!Array.isArray(node) && node[key] !== undefined) return node[key];
    for (const k of Object.keys(node)) {
      const found = findKey(node[k], key);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function findToken(node) {
    const command = findKey(node, 'continuationCommand');
    return command && command.token ? command.token : null;
  }

  function textOf(t) {
    if (!t) return '';
    if (t.simpleText) return t.simpleText;
    return (t.runs || []).map((r) => r.text).join('');
  }

  function parseItem(r) {
    const byline = r.shortBylineText && r.shortBylineText.runs && r.shortBylineText.runs[0];
    const browse = byline && byline.navigationEndpoint && byline.navigationEndpoint.browseEndpoint;
    const info = (r.videoInfo && r.videoInfo.runs) || [];
    const overlay = (r.thumbnailOverlays || []).find((o) => o.thumbnailOverlayResumePlaybackRenderer);
    const pct = overlay ? overlay.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched : 0;
    const length = parseInt(r.lengthSeconds, 10);
    return {
      index: parseInt(textOf(r.index), 10),
      videoId: r.videoId,
      setVideoId: r.setVideoId,
      title: textOf(r.title),
      channel: byline ? byline.text : '',
      channelId: browse ? browse.browseId : null,
      durationSec: Number.isFinite(length) ? length : null,
      watchedPct: Number.isFinite(pct) ? pct : 0,
      publishedText: info.length ? info[info.length - 1].text : null,
    };
  }

  // Handles both the first browse response (playlistVideoListRenderer) and
  // continuation responses (continuationItems).
  function parsePlaylistPage(data) {
    const listRenderer = findKey(data, 'playlistVideoListRenderer');
    const contents = (listRenderer && listRenderer.contents) || findKey(data, 'continuationItems') || [];
    const items = contents.filter((c) => c.playlistVideoRenderer).map((c) => parseItem(c.playlistVideoRenderer));
    const continuation = contents.find((c) => c.continuationItemRenderer);
    const edit = findKey(contents, 'playlistEditEndpoint');
    return {
      items,
      token: continuation ? findToken(continuation) : null,
      editParams: edit && edit.params ? edit.params : null,
    };
  }

  const api = { findKey, findToken, parseItem, parsePlaylistPage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const REQUEST_GAP_MS = 250;
  const MAX_PAGES = 200;
  const cancelled = new Set();

  function readCookie(name) {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : null;
  }

  async function sha1Hex(text) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function innertube(endpoint, body) {
    const cfg = root.ytcfg;
    const sapisid = readCookie('SAPISID') || readCookie('__Secure-3PAPISID');
    if (!cfg || !sapisid) throw new Error('Not signed in to YouTube.');
    const origin = 'https://www.youtube.com';
    const ts = Math.floor(Date.now() / 1000);
    const hash = await sha1Hex(`${ts} ${sapisid} ${origin}`);
    const context = cfg.get('INNERTUBE_CONTEXT');
    const res = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SAPISIDHASH ${ts}_${hash}`,
        'X-Origin': origin,
        'X-Goog-AuthUser': String(cfg.get('SESSION_INDEX') || 0),
        'X-Youtube-Client-Name': '1',
        'X-Youtube-Client-Version': context.client.clientVersion,
      },
      body: JSON.stringify({ context, ...body }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = err.error && err.error.message ? `: ${err.error.message}` : '';
      } catch (e) {
        detail = '';
      }
      const error = new Error(`YouTube returned HTTP ${res.status} for ${endpoint}${detail}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  }

  async function fetchPlaylist({ playlistId }, progress) {
    let data = await innertube('browse', { browseId: `VL${playlistId}` });
    let page = parsePlaylistPage(data);
    const items = page.items.slice();
    let editParams = page.editParams;
    let token = page.token;
    for (let pages = 1; token && pages < MAX_PAGES; pages++) {
      progress({ loaded: items.length });
      await sleep(REQUEST_GAP_MS);
      data = await innertube('browse', { continuation: token });
      page = parsePlaylistPage(data);
      items.push(...page.items);
      editParams = editParams || page.editParams;
      token = page.token;
    }
    return { items, editParams };
  }

  async function sendActions(playlistId, params, actions, state) {
    try {
      const body = { playlistId, actions };
      if (params) body.params = params;
      const res = await innertube('browse/edit_playlist', body);
      if (res.status && res.status !== 'STATUS_SUCCEEDED') {
        throw new Error(`YouTube rejected the playlist edit (${res.status}).`);
      }
      state.done += actions.length;
    } catch (e) {
      // A batch the server refuses as too large (or otherwise invalid) is split
      // and retried; a single action that still fails is a real error.
      if (actions.length > 1 && e.status === 400) {
        const mid = actions.length >> 1;
        await sendActions(playlistId, params, actions.slice(0, mid), state);
        await sendActions(playlistId, params, actions.slice(mid), state);
        return;
      }
      throw e;
    }
  }

  async function editPlaylist({ playlistId, params, actions, batchSize, requestId }, progress) {
    const state = { done: 0 };
    try {
      for (let i = 0; i < actions.length; i += batchSize) {
        if (cancelled.has(requestId)) break;
        await sendActions(playlistId, params, actions.slice(i, i + batchSize), state);
        progress({ done: state.done, total: actions.length });
        await sleep(REQUEST_GAP_MS);
      }
    } catch (e) {
      e.applied = state.done;
      throw e;
    }
    return { done: state.done, total: actions.length, cancelled: cancelled.has(requestId) };
  }

  async function createPlaylist({ title, videoIds }) {
    const res = await innertube('playlist/create', { title, privacyStatus: 'PRIVATE', videoIds });
    if (!res.playlistId) throw new Error('YouTube did not return a playlist id.');
    return { playlistId: res.playlistId };
  }

  root.addEventListener('message', async (event) => {
    const msg = event.data;
    if (event.source !== root || !msg || msg.wsoon !== 'req') return;
    const { id, op, payload } = msg;
    const post = (extra) => root.postMessage({ wsoon: 'res', id, ...extra }, root.location.origin);
    const progress = (info) => root.postMessage({ wsoon: 'progress', id, ...info }, root.location.origin);
    try {
      let result;
      if (op === 'ping') result = true;
      else if (op === 'cancel') {
        cancelled.add(payload.requestId);
        result = true;
      } else if (op === 'fetchPlaylist') result = await fetchPlaylist(payload, progress);
      else if (op === 'editPlaylist') result = await editPlaylist({ ...payload, requestId: id }, progress);
      else if (op === 'createPlaylist') result = await createPlaylist(payload);
      else throw new Error(`Unknown bridge operation: ${op}`);
      post({ ok: true, result });
    } catch (e) {
      post({ ok: false, error: e.message, applied: e.applied });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
