Inputs to `make website` (see `scripts/build-website.sh`), which writes `docs/index.html`.

- `template.html` — the page, written for this project from the LandingPage, Hero and
  ScreenshotFrame components of the **Sage Dark Landing** design. Edit this freely.
- `bundle.css` and `tokens.json` — copied unchanged from that design
  (<https://claude.ai/artifact/VWbeByW4tV2oYLWaiTA7aZ>, version `1792355856-54dd`:
  `project/components/bundle.css` and `project/tokens.json`). Don't hand-edit them;
  to update, re-read both from the design and overwrite. The build turns
  `tokens.json` into the CSS variables and type classes the stylesheet expects, since
  the design generates that part itself.
