# Better Tab Switcher commands. They run on Linux, macOS and WSL, and on Windows with GNU make (see
# .claude/rules/build-and-release.md).
#
#   make setup      install the dependencies (npm ci) and Playwright's Chromium when it is missing
#   make dev        build the development build and open it in Playwright's Chromium with a fresh browser profile;
#                   it rebuilds on every change (close the browser or press Ctrl+C to stop)
#   make lint       check the code's format, lint rules and types
#   make test       run the unit tests (logic and components)
#   make e2e        build the extension and run the end-to-end tests in Chromium;
#                   make e2e category=<name> runs one category, make e2e headed=1 shows the browser
#   make build      create the zip for the stores in .output/, no upload
#   make icons      draw the extension's icons (public/icon/) from assets/icon.svg, after changing it
#
# Releases are not made here: the create_release_pr workflow opens the release pull request, merging it publishes the
# release (publish_release). See build-and-release.md.

.PHONY: setup dev lint test e2e build icons

setup:
	npm ci
	npx playwright install chromium

dev:
	npm run dev

lint:
	npm run lint

test:
	npm test

e2e:
	$(if $(headed),HEADED=1) npm run e2e $(if $(category),-- --grep @$(category))

build:
	npm run zip

icons:
	npm run icons
