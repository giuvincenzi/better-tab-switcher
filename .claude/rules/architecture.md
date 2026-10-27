# Architecture

## Stack

- TypeScript in strict mode.
- WXT (on Vite) builds the extension: the manifest, the development build and the zips for the stores.
- Solid for the switcher and the settings page (`@wxt-dev/module-solid`), with the extension's component library (`ui.md`).
- WXT's own parts where it has one: `@wxt-dev/i18n` for the texts (`i18n.md`), WXT's storage for the saved data
  (`data.md`), `WxtVitest` for the unit tests (`testing.md`), `wxt submit` to publish (`build-and-release.md`).
- No auto-imports: every module is imported by name.
- Biome for lint and format.
- npm, with the lockfile committed.
- **A new npm package needs the user's approval.**

## Repository layout

```
scripts/                        scripts run by the Makefile
.github/workflows/              workflows (build-and-release.md)
site/                           website and user guide sources (docs.md)
tests/unit/                     unit tests;  tests/e2e/  end-to-end tests (testing.md)
locales/                        texts and translations (i18n.md)
```
