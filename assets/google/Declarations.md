# Chrome Web Store declarations

Notes: 
- The listing text is in `LISTING.md`. The privacy policy is `PRIVACY.md`, published at `https://evanedwards.github.io/watchsooner/privacy.html`.


## Single purpose

```
Watch Sooner helps you browse and organize YouTube playlists. It adds tools above a playlist, and above the Playlists panel next to a video, to filter videos by how much you have watched, expand the panel to show every video, and sort the list (temporarily, or saved to the playlist).
```

## Permission justification

The manifest declares **no `permissions` and no `host_permissions`**. The only access is the content-script match `https://www.youtube.com/*`.

**Access to `https://www.youtube.com/*` (content scripts):**

```
Watch Sooner adds its controls to YouTube playlist pages and to the Playlists panel beside a video, reads the on-screen list so it can be filtered and sorted, and, when you choose a sort or click Save Sort, calls YouTube's own playlist API from the page using your signed-in session. It needs no other site and no other permission.
```

**One content script runs in the page's own JavaScript world (`"world": "MAIN"`):**

```
That script (src/page-bridge.js) needs to read YouTube's page configuration (window.ytcfg) to build the same requests youtube.com's own code makes, and a normal isolated content script cannot read it. It talks only to youtube.com, and only to read a playlist or, when the user clicks Save Sort, to reorder one or create a new private one.

All operations use the user's account strictly for the user's YouTube data without ever sending anything elsewhere.  Changes to data is limited to operations the user could do manually with sufficient time.
```

## Remote code

Choose **No, I am not using remote code.**

```
All JavaScript and CSS ships inside the package. The extension loads and runs no code from any other source, and uses no eval or dynamically fetched scripts.
```

## Data usage

Tick these two boxes (the extension *handles* them in the user's browser; it does not
send them anywhere except back to youtube.com):

| Data type | Why it is ticked |
| --- | --- |
| Authentication information | It reads the YouTube sign-in cookie (`SAPISID`) in the page to sign its requests to youtube.com, the same way youtube.com's own pages do. The cookie is never stored, copied or sent anywhere else. |
| Website content | It reads the playlist on the page (titles, channels, lengths, watch progress) to filter and sort it. |

Leave every other type **unticked**: personally identifiable information, health
information, financial and payment information, personal communications, location, web
history, and user activity. The extension does not log clicks, keystrokes or browsing.

## Certifications

Tick all three of the dashboard's statements. They are true as built:

- The data is not sold or transferred to third parties outside the approved use cases.
- The data is not used or transferred for purposes unrelated to the single purpose.
- The data is not used or transferred to determine creditworthiness or for lending.

## Privacy policy

```
https://evanedwards.github.io/watchsooner/privacy.html
```


## Notes for the reviewer (test instructions)

```
Watch Sooner only runs on https://www.youtube.com/. To see it, sign in to YouTube and open a playlist page (for example https://www.youtube.com/playlist?list=WL, Watch Later) or watch any video from a playlist. The controls appear above the list: a "Watched %" slider, and, behind the three-dot button on the Playlists panel (or in its own row on the playlist page), a sort menu. No account or credentials are needed beyond a normal YouTube login, and none are required by the extension itself.

Choosing a sort only changes the order on screen. "Save Sort" is the only action that changes data: it reorders that playlist or creates a new private playlist, and only when clicked. The extension collects nothing; the only network requests are same-origin requests to youtube.com.
```

## Account-level fields (not part of the package)

Set when registering the developer account, not on the Privacy tab:

- Publisher name and a verified contact email (shown publicly under the extension).
- The EU trader / non-trader declaration, if the dashboard asks for it.
- Distribution: public, free, all regions (or narrow them if you prefer).
