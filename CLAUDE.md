# watchsooner — project notes

Chrome extension (MV3) that improves YouTube's Watch Later experience. Details and
feature list live in `project.md`; `README.md` is generated from it, don't edit it.

`CHANGELOG.md` entries go newest-first: add new lines at the top of the day's list,
not the bottom.

## Layout

- `src/percent-filter.js` — pure DOM-reading/filter logic (UMD-ish: `module.exports`
  under Node, `window.WatchSoonerFilter` in the browser). Kept dependency-free so it
  loads as a plain `<script>` via manifest `content_scripts`, in this order.
- `src/content.js` — DOM wiring: builds the watched-% range slider, mounts it above
  the Watch Later list and above the Playlists panel, filters items via
  `MutationObserver` + YouTube's `yt-navigate-finish` SPA navigation event.
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
- `test/percent-filter.test.js` — Node's built-in test runner (`node --test`),
  no external test framework/deps. Only the pure logic module is unit tested;
  `content.js`'s DOM wiring is not (see Known gaps).
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
- `make release` — builds, then `git tag v<version>`, pushes the tag, and creates a
  GitHub release with the zip attached via `gh release create`. Bump the version in
  `project.md` yourself first (there's no auto-bump in this Makefile — that's
  different from the global `p vup` workflow, which is unrelated to this repo's own
  build system).
- `make clean` — removes `dist/`.

Chrome requires raster icons (no SVG) for the manifest, so the build renders
`icon-16.png` / `icon-48.png` / `icon-128.png` from the SVG source on every build.

## Feature status (see `project.md` for the authoritative list)

- Watched-percent range slider — **done and verified live** (loaded as an unpacked
  extension and exercised on youtube.com in this session; see below). Lives in
  `src/content.js` + `src/percent-filter.js`. Mounted on:
  - the Watch Later / any playlist page (`ytd-playlist-video-list-renderer` /
    `ytd-playlist-video-renderer`)
  - the Playlists panel next to the video player
    (`ytd-playlist-panel-renderer #items` / `ytd-playlist-panel-video-renderer`)

  Thumbs can cross freely; `content.js` sorts the two input values on every change
  so "leftmost to rightmost" always defines the kept range regardless of which
  `<input>` is nominally min/max. Full range (0–100) displays as "Any".
- Playlist panel `height: auto` toggle — not started (still TODO in `project.md`).
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

`percent-filter.js`'s `getWatchedPercent` now checks `#progress` first, then falls
back to scanning `<div>` children of either overlay tag name for one whose inline
width matches `NN%` or `NN.N%`. If YouTube changes this markup again, re-run the
same live-inspection approach (walk `querySelectorAll('*')` recursively including
`.shadowRoot`, looking for tags/divs with percent-based inline widths) rather than
guessing from cached knowledge — this class name/tag has already changed once.

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
