# Architecture

## Stack

- TypeScript in strict mode.
- WXT (on Vite) builds the extension: the manifest, the development build and the zips for the stores.
- Preact for the switcher and the settings page, with the extension's component library (`ui.md`).
- Biome for lint and format.
- npm, with the lockfile committed.
- **A new npm package needs the user's approval.**

## Repository layout

```
scripts/                        scripts run by the Makefile
.github/workflows/              workflows (build-and-release.md)
site/                           website and user guide sources (docs.md)
tests/unit/                     unit tests;  tests/e2e/  end-to-end tests (testing.md)
_locales/                       texts and translations (i18n.md)
```
