#!/usr/bin/env bash
# Builds the website: docs/index.html from website/template.html and, when PRIVACY.md
# exists, docs/privacy.html (next to the index) from website/privacy-template.html.
#
# Page text comes from project.md: the frontmatter (title, description, version,
# links.support, optional links.store / links.author, author) and the intro prose
# between the frontmatter and the first `---` rule in the body, rendered by pandoc.
# The assets/**/screenshot-*.png files (up to 5) are embedded as WebP slides; styles are the
# "Sage Dark Landing" design (website/bundle.css + website/tokens.json). The result
# is one self-contained file apart from the Google Fonts stylesheet link.
#
# The privacy page is the Markdown body of PRIVACY.md rendered by pandoc; the index
# footer links to it only when PRIVACY.md exists.
#
# Usage: scripts/build-website.sh [project.md] [index-output.html]
# Env overrides (used by the tests): WEBSITE_DIR, ASSETS_DIR, MANIFEST, PRIVACY_MD
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project=${1:-$root/project.md}
output=${2:-$root/docs/index.html}
site=${WEBSITE_DIR:-$root/website}
assets=${ASSETS_DIR:-$root/assets}
manifest=${MANIFEST:-$root/src/manifest.json}
privacy_md=${PRIVACY_MD:-$root/PRIVACY.md}
privacy_output=$(dirname "$output")/privacy.html

MAX_SCREENSHOT_BYTES=$((400 * 1024))
MAX_SCREENSHOTS=5

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

# The Privacy footer link exists only when there is a policy to link to.
if [[ -f $privacy_md ]]; then
  put PRIVACY_LINK '<a class="sd-link" href="privacy.html">Privacy</a>'
else
  put PRIVACY_LINK ""
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

# Screenshots: every assets/**/screenshot-*.png in name order (the Web Store takes at
# most 5, so the page does too), each as WebP under 400 KB. They are stacked slides that
# the page's script rotates and cross-fades; one screenshot just sits there. With none
# yet, the design's empty slot is used.
mapfile -t shots < <(find "$assets" -type f -name 'screenshot-*.png' 2>/dev/null | LC_ALL=C sort | head -n "$MAX_SCREENSHOTS")
if ((${#shots[@]} > 0)); then
  command -v convert >/dev/null || die "ImageMagick (convert) is required to embed screenshots"
  slides=""
  for i in "${!shots[@]}"; do
    shot=${shots[i]}
    for quality in 90 85 80 75 70 60 50; do
      convert "$shot" -resize '1600x1000>' -background '#232b27' -alpha remove -alpha off -strip -quality "$quality" "webp:$work/shot.webp"
      (($(wc -c <"$work/shot.webp") <= MAX_SCREENSHOT_BYTES)) && break
    done
    (($(wc -c <"$work/shot.webp") <= MAX_SCREENSHOT_BYTES)) || die "$shot is still over 400 KB as WebP at quality 50"
    size=$(convert "$work/shot.webp" -format '%wx%h' info:)
    if ((${#shots[@]} == 1)); then
      alt=$(printf 'Screenshot of %s' "$title" | html_escape)
    else
      alt=$(printf 'Screenshot of %s (%d of %d)' "$title" "$((i + 1))" "${#shots[@]}" | html_escape)
    fi
    if ((i == 0)); then state=" is-active"; hidden=""; else state=""; hidden=' aria-hidden="true"'; fi
    slides+="<img class=\"sd-shot__img sd-shot__slide${state}\"${hidden} src=\"data:image/webp;base64,$(base64 -w0 "$work/shot.webp")\" alt=\"$alt\" width=\"${size%x*}\" height=\"${size#*x}\">"$'\n'
  done
  put SCREENSHOT "${slides%$'\n'}"
else
  put SCREENSHOT '<div class="sd-shot__empty caption">Screenshot slot · 1600 × 1000</div>'
fi

# fill_template TEMPLATE OUTPUT: fills every @@NAME@@ in TEMPLATE from $work/NAME. awk (not
# sed or ${//}) so values containing & or \ are inserted literally, and so a few hundred KB
# of CSS and image data never goes through argv. Nothing is written if anything is wrong.
fill_template() {
  local template=$1 out=$2 filled
  filled=$(mktemp "$work/page.XXXXXX")
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
  ' "$template" >"$filled" || die "could not fill $template"

  if grep -q '{{' "$filled"; then
    die "unresolved {{placeholder}} in $(basename "$out") (its Markdown or the template): $(grep -o '{{[^}]*}}' "$filled" | sort -u | tr '\n' ' ')"
  fi

  chmod 644 "$filled"
  mkdir -p "$(dirname "$out")"
  mv "$filled" "$out"
  echo "Built $out ($(wc -c <"$out") bytes)"
}

# Build the privacy page first, so a problem with it stops the build before index.html changes.
if [[ -f $privacy_md ]]; then
  [[ -f $site/privacy-template.html ]] || die "no such file: $site/privacy-template.html"
  privacy=$(pandoc -f markdown -t html "$privacy_md")
  [[ -n $privacy ]] || die "$privacy_md has no text"
  put PRIVACY "$privacy"
  fill_template "$site/privacy-template.html" "$privacy_output"
fi

fill_template "$site/template.html" "$output"
