# watchsooner — project notes

Chrome extension (MV3) that improves YouTube's Watch Later experience. Details and feature list live in `project.md`; `README.md` is generated from it, don't edit it or `README.md`

`CHANGELOG.md` entries go newest-first: add new lines at the top of the day's list, not the bottom.  System may have `clog` which adds entries automatically with `clog -- "Changes to log"`  All changes should be terse: 180 characters or less, ideally 80 characters or less.

When writing scripts, prefer bash over Node. (Unit tests still use Node's built-in runner, and the extension code itself is JavaScript.)

When testing live with the Claude in Chrome extension (`mcp__claude-in-chrome__*`), leave the browser tab/session open when done — don't close it with `tabs_close_mcp`. The user wants to keep it for follow-up work. Reuse the open tab on later tests instead of creating a new one.

## Layout

- `src/feature-filter-percent.js` — pure DOM-reading/filter logic for the watched-%
  slider (UMD-ish: `module.exports` under Node, `window.WatchSoonerFilter` in the
  browser). Kept dependency-free so it loads as a plain `<script>`.
- `src/feature-playlist-height.js` — the Playlists panel's "Show all" height toggle
  (same UMD-ish pattern, `window.WatchSoonerHeightToggle`). `applyHeightOverride` is
  pure enough to unit test with mock `style` objects (see
  `test/feature-playlist-height.test.js`); `createHeightToggle` builds the actual
  `<button>` and is DOM-only, like `content.js`.
- `src/feature-playlist-sort.js` — pure sort/reorder logic (UMD-ish,
  `window.WatchSoonerSort`): sort modes and comparators, relative-publication-time
  parsing, `planMoves` (fewest "move X after Y" edits, via a longest increasing
  subsequence), action builders, request estimates and the thresholds.
- `src/feature-sort-ui.js` — the sort dropdown, Save Sort, confirmation dialog, status
  line, loading the whole list into view, and applying the order with CSS `order`
  (`window.WatchSoonerSortUI`). DOM-only, not unit tested.
- `src/page-bridge.js` — runs in the page's own JS world (manifest `"world": "MAIN"`),
  because only there can it read `window.ytcfg`. Calls YouTube's InnerTube API with
  the signed-in session; the isolated-world scripts talk to it over
  `window.postMessage` (`{wsoon:'req'|'res'|'progress', id, ...}`). Ops: `ping`,
  `fetchPlaylist`, `editPlaylist`, `createPlaylist`, `cancel`. The response parsers
  at the top are pure and unit tested (`test/page-bridge.test.js`).
- `src/content.js` — DOM wiring only: mounts each feature's controls above the Watch
  Later list and above the Playlists panel, re-filters and re-applies the sort via
  `MutationObserver` + YouTube's `yt-navigate-finish` SPA navigation event. The
  feature scripts must load before this one (see `src/manifest.json`'s
  `content_scripts.js` order).
- `src/slider.css` — styling for the injected control (dual-thumb via two overlaid
  native `<input type="range">`, plus a `.watchsooner-filter__range` div positioned
  by `content.js` to show the filled portion between the two thumbs). Uses only its
  own `--wsoon-*` custom properties (set per-theme via `prefers-color-scheme`) —
  never YouTube's `--yt-spec-*` vars. Those turned out to not reliably come from
  YouTube itself: in testing, `--yt-spec-text-primary` was actually being supplied
  by an unrelated installed extension, and vanished when that extension was off.
  Track is a literal `#ccc`, thumbs/fill are YouTube's watched-progress red
  `#ff0033` — both requested as fixed colors, not theme-dependent.
- `src/manifest.json` — MV3 manifest **template**. Its `name`, `short_name`,
  `description`, `homepage_url` and `version` are placeholders that
  `scripts/build-manifest.sh` overwrites from `project.md`; don't edit those five here.
- `test/*.test.js` (filter, height, sort, page-bridge) — Node's built-in test runner
  (`node --test`), no external test framework/deps. Only the pure logic in each
  module is unit tested; `content.js`, `feature-sort-ui.js` and
  `createHeightToggle`'s button creation are DOM-only and are checked live instead.
- `scripts/build-manifest.sh` — bash. Builds `dist/unpacked/manifest.json` from the
  `src/manifest.json` template, copying fixed fields out of `project.md`'s
  frontmatter with `yq` (see "Manifest fields come from `project.md`" below).
  `test/build-manifest.test.js` runs it against fixtures.
- `scripts/build-website.sh`, `website/` — the site builder (`docs/index.html` and
  `docs/privacy.html`) and its inputs (two templates plus the vendored design files);
  `test/build-website.test.js` covers it. See "Website" below.
- `PRIVACY.md`, `LISTING.md`, `assets/google/Declarations.md` — the Web Store paperwork
  (policy text, listing text, dashboard answers). See "Store submission documents".
- `scripts/draft-release-notes.js`, `scripts/changelog-append-release.js` — the two
  `make release` helpers. Still Node (written before the bash preference below);
  convert to bash if you're touching them anyway.

## Chrome Web Store assets (`assets/google/`)

Everything needed for the store listing lives in `assets/google/`; these images are
uploaded in the store dashboard and are **not** part of the extension zip.
`project.md` stays the canonical source for name and description.

- `screenshot-NNN.png` — **1280×800**, opaque, full bleed (no border or padding). The
  store takes 1–5, at least one required. **Treat the set as a glob, never a fixed
  list:** if the user adds `screenshot-002.png` or similar, include it too — in any
  script, checklist or submission notes — up to the limit of 5. Don't hardcode
  `screenshot-001.png`. (The website follows the same rule: it embeds them all as a
  slideshow, up to 5; see "Website" below.)
- `promo.png` — **440×280**, the small promo tile (required).
- `marquee.png` — **1400×560**, optional, only needed to be featured.
- Not listing assets: `README.md`, `marquee.xcf` (GIMP source), and `test.png`
  (a byte-identical duplicate of `marquee.png`, not to be uploaded).

Sizes and "PNG or JPEG for the tiles" are from the official docs; the docs name no
format for screenshots, so use opaque PNG or JPEG. Status as of 2026-10-18: all store images are real and opaque (two screenshots, the
promo tile and the marquee). (Check before assuming: the files change underneath this
note.)

## Build system

Plain `Makefile` (`SHELL := /bin/bash`), no npm dependencies (uses Node's built-in
test runner). Needs `yq` (mikefarah, v4) on the PATH: the Makefile reads `VERSION`
with `yq --front-matter=extract '.version' project.md` and stops with a clear error
if that comes back empty. `README.md` is generated by the user's own `p readme`
tool, not by anything in this repo.

- `make` / `make build` — runs tests, regenerates `README.md`, regenerates the PNG
  icons from `assets/identity/icon.svg` (via `inkscape`), and produces
  `dist/unpacked/` (loadable in Chrome via "Load unpacked") plus a zipped
  `dist/watchsooner-<version>.zip`.
- `make test` — unit tests only.
- `make website` — builds the single-page site, `docs/index.html` (see "Website").
- `make release` — builds, then:
  1. `node scripts/draft-release-notes.js <version>` writes
     `dist/release-<version>.txt` prefilled with the CHANGELOG.md `[x]` entries
     logged since the last `[!] **VERSION ... RELEASE**` marker (skips writing if
     that file already exists, so a retry after a failed release keeps your edits).
  2. Opens it in `$EDITOR` (falls back to `vi`) so you can write/adjust the release
     note before it's published — the recipe blocks until you close the editor.
  3. `git tag v<version>`, pushes `HEAD` (the current branch) and the tag, and
     creates a GitHub release with the zip attached via
     `gh release create --target $(git rev-parse HEAD) --notes-file dist/release-<version>.txt`
     — the edited file becomes the GitHub release's notes.

  Bump the version in `project.md` yourself first (there's no auto-bump in this
  Makefile — that's different from the global `p vup` workflow, which is unrelated
  to this repo's own build system).

  The explicit branch push and `--target` aren't optional flourishes: the first
  `make release` run only pushed the tag, never `main` itself, so `origin` had no
  branches at all — just a dangling tag. `gh release create` then failed with
  `HTTP 422: Invalid target_commitish` because GitHub had no default branch to
  resolve the tag against. If you ever see that error again, check
  `git ls-remote --heads origin` — an empty result means the branch was never
  pushed.

  Also: `git tag v<version>` isn't idempotent — if a release attempt fails after
  the tag is created, re-running `make release` for the *same* version will fail at
  `git tag` with "tag already exists". Bump the version again rather than trying to
  reuse/force the old tag.
- `make clean` — removes `dist/`.

### Website (`make website` → `docs/index.html` and `docs/privacy.html`)

`scripts/build-website.sh` (bash; needs `yq`, `pandoc` and, to embed a screenshot,
ImageMagick `convert`) fills `website/template.html`, which was written from the
**Sage Dark Landing** Claude Design system (nav, hero, About band, footer; styles in
`website/bundle.css` and `website/tokens.json`, vendored unchanged from the design,
whose link and version are in `website/README.md`). `docs/` is the GitHub Pages
folder (`project.md`'s `url`).

Where each part of the page comes from:

| page part | source |
|---|---|
| `<title>`, h1, lede, footer name | `title`, `description`, `author` in the frontmatter |
| meta line | `version`, plus `minimum_chrome_version` from `src/manifest.json` |
| About band | the intro prose of `project.md`: the awk-and-pandoc command below |
| screenshots | every `assets/**/screenshot-*.png` by name (max 5), each as WebP under 400 KB |
| "View source", Changelog | `links.support` (GitHub), `…/blob/main/CHANGELOG.md` |
| download button | `links.store` if set ("Add to Chrome"), else `…/releases/latest` ("Download for Chrome") |
| footer link | `links.author` |

The About text is the user's own command, unchanged:
`awk '/^---[ -]*$/ { if (++n == 3) exit; next } n == 2' project.md | pandoc -f markdown -t html -`.
It is everything between the frontmatter and the **first `---` rule** in the body, so
a rule must stay right after the intro (the `---` before `## Features`), and
`mdFrontmatter` and this command both depend on rules being `---`.

Behavior worth knowing:
- **Privacy page.** If `PRIVACY.md` exists, the same run builds `docs/privacy.html`
  from it (pandoc renders the Markdown into `website/privacy-template.html`) and adds a
  "Privacy" link to the index footer; without `PRIVACY.md` there is neither page nor
  link. `PRIVACY.md` keeps a relative `index.html` link back to the site, which works on
  the built page but is broken when viewed on GitHub, where the file is not in `docs/`.
  The privacy page is built first, so a problem in it stops the build before
  `index.html` changes.
- Fails, writing nothing, if `title`, `description`, `version` or `links.support` is
  missing, if there is no intro text, or if a `{{placeholder}}` survives anywhere in
  the page (nothing substitutes them in the intro; write real text there).
- With no screenshot it uses the design's empty slot. Alt text is "Screenshot of
  <title>", numbered "(1 of 2)" when there are several; it is generic, so rewrite it
  if a screenshot needs a specific description.
- **Screenshot slideshow** (the user's request; the design itself says one
  screenshot per page and only 150 ms transitions, so this is a deliberate departure,
  kept to the screenshot frame). Slides are stacked `<img>`s cross-faded (0.6 s
  opacity) every 4 seconds by a small inline script in `website/template.html`. It
  holds still for `prefers-reduced-motion`, while the pointer is over the frame, while
  the frame has keyboard focus, while the full-screen view is open and while the tab
  is hidden. A single screenshot just sits there.
- **Progress line:** a 4px `#ff0033` bar along the bottom of the frame (the user's
  colour; the design reserves red for the rose, so this is another deliberate
  departure) fills left to right over one rotation (`scaleX` from the left) and resets
  as the next screenshot appears. It exists only when there is more than one slide and
  is hidden for `prefers-reduced-motion`. **The line and the slide changes run from one
  `requestAnimationFrame` clock that only counts time while the slideshow is running.**
  Don't replace it with a `setInterval` plus a CSS animation: they drift apart as soon
  as the slideshow pauses (hover, focus, full-screen view), and a test guards this.
  Frame steps are capped at 250 ms so a stalled tab can't jump the line.
- **Full-screen view:** clicking (or Enter/Space on) the frame opens a fixed overlay
  with the current screenshot, contained to the viewport. A click anywhere, the X
  button (upper right) or Escape closes it. Page scroll is locked while it is open.
  This is plain CSS/JS, not the browser Fullscreen API, so it behaves the same on
  phones. The script has no unit tests (no DOM in the test runner); it was checked in
  a real browser. If you change it, re-check rotation, open, and all three closes.
- Fixed copy lives in the template, not `project.md`: the "Cheshire Hall." wordmark
  and rose (the design's brand mark; its reds are the only red the design allows, so
  the extension's own red icon is not used on the page), the "Chrome extension"
  eyebrow, and the "youtube.com" title bar. The favicon reuses the rose.
- The page is one file; its only external request is the Google Fonts stylesheet, as
  the design requires. No `links.store` and no privacy-policy link yet: add
  `links.store` to `project.md` once the extension is listed.

### Store submission documents

- `PRIVACY.md` (root) is the privacy policy; `make website` publishes it as
  `docs/privacy.html`, i.e. `https://evanedwards.github.io/watchsooner/privacy.html`,
  which is the URL the dashboard needs.
- `LISTING.md` (root) is the store listing text and fields.
- `assets/google/Declarations.md` has the dashboard's Privacy-practices answers
  (single purpose, permission justification, remote code, data usage, certifications)
  and the reviewer's test notes.

**These describe what the code does, so they can become wrong.** They were written
against `src/` on 2026-10-18: no storage, no extension APIs, no background script, no
declared permissions, and the only network calls are same-origin requests to
youtube.com, using the `SAPISID` cookie to sign them. If a change adds storage, a
permission, a new host, analytics, or any network call elsewhere, update all three
documents (and bump the date in `PRIVACY.md`) in the same change. The dashboard's
category and certification names in `Declarations.md` are from memory and should be
matched to the dashboard when submitting.

### Manifest fields come from `project.md`

`project.md` is the single source for the store-visible text. The build copies these
frontmatter keys into the manifest (the table lives in `scripts/build-manifest.sh`;
change it there, nowhere else):

| manifest key | project.md key |
|---|---|
| `name` | `name` |
| `short_name` | `titleshort` |
| `description` | `description` |
| `homepage_url` | `url` |
| `version` | `version` |

It fails loudly, writing nothing, if any of these is missing or empty. Same-named
keys map to same-named keys; `title` is **not** used (the manifest `name` is the
project's `name`). There is deliberately no `author`: Chrome has ignored that key
since Feb 2024. Chrome recommends `short_name` of at most 12 characters, and the
manifest `description` is capped at 132 by the store.

### `p readme` and `---` in `project.md`

`p readme` extracts frontmatter with `~/.local/bin/mdFrontmatter` (outside this
repo). It used to grep **every** `---` line and return everything before the last
one, so a `---` horizontal rule in the body of `project.md` made it return body
text; `mapYAML.sh` then `eval`ed that, printed `command not found` errors, and wrote
a `README.md` with the right body under a wrong header (`# watchsooner`,
`version 0.0.0`, no description). It now uses
`yq --front-matter=extract`, and a `---` in the body is safe (verified 2026-10-18:
full README, no errors).

It also only treats a file as having frontmatter if its first line is `---`
(trailing spaces and CRLF are fine), only drops yq's leading `---` marker if it is
really there, and keeps yq's errors off stderr. If a build ever gives `README.md` a
header like the broken one above (`version 0.0.0`, no description), the extractor
failed: check the `command not found` output, and find the cause before committing.

Chrome requires raster icons (no SVG) for the manifest, so the build renders
`icon-16.png` / `icon-48.png` / `icon-128.png` from the SVG source on every build.

## Feature status (see `project.md` for the authoritative list)

- Watched-percent range slider — **done and verified live**. Lives in
  `src/content.js` + `src/feature-filter-percent.js`. Mounted on:
  - the Watch Later / any playlist page (`ytd-playlist-video-list-renderer` /
    `ytd-playlist-video-renderer`)
  - the Playlists panel next to the video player
    (`ytd-playlist-panel-renderer #items` / `ytd-playlist-panel-video-renderer`)

  Thumbs can cross freely; `content.js` sorts the two input values on every change
  so "leftmost to rightmost" always defines the kept range regardless of which
  `<input>` is nominally min/max. Full range (0–100) displays as "Any".
- Playlist panel "Show all" height toggle — **done and verified live**. Lives in
  `src/feature-playlist-height.js`, appended into the same control row as the
  panel's watched-% slider (see `heightToggle: true` on that `TARGETS` entry in
  `content.js`). See "Playlist panel height-toggle scoping" below for how it works
  and a bug that was fixed in it.
- Sort + Save Sort — **done and in use**: the user has run Save Sort on real playlists
  for a few days (reported 2026-10-18) and says it works well; one non-functional
  layout issue is parked until 1.0.0. An assistant session has only verified the read
  paths live.
  See "Playlist sorting and Save Sort" below.
- "Fetch All" preload button — proposed only. Sorting already loads the whole list
  into view itself, so a standalone button is mostly redundant.

## Watched-percent DOM lookup (verified live 2026-09-28)

YouTube's watched-progress bar is **not** reliably `#progress` — that was this
project's original (wrong) assumption and caused every item to read as 0% watched,
so raising the slider's min above 0 hid everything, including fully-watched videos.
Confirmed live on the Watch Later page and the Playlists panel:

- Older markup: an element with `id="progress"` inside
  `ytd-thumbnail-overlay-resume-playback-renderer`.
- Current markup (seen on both surfaces in this session): a newer web-component,
  `ytw-thumbnail-overlay-resume-playback-renderer` (note the `ytw-` prefix, not
  `ytd-`), wrapping a single unlabeled `<div>` with no `id` and an obfuscated/hashed
  class name — only its inline `style.width: NN%` identifies it.
- Items that are 0% watched (never started) don't render this overlay at all, which
  is why `getWatchedPercent` treats "no overlay found" as 0%, not "unknown/show
  anyway".

`feature-filter-percent.js`'s `getWatchedPercent` now checks `#progress` first,
then falls back to scanning `<div>` children of either overlay tag name for one
whose inline width matches `NN%` or `NN.N%`. If YouTube changes this markup again,
re-run the same live-inspection approach (walk `querySelectorAll('*')` recursively
including `.shadowRoot`, looking for tags/divs with percent-based inline widths)
rather than guessing from cached knowledge — this class name/tag has already
changed once.

## Playlist panel height-toggle scoping (verified live 2026-09-28)

YouTube caps the Playlists panel's height via a CSS custom property,
`--ytd-watch-flexy-panel-max-height`, and it's normally *set* on the shared
`ytd-watch-flexy` ancestor that wraps the whole watch page. A first version of the
height toggle overrode that property **on `ytd-watch-flexy` itself** to expand the
panel — which worked for the panel, but also silently changed every other box that
reads the same shared var (ads, related-video boxes, etc.), since CSS custom
properties cascade to all descendants of wherever they're set.

Fix: override the property **on the panel element itself**
(`ytd-playlist-panel-renderer#playlist`, i.e. the `panel` argument already passed
to `applyHeightOverride`), not on `ytd-watch-flexy`. Confirmed live: setting it on
`#playlist` expands only that panel while `ytd-watch-flexy`'s own copy of the var
stays untouched. This also simplified the restore path — the panel doesn't own
that property naturally, so a plain `removeProperty` correctly falls back to
inheriting `ytd-watch-flexy`'s live-managed value, with no need to manually cache
and restore an "original" value (an earlier version tried that and it worked, but
was unnecessary complexity once the fix was scoped correctly).

If a future feature needs to override a YouTube-managed CSS custom property, scope
the override to the narrowest element that actually needs it, not a shared
ancestor — the leak here was subtle precisely because the panel itself looked
correct while other boxes quietly changed size.

## Playlist sorting and Save Sort (built 2026-10-17)

**Two layers.** Choosing a sort is *temporary*: `feature-sort-ui.js` fetches the
whole playlist through the bridge (about 10 requests of 100), ranks it with
`sortItems`, scrolls the page until YouTube has rendered every item (about 35 s for
953 videos), then sets CSS `order` on the list's items. Nothing in YouTube's DOM
moves, and "Manual order" just removes those inline styles. Items are matched to
data by the `index=` and `v=` in each item's watch link; an item whose video id
doesn't match its index goes to the end instead of being misplaced. **Save Sort** is
the permanent layer: it edits the real playlist.

**What was verified live** (read-only, against Watch Later): the InnerTube browse
call and its continuation paging; parsing 953 items with `setVideoId`, channel,
duration, exact watched % (`percentDurationWatched`) and relative publication text;
the item-to-data mapping on both the playlist page and the panel (0 unmatched); every
sort direction; Manual restoring the DOM; the panel's warning; the confirm dialog.

**Writes were never exercised by an assistant session** (they edit real playlists);
the user tested them on their own playlists and reports they work (see Feature
status). The formats came from YouTube's own data: each video's menu carries `playlistEditEndpoint`s, and "Move to
top" is `ACTION_MOVE_VIDEO_AFTER` with only a `setVideoId` (so no predecessor means
top). That is why `buildMoveActions` omits `movedSetVideoIdPredecessor` for the
first position. The assumptions behind them: that several actions
in one `browse/edit_playlist` request apply in order; that `playlist/create` accepts
`videoIds`; and `ACTION_ADD_VIDEO` with `addedVideoId` for appending. If batching
turns out to apply moves out of order, set `MOVE_BATCH_SIZE` to 1. Save Sort always
re-fetches the playlist afterwards and reports the first position that differs from
the intended order, so a wrong assumption shows up as a clear message, not silent
damage.

**Limits and thresholds** (`feature-playlist-sort.js`): 25 edits per request; 100
videos per create/add request; a confirm dialog above 50 moves, offering a sorted
copy only when it needs fewer requests than reordering. Requests are sent one at a
time with a 250 ms gap. A batch rejected with HTTP 400 is split in half and retried.
A reorder is the minimum number of moves (n minus the longest already-in-order run),
and a random-permutation test applies the generated actions to prove the result.

**Locking.** Once any edit has reached YouTube, the page's `index=` positions are
stale, so the sort controls lock and offer a reload. Copies don't lock, because the
original is unchanged.

**Panel limits.** The watch-page panel only ever renders about 200 of the playlist
and scrolling does not load more, so a panel sort covers those and says so. Save
Sort still uses the full playlist from the API, so it is correct from the panel too.

**Things to know.**
- 953 videos came back although the page header says 970: YouTube hides unavailable
  videos ("Unavailable videos are hidden"). Moves only reference visible videos.
- Publication time is approximate (YouTube only shows "6y ago"), ties keep playlist
  order, and videos with no date sort last in either direction.
- The bridge reads the `SAPISID` cookie to sign requests, exactly as youtube.com's own
  code does. Nothing is sent anywhere except youtube.com.
- Dragging videos in YouTube's own list while a sort is on gives confusing results.
- "Subscribed first" and "group by tag/category" were deferred: they need data that
  isn't in the playlist (subscriptions list, per-video category).

## Known gaps / things to verify next session

- The body-wide `MutationObserver` in `content.js` re-runs `mountAll()` on every DOM
  change; it's guarded against duplicate mounts but isn't debounced. Fine for now,
  worth revisiting if it's ever a perf issue.
- No `package.json` exists — intentionally avoided since `node --test` covers
  testing needs without npm dependencies. Add one only if a real dependency becomes
  necessary.
- The `prefers-color-scheme` media query approximates YouTube's dark/light theme but
  isn't the same signal — YouTube's manual in-app theme toggle can diverge from the
  OS/browser color scheme. No live mismatch was seen in testing, but if a user
  reports wrong-theme colors, that's the likely cause.
