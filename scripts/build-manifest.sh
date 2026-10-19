#!/usr/bin/env bash
# Builds the extension manifest: the template (src/manifest.json) with a fixed set
# of fields copied from project.md's YAML frontmatter, so project.md stays the one
# source of truth. Fails if any mapped field is missing or empty, so a typo in
# project.md can't ship a blank field.
#
# Usage: scripts/build-manifest.sh [project.md] [template.json] [output.json]
set -euo pipefail

project=${1:-project.md}
template=${2:-src/manifest.json}
output=${3:-dist/unpacked/manifest.json}

# manifest key : project.md key
mapping=(
  name:name
  short_name:titleshort
  description:description
  homepage_url:url
  version:version
)

die() {
  echo "build-manifest: $*" >&2
  exit 1
}

command -v yq >/dev/null || die "yq is required (https://github.com/mikefarah/yq)"
[[ -f $project ]] || die "no such file: $project"
[[ -f $template ]] || die "no such file: $template"

work=$(mktemp)
trap 'rm -f "$work"' EXIT
cp "$template" "$work"

for pair in "${mapping[@]}"; do
  dest=${pair%%:*}
  src=${pair##*:}
  value=$(yq --front-matter=extract ".${src} // \"\"" "$project")
  [[ -n $value ]] || die "project.md frontmatter has no '${src}' (needed for manifest '${dest}')"
  VALUE=$value yq -p=json -o=json -i ".${dest} = strenv(VALUE)" "$work"
done

mkdir -p "$(dirname "$output")"
mv "$work" "$output"
trap - EXIT
