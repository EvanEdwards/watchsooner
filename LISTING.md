# Chrome Web Store listing

Text for the store listing: copy each field into the dashboard as written.  The
privacy questions are in `assets/google/Declarations.md`.  `project.md` stays the
source for the name and short description, so if those change there, change them here.

## Name

The dashboard takes this from the uploaded package (the manifest `name`, which comes
from `project.md`'s `name`).  It is **Watch Sooner**, and so is the short name.

## Summary

The dashboard takes this from the manifest `description` (the store allows 132
characters; this is 61):

```
Filter and browse your YouTube playlists with advanced tools.
```

## Description

Plain text only: the store shows no Markdown or HTML, but it keeps line breaks.

```
Watch Sooner makes a long playlist easier to live with.

If your Watch Later list grows faster than you can clean it out, Watch Sooner puts a few simple tools right above it. They appear on the playlist page and on the Playlists panel next to the video you're watching. There's nothing to set up.

WHAT YOU GET

• Filter by how much you've watched. A two-handle slider hides everything outside the range you pick. Slide it down to find the videos you haven't started, or up to find the ones you nearly finished. The handles can cross, so you never have to think about which is which, and "Any" puts everything back.

• See the whole panel. The "Show all" button stretches the Playlists panel to show every video, and the page scrolls instead of that tiny box. Click it again to put it back.

• Sort any playlist. Pick a sort and Watch Sooner loads the entire list and reorders it right on the page: by channel, title, duration, how much you've watched, or when it was published. This is a temporary view, so nothing changes in your playlist until you say so.

• Keep a sort. Happy with the order? "Save Sort" makes it the real order of your playlist, using as few moves as possible, and checks the result afterward. Big reorders ask first, and if a sorted copy would be faster, it offers to make one instead.

FREE, PRIVATE AND OPEN SOURCE

Watch Sooner collects nothing: no account, no analytics, no ads and no servers. It only runs on youtube.com and asks for no browser permissions beyond that. The full privacy policy is at https://evanedwards.github.io/watchsooner/privacy.html and the source code is at https://github.com/EvanEdwards/watchsooner

GOOD TO KNOW

• Sorting by publication time is approximate, because the site only shows "6y ago" and not an exact date.
• The Playlists panel only keeps about 200 videos loaded, so sort from the playlist page when you want a whole long list.
• "Save Sort" changes your real playlist, so try it on a small one first if you're cautious.

Watch Sooner is an independent project and is not affiliated with or endorsed by YouTube or Google. YouTube is a trademark of Google LLC.
```

## Fields to set

| Field | Value |
| --- | --- |
| Category | Productivity (check the dashboard's list for the exact name) |
| Language | English |
| Price | Free |
| Official URL / homepage | `https://evanedwards.github.io/watchsooner/` (already in the manifest as `homepage_url`) |
| Support URL | `https://github.com/EvanEdwards/watchsooner/issues` |
| Privacy policy URL | `https://evanedwards.github.io/watchsooner/privacy.html` |
| Store icon | the 128 px icon inside the package (no separate upload) |
| Screenshots | every `assets/google/screenshot-*.png` (1280×800), up to 5 |
| Small promo tile | `assets/google/promo.png` (440×280, required) |
| Marquee promo tile | `assets/google/marquee.png` (1400×560, optional) |
