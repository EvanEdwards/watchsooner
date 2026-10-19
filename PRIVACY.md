# Privacy policy

*Last updated: 2026-10-18*

[← Back to Watch Sooner](index.html)

Watch Sooner is a Chrome extension for YouTube playlists.  The short version: it does its work in your browser, I don't collect anything, and there is nothing to sign up for.  The rest of this page explains exactly what it touches, so you don't have to take my word for it.  The code is open source, so you can check it yourself at <https://github.com/EvanEdwards/watchsooner>.

## What I collect

Nothing.  Watch Sooner has no server, no account, no analytics, no tracking and no ads, and it has no way to send information to me.  I never see your playlists, your watch history or anything else about you.

## What the extension does on your computer

Watch Sooner only runs on `https://www.youtube.com/`.  There it:

- Reads the playlist you are looking at (video titles, channels, lengths, and how much of each you have watched) so it can filter and sort the list on your screen.
- Asks YouTube for your whole playlist when you choose a sort, because YouTube only shows part of a long list at a time.  Those requests go to youtube.com, the same place the page itself talks to, using your signed-in session.
- Reads your YouTube sign-in cookie to sign those requests, exactly as YouTube's own pages do.  The cookie is used only for that, only inside your browser, and is never stored, copied or sent anywhere except back to youtube.com in the signed request.
- Changes your playlists only when you ask it to.  **Save Sort** reorders a playlist, or creates a new private playlist with the sorted videos, when you click it.

Watch Sooner doesn't save anything.  It has no settings or history of its own, and it keeps nothing once you close or reload the page.  It asks for no browser permissions beyond running on youtube.com, and it downloads and runs no code from anywhere else.

## Sharing

None.  I don't have your data, so I can't sell it, share it or give it to anyone, and nothing is used for ads or any other purpose.  Nobody reads it.

## This website

The Watch Sooner web page at <https://evanedwards.github.io/watchsooner/> is hosted on GitHub Pages, so GitHub may keep ordinary server logs of visits.  The page loads its fonts from Google Fonts, which means Google sees your IP address and browser details when it does, as with any site that uses them.  The page sets no cookies and has no analytics or ads.

## Changes

If any of this changes, this page changes first, and the project's changelog will say so: <https://github.com/EvanEdwards/watchsooner/blob/main/CHANGELOG.md>.

## Questions

Open an issue at <https://github.com/EvanEdwards/watchsooner/issues>.

Watch Sooner is an independent project, not affiliated with or endorsed by YouTube or Google.
