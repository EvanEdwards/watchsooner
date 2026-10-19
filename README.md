
# Watch Sooner

<img src="assets/identity/icon.svg" width="128" align="right"><strong>version 0.2.2</strong>


Filter and browse your YouTube playlists with advanced tools.


## Details


**Watch Sooner** is a small browser helper for anyone who uses YouTube's "Watch Later" list or other playlists as their personal queue. It's built for the reality of a Watch Later list that grows faster than you can clean it out, making it easier to see what's actually in there, skip past videos you've already mostly watched, and browse your list comfortably instead of squinting through a cramped little panel. The goal is simple: help you actually get back to the videos you saved, instead of losing them in an ever-growing pile.

**Privacy:** This is a Chrome Extension that only applies to YouTube.com and is focused on playlists.  We do not collect any information whatsoever and this is open source without ads.

**AI Disclosure:** This is an AI rewrite/maintained version of a handmade extension that was always out of date.  As a free personal tool, I just didn't have enough time to maintain it against Google's updates to the internals of YouTube.  I switched it to Claude and rebuilt it from scratch.  I believe this is a decent use of AI, as keeping it up to date against internal changes is essentially a massive time suck and impossible to justify for a free extension.

## Features

Watch Sooner adds a few tools right above your list, on the playlist page (Watch Later included) and on the Playlists panel next to the video you're watching.  There's nothing to set up.  It's just there when you open a playlist.

- **Filter by how much you've watched.**  A two-handle slider hides everything outside the range you pick.  Slide it down to find the videos you haven't started, or up to find the ones you nearly finished.  The handles can cross, so you never have to think about which is which, and "Any" puts everything back.
- **See the whole panel.**  The "Show all" button stretches the Playlists panel to show every video, and the page scrolls instead of that tiny box.  Click it again to put it back.
- **Sort any playlist.**  Pick a sort and Watch Sooner loads the entire list and reorders it right on the page: by channel, title, duration, how much you've watched, or when it was published.  Publication time is approximate, since YouTube only says "6y ago".  This is a temporary view, so nothing changes in your playlist until you say so.  The panel only keeps about 200 videos handy, so sort from the playlist page when you want all of them.
- **Keep a sort.**  Happy with the order?  "Save Sort" makes it the real order of your playlist, using as few moves as possible, and checks YouTube's result afterward.  Big reorders ask first, and if a sorted copy would be faster, it offers to make one instead.

---

# Build

This uses a simple, old school `Makefile`.  If tests pass, the code is built to `/dist` as a package, plus `/dist/unpacked` as a unpacked directory of code that can be loaded in Chrome for use or testing.  To test the code, then build to a distribution in `/dist` (created if necessary), use:

```
$ make
```

Or to test only:

```
$ make test
```

To build a release, increment the version number in `project.md` and then run:

```
$ make release
```

For a release, if all tests pass, a versioned packed extension is created in `/dist` and the git is tagged with the version number and a release of the packed extension is made on github.

Other things that make will do as part of the build (assuming tests pass):

- Update README.md to contain the Markdown from project.md (omitting the YAML front matter).

## Dependencies

I develop on Linux.  YMMV.

- `make` - runs the build system.
- `node` - runs the tests and build/release scripts (no npm packages required).
- `inkscape` - renders the extension's PNG icons from `assets/identity/icon.svg`.
- `zip` - packages `dist/unpacked` into the distributable `.zip`.
- `git` - tags and pushes releases.
- `gh` - creates the GitHub release (`make release` only).

## Files

- `/src/*.js` - Javascript code.
- `/assets/*/*.svg` - Image assets.
- `/tests/*.js` - Tests.
- `/project.md` - Source for README.md and variables like version number.
- `/Makefile` - The build system

Manifests are created by the build system.
