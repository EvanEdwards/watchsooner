#!/usr/bin/env bash
# Builds the single-page website (docs/index.html) from website/template.html.
#
# Page text comes from project.md: the frontmatter (title, description, version,
# links.support, optional links.store / links.author, author) and the intro prose
# between the frontmatter and the first `---` rule in the body, rendered by pandoc.
# The first assets/**/screenshot-*.png is embedded as WebP; styles are the
# "Sage Dark Landing" design (website/bundle.css + website/tokens.json). The result
# is one self-contained file apart from the Google Fonts stylesheet link.
#
# Usage: scripts/build-website.sh [project.md] [output.html]
# Env overrides (used by the tests): WEBSITE_DIR, ASSETS_DIR, MANIFEST
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project=${1:-$root/project.md}
output=${2:-$root/docs/index.html}
site=${WEBSITE_DIR:-$root/website}
assets=${ASSETS_DIR:-$root/assets}
manifest=${MANIFEST:-$root/src/manifest.json}

MAX_SCREENSHOT_BYTES=$((400 * 1024))

die() {
  echo "build-website: $*" >&2
  exit 1
}

for tool in yq pandoc awk base64 find sort; do
  command -v "$tool" >/dev/null || die "$tool is required"
done
for file in "$project" "$site/template.html" "$site/bundle.css" "$site/tokens.json" "$manifest"; do
  [[ -f $file ]] || die "no such file: $file"
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# -o=tsv prints scalars bare: plain output would quote a numeric-looking string like "111".
fm() { yq --front-matter=extract -o=tsv "$1 // \"\"" "$project"; }
html_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'; }
# put NAME VALUE: stores a value for the @@NAME@@ placeholder.
put() { printf '%s' "$2" >"$work/$1"; }
put_escaped() { printf '%s' "$2" | html_escape >"$work/$1"; }

required() {
  local value
  value=$(fm "$1")
  [[ -n $value ]] || die "project.md frontmatter has no '${1#.}'"
  printf '%s' "$value"
}

title=$(required .title)
description=$(required .description)
version=$(required .version)
support=$(required .links.support)
support=${support%/}
author=$(fm .author)
author_url=$(fm .links.author)
store=$(fm .links.store)
min_chrome=$(yq -o=tsv '.minimum_chrome_version // ""' "$manifest")

put_escaped TITLE "$title"
put_escaped DESCRIPTION "$description"
put_escaped AUTHOR "${author:-$title}"
put_escaped CHANGELOG_URL "$support/blob/main/CHANGELOG.md"
put_escaped SOURCE_URL "$support"

# Download button: the store listing once there is one, else the latest GitHub release.
if [[ -n $store ]]; then
  put_escaped DOWNLOAD_URL "$store"
  put DOWNLOAD_LABEL "Add to Chrome"
  put DOWNLOAD_ICON ""
else
  put_escaped DOWNLOAD_URL "$support/releases/latest"
  put DOWNLOAD_LABEL "Download for Chrome"
  put DOWNLOAD_ICON '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v10M5.5 9 10 13.5 14.5 9M4 17h12"/></svg>'
fi

meta="Version $version"
[[ -n $min_chrome ]] && meta+=" · Chrome $min_chrome or later"
meta+=" · Free and open source"
put_escaped META "$meta"

if [[ -n $author_url ]]; then
  host=${author_url#*://}
  host=${host%%/*}
  link=$(printf '<a class="sd-link" href="%s">%s</a>' "$(printf '%s' "$author_url" | html_escape)" "$(printf '%s' "$host" | html_escape)")
  put AUTHOR_LINK "$link"
else
  put AUTHOR_LINK ""
fi

# About: the intro prose of project.md, between the frontmatter and the first body rule.
about=$(awk '/^---[ -]*$/ { if (++n == 3) exit; next } n == 2' "$project" | pandoc -f markdown -t html -)
[[ -n $about ]] || die "project.md has no intro text between the frontmatter and the first '---' rule"
put ABOUT "$about"

# Styles: the design's tokens (generated from tokens.json), then its components.
{
  echo ':root{'
  yq -o=tsv '.color.tokens[] | "  --" + .name + ": " + .value + ";"' "$site/tokens.json"
  for family in spacing radius shadow; do
    yq -o=tsv ".${family}.tokens[] | \"  --\" + .name + \": \" + .value + \";\"" "$site/tokens.json"
  done
  yq -o=tsv '.type.families | to_entries | .[] | "  --font-" + .key + ": " + .value + ";"' "$site/tokens.json"
  echo '}'
  yq -o=tsv '.type.groups[] as $g | $g.styles[] | "." + .name + "{font-family:var(--font-" + $g.family + ");font-size:" + .fontSize + ";line-height:" + .lineHeight + ";font-weight:" + (.fontWeight | tostring) + ";" + ((.letterSpacing | select(.) | "letter-spacing:" + . + ";") // "") + "}"' "$site/tokens.json"
  cat "$site/bundle.css"
} >"$work/CSS"

# The favicon reuses the design's rose, already embedded in bundle.css.
favicon=$(sed -n 's/^\.sd-rose{.*url("\(data:[^"]*\)").*/\1/p' "$site/bundle.css" | head -n 1)
[[ -n $favicon ]] || die "could not find the .sd-rose data URI in $site/bundle.css"
put FAVICON "$favicon"

# Screenshot: the first assets/**/screenshot-*.png, as WebP under 400 KB. The design
# shows exactly one screenshot per page; with none yet, its empty slot is used.
shot=$(find "$assets" -type f -name 'screenshot-*.png' 2>/dev/null | LC_ALL=C sort | head -n 1)
if [[ -n $shot ]]; then
  command -v convert >/dev/null || die "ImageMagick (convert) is required to embed $shot"
  for quality in 90 85 80 75 70 60 50; do
    convert "$shot" -resize '1600x1000>' -strip -quality "$quality" "webp:$work/shot.webp"
    (($(wc -c <"$work/shot.webp") <= MAX_SCREENSHOT_BYTES)) && break
  done
  (($(wc -c <"$work/shot.webp") <= MAX_SCREENSHOT_BYTES)) || die "$shot is still over 400 KB as WebP at quality 50"
  size=$(convert "$work/shot.webp" -format '%wx%h' info:)
  alt=$(printf 'Screenshot of %s' "$title" | html_escape)
  put SCREENSHOT "<img class=\"sd-shot__img\" src=\"data:image/webp;base64,$(base64 -w0 "$work/shot.webp")\" alt=\"$alt\" width=\"${size%x*}\" height=\"${size#*x}\">"
else
  put SCREENSHOT '<div class="sd-shot__empty caption">Screenshot slot · 1600 × 1000</div>'
fi

# Fill the template. awk (not sed or ${//}) so values containing & or \ are inserted
# literally, and so a few hundred KB of CSS and image data never goes through argv.
filled="$work/index.html"
awk -v dir="$work" '
  function load(name,   path, line, out, first) {
    if (name in cache) return cache[name]
    path = dir "/" name
    out = ""; first = 1
    while ((r = (getline line < path)) > 0) { out = out (first ? "" : "\n") line; first = 0 }
    if (r < 0) { print "build-website: template uses @@" name "@@ but nothing provides it" > "/dev/stderr"; exit 2 }
    close(path)
    cache[name] = out
    return out
  }
  {
    line = $0; result = ""
    while (match(line, /@@[A-Z_]+@@/)) {
      result = result substr(line, 1, RSTART - 1) load(substr(line, RSTART + 2, RLENGTH - 4))
      line = substr(line, RSTART + RLENGTH)
    }
    print result line
  }
' "$site/template.html" >"$filled" || die "could not fill the template"

if grep -q '{{' "$filled"; then
  die "unresolved {{placeholder}} in the page (project.md text or the template): $(grep -o '{{[^}]*}}' "$filled" | sort -u | tr '\n' ' ')"
fi

mkdir -p "$(dirname "$output")"
mv "$filled" "$output"
echo "Built $output ($(wc -c <"$output") bytes)"
