# Better Tab Switcher commands. They run on Linux, macOS and WSL, and on Windows with GNU make (see
# .claude/rules/build-and-release.md).
#
#   make setup      install the dependencies (npm ci) and Playwright's Chromium when it is missing
#   make dev        build the development build and open it in Playwright's Chromium with a fresh browser profile;
#                   it rebuilds on every change (close the browser or press Ctrl+C to stop)
#                   make dev tabs=N also opens N tabs of real sites (1 to 100), to try the switcher
#   make lint       check the code's format, lint rules and types
#   make test       run the unit tests (logic and components)
#   make e2e        build the extension and run the end-to-end tests in Playwright's Chromium (on Linux on a virtual
#                   screen, xvfb-run);
#                   make e2e category=<name> runs one category, make e2e headed=1 shows the browser,
#                   make e2e browser=msedge runs them in Microsoft Edge (installed on the PC)
#   make build      create the zip for the stores in .output/, no upload
#   make icons      draw the extension's icons (public/icon/) from assets/icon.svg, after changing it
#   make docs       build the website preview in site-preview/ (the guide of the current code as version "next");
#                   make docs serve=1 builds it and serves it at http://localhost:8080/, so links work as on the site
#                   (make docs serve=1 port=<n> serves it on another port)
#   make visual     turn a board of the Design canvas into a picture of the website:
#                   make visual board=<board.dc.html> name=<scene> writes site/visuals/<scene>.html (docs.md)
#   make third-party  check that third-party.json lists exactly the packages built into the extension (docs.md)
#   make store-listing  write what the stores' dashboards ask for (descriptions, pictures, Privacy answers) in
#                     .output/store-listing/ (discoverability.md)
#
# Releases are not made here: the create_release_pr workflow opens the release pull request, merging it publishes the
# release (publish_release). See build-and-release.md.

.PHONY: setup dev lint test e2e build icons docs visual third-party store-listing

setup:
	npm ci
	npx playwright install chromium

dev:
	npm run dev $(if $(tabs),-- --tabs=$(tabs))

lint:
	npm run lint

test:
	npm test

# On Linux the tests that use the desktop (tests/e2e/system.ts) need an X11 one of their own, as on GitHub: a virtual
# screen (xvfb-run, from the xvfb package). Not with headed=1, which shows the browser on the PC's own screen.
XVFB := $(if $(filter Linux,$(shell uname -s)),$(if $(headed),,xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24"))

e2e:
	$(if $(XVFB),@command -v xvfb-run > /dev/null || { echo "The end-to-end tests need xvfb-run on Linux: sudo apt install xvfb"; exit 1; })
	$(if $(headed),HEADED=1) $(if $(browser),E2E_BROWSER=$(browser)) $(XVFB) npm run e2e $(if $(category),-- --grep @$(category))

build:
	npm run zip

icons:
	npm run icons

docs:
	$(if $(port),PORT=$(port)) node scripts/$(if $(serve),site-serve.mjs,site.mjs --preview)

visual:
	node scripts/board-to-visual.mjs "$(board)" "$(name)"

third-party:
	npm run third-party

store-listing:
	node scripts/store-listing.mjs
