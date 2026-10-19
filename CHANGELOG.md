

# 2026

## 2026-10

- [!] #Commit 0.2.1: Getting release ready ✅ 2026-10-18
- [x] Added tests for the website builder (59 tests total) ✅ 2026-10-18
- [x] Added scripts/build-website.sh (bash) and website/: template plus the design's CSS and tokens ✅ 2026-10-18
- [x] `make website` builds docs/index.html from project.md and assets/** in the Sage Dark Landing design ✅ 2026-10-18
- [x] Manifest name, short_name, description, homepage_url and version now come from project.md via yq ✅ 2026-10-18
- [x] Added scripts/build-manifest.sh (bash) with tests; removed the unused Node version and README scripts ✅ 2026-10-18
- [x] Dropped the manifest "author" key, which Chrome has ignored since Feb 2024 ✅ 2026-10-18
- [x] Documented the Web Store images in assets/google/; added "Create screenshots" as a CRITICAL TODO ✅ 2026-10-18
- [x] Added unit tests for sorting, move planning and response parsing (40 tests total) ✅ 2026-10-17
- [x] Sort dropdown: channel, title, duration, watched %, publication time; under ⋮ in the panel ✅ 2026-10-17
- [x] Sorting loads the whole list first; the panel warns when it can only sort the videos it holds ✅ 2026-10-17
- [x] Save Sort: reorders the real playlist with the fewest moves, in batches, then verifies the result ✅ 2026-10-17
- [x] Save Sort asks first above 50 moves, and offers a sorted copy when that takes fewer requests ✅ 2026-10-17
- [x] Added a page-world bridge (src/page-bridge.js) that reads and edits playlists as the signed-in user ✅ 2026-10-17

## 2026-09

- [!] #Commit 0.2.0: Github public stuff ✅ 2026-09-28
- [!] **VERSION 0.2.0 RELEASE** ✅ 2026-09-28
- [x] Renamed percent-filter.js to feature-filter-percent.js; added feature-playlist-height.js ✅ 2026-09-28
- [x] Fixed height-toggle leak: scope the max-height override to #playlist, not all of ytd-watch-flexy ✅ 2026-09-28
- [x] Added a "Show all" toggle that expands the Playlists panel to its full height ✅ 2026-09-28
- [!] **VERSION 0.1.1 RELEASE**  ✅ 2026-09-28
- [x] `make release` now opens an editor on dist/release-<version>.txt, prefilled from CHANGELOG.md ✅ 2026-09-28
- [x] Fixed `make release`: push the branch itself, not just the tag, and pass an explicit --target to gh ✅ 2026-09-28
- [!] **VERSION 0.1.0 RELEASE** ✅ 2026-09-28
- [x] README.md generator now substitutes {{key}}/{{nested.key}} placeholders from project.md frontmatter ✅ 2026-09-28
- [!] **VERSION 0.0.2 RELEASE**  ✅ 2026-09-28
- [x] Removed dependency on another extension's --yt-spec-* CSS vars; added --wsoon-* theme vars ✅ 2026-09-28
- [x] Changed the full-range label from "0-100%" to "Any" ✅ 2026-09-28
- [x] Restyled slider red (#ff0033) on a #ccc track, matching YouTube's watched-progress color ✅ 2026-09-28
- [x] Added a visible track and filled range bar so the dual slider is usable ✅ 2026-09-28
- [x] Fixed watched-% detection: YouTube's progress bar moved to ytw- overlay, not #progress ✅ 2026-09-28
- [x] Marked the watched-percent range slider TODO as done in project.md ✅ 2026-09-28
- [x] Verified `make` builds a packed extension in dist/ with all tests passing ✅ 2026-09-28
- [x] Added range-slider content script filtering Watch Later and the Playlists panel ✅ 2026-09-28
- [x] Added watched-percent extraction/filter logic with unit tests (src/percent-filter.js) ✅ 2026-09-28
- [x] Added extension manifest and PNG icon generation from the SVG source ✅ 2026-09-28
- [x] Added README.md generator that strips project.md frontmatter ✅ 2026-09-28
- [x] Added Makefile build system: test, readme, icons, build, release, clean targets ✅ 2026-09-28
- [x] Wrote a friendly, non-technical project summary in project.md ✅ 2026-09-28
- [!] #Commit 0.0.0: Code project initialized ✅ 2026-09-28
- [x] Changelog initiated ✅ 2026-09-28
