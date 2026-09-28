EXT_NAME := watchsooner
VERSION := $(shell node scripts/read-project-version.js)
DIST := dist
UNPACKED := $(DIST)/unpacked
PACKAGE := $(DIST)/$(EXT_NAME)-$(VERSION).zip

.PHONY: all test build release check-version-bumped readme icons clean

all: test build

test:
	node --test 'test/**/*.test.js'

readme:
	node scripts/build-readme.js

icons:
	mkdir -p assets/identity
	inkscape assets/identity/icon.svg --export-type=png --export-filename=assets/identity/icon-16.png -w 16 -h 16
	inkscape assets/identity/icon.svg --export-type=png --export-filename=assets/identity/icon-48.png -w 48 -h 48
	inkscape assets/identity/icon.svg --export-type=png --export-filename=assets/identity/icon-128.png -w 128 -h 128

build: test readme icons
	rm -rf $(UNPACKED)
	mkdir -p $(UNPACKED)/src $(UNPACKED)/assets/identity
	cp -r src/*.js src/*.css $(UNPACKED)/src/
	cp assets/identity/icon-16.png assets/identity/icon-48.png assets/identity/icon-128.png $(UNPACKED)/assets/identity/
	node -e "const fs=require('node:fs');const m=JSON.parse(fs.readFileSync('src/manifest.json','utf8'));m.version='$(VERSION)';fs.writeFileSync('$(UNPACKED)/manifest.json', JSON.stringify(m, null, 2));"
	mkdir -p $(DIST)
	cd $(UNPACKED) && zip -rq -X ../../$(PACKAGE) .
	@echo "Built $(PACKAGE)"

RELEASE_NOTES := $(DIST)/release-$(VERSION).txt

check-version-bumped:
	@if git rev-parse -q --verify "refs/tags/v$(VERSION)" >/dev/null; then \
		echo "Error: v$(VERSION) has already been released. Increment the version in project.md first." >&2; \
		exit 1; \
	fi

release: check-version-bumped build
	node scripts/draft-release-notes.js $(VERSION)
	$${EDITOR:-vi} $(RELEASE_NOTES)
	git tag v$(VERSION)
	git push origin HEAD
	git push origin v$(VERSION)
	gh release create v$(VERSION) $(PACKAGE) --title "v$(VERSION)" --target $$(git rev-parse HEAD) --notes-file $(RELEASE_NOTES)
	node scripts/changelog-append-release.js $(VERSION)
	@echo "Added a VERSION $(VERSION) RELEASE marker to CHANGELOG.md (not committed)."

clean:
	rm -rf $(DIST)
