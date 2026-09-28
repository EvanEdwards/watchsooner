

# 2026

## 2026-09

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
