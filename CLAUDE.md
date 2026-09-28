# watchsooner — project notes

Chrome extension (MV3) that improves YouTube's Watch Later experience. Details and
feature list live in `project.md`; `README.md` is generated from it, don't edit it.

`CHANGELOG.md` entries go newest-first: add new lines at the top of the day's list,
not the bottom.

## Layout

- `src/feature-filter-percent.js` — pure DOM-reading/filter logic for the watched-%
  slider (UMD-ish: `module.exports` under Node, `window.WatchSoonerFilter` in the
  browser). Kept dependency-free so it loads as a plain `<script>`.
- `src/feature-playlist-height.js` — the Playlists panel's "Show all" height toggle
  (same UMD-ish pattern, `window.WatchSoonerHeightToggle`). `applyHeightOverride` is
  pure enough to unit test with mock `style` objects (see
  `test/feature-playlist-height.test.js`); `createHeightToggle` builds the actual
  `<button>` and is DOM-only, like `content.js`.
- `src/content.js` — DOM wiring only: mounts both features' controls above the Watch
  Later list and above the Playlists panel, re-filters items via `MutationObserver`
  + YouTube's `yt-navigate-finish` SPA navigation event. Both feature scripts must
  load before this one (see `src/manifest.json`'s `content_scripts.js` order).
- `src/slider.css` — styling for the injected control (dual-thumb via two overlaid
  native `<input type="range">`, plus a `.watchsooner-filter__range` div positioned
  by `content.js` to show the filled portion between the two thumbs). Uses only its
  own `--wsoon-*` custom properties (set per-theme via `prefers-color-scheme`) —
  never YouTube's `--yt-spec-*` vars. Those turned out to not reliably come from
  YouTube itself: in testing, `--yt-spec-text-primary` was actually being supplied
  by an unrelated installed extension, and vanished when that extension was off.
  Track is a literal `#ccc`, thumbs/fill are YouTube's watched-progress red
  `#ff0033` — both requested as fixed colors, not theme-dependent.
- `src/manifest.json` — MV3 manifest template; `version` is `0.0.0` here and gets
  overwritten at build time from `project.md`'s frontmatter version.
- `test/feature-filter-percent.test.js`, `test/feature-playlist-height.test.js` —
  Node's built-in test runner (`node --test`), no external test framework/deps.
  Only the pure logic in each feature module is unit tested; `content.js`'s DOM
  wiring and `createHeightToggle`'s button creation are not (see Known gaps).
- `scripts/read-project-version.js` — reads `version:` out of `project.md`
  frontmatter for the Makefile.
- `scripts/build-readme.js` — strips `project.md`'s YAML frontmatter, substitutes
  any `{{key}}` / `{{nested.key}}` placeholders in the remaining Markdown with
  values read from that frontmatter (e.g. `{{version}}`, `{{description}}`,
  `{{code.ai.default.id}}`), and writes the result as `README.md`. Has its own tiny
  frontmatter parser (flat + one level of nesting, scalar values only — no lists,
  no npm dependency); a placeholder with no matching key is left as literal text
  and logged as a warning, not silently dropped.

## Build system

Plain `Makefile`, no npm dependencies (uses Node's built-in test runner).

- `make` / `make build` — runs tests, regenerates `README.md`, regenerates the PNG
  icons from `assets/identity/icon.svg` (via `inkscape`), and produces
  `dist/unpacked/` (loadable in Chrome via "Load unpacked") plus a zipped
  `dist/watchsooner-<version>.zip`.
- `make test` — unit tests only.
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
- "Fetch All" preload button — proposed only, not started.

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
