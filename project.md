---
version: 0.2.0
name: Watch Sooner
type: code
description: Chrome Extension for Youtube Playlists
author: Evan Edwards
category: uncategorized
code:
  ai:
    default:
      id: b539d83c-ac9b-5e5f-a6b2-18b2bdabd4d1
---

# {{name}}

{{description}} <img src="assets/identity/icon.svg" width="128" align="right"><strong>version {{version}}</strong>

**Watch Sooner** is a small browser helper for anyone who uses YouTube's "Watch Later" list or other playlists as their personal queue. It's built for the reality of a Watch Later list that grows faster than you can clean it out, making it easier to see what's actually in there, skip past videos you've already mostly watched, and browse your list comfortably instead of squinting through a cramped little panel. The goal is simple: help you actually get back to the videos you saved, instead of losing them in an ever-growing pile.

This is a Chrome Extension that only applies to Youtube.com and is focused on playlists.  We do not collect any information whatsoever and this is open source without ads.

AI Disclosure: This is an AI rewrite/maintained version of a handmade extension that was always out of date.  As a free personal tool, I just didn't have enough time to maintain it against Google's updates to the internals of Youtube.  I switched it to Claude and rebuilt it from scratch.  I believe this is a decent use of AI, as keeping it up to date against internal changes is essentially a massive time suck and impossible to justify for a free extension.

Visit the project at: https://github.com/EvanEdwards/watchsooner


## Features

Features noted TODO are not done yet, and will be done when TODO is removed.  Features with PROPOSED will be done later.


Features that modify the Playlist view and Playlists panel when watching videos.

- A range slider filters the videos by percentage watched, hiding videos outside the chosen watched-percent range.

Features that only modify the Playlist panel when watching videos.

- A "Show all" toggle button that expands the playlist panel to `height: auto` so it shows all videos in the list, scrolling the page rather than the tiny scroll within the panel itself.

Features that only modify the playlist view: 

- (PROPOSED) A "Fetch All" button that preloads the list so it can be scrolled through and searched.


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



## Files

- `/src/*.js` - Javascript code.
- `/assets/*/*.svg` - Image assets.
- `/tests/*.js` - Tests.
- `/project.md` - Source for README.md and variables like version number.
- `/Makefile` - The build system

Manifests are created by the build system.
