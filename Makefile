# Better Tab Switcher commands. They run on Linux, macOS and WSL, and on Windows with GNU make (see
# .claude/rules/build-and-release.md).
#
#   make setup      install the dependencies (npm ci) and Playwright's Chromium when it is missing
#   make dev        build the development build and open it in Playwright's Chromium with a fresh browser profile;
#                   it rebuilds on every change (close the browser or press Ctrl+C to stop)
#   make build      create the zip for the stores in .output/, no upload
#
# Releases are not made here: the create_release_pr workflow opens the release pull request, merging it publishes the
# release (publish_release). See build-and-release.md.

.PHONY: setup dev build

setup:
	npm ci
	npx playwright install chromium

dev:
	npm run dev

build:
	npm run zip
