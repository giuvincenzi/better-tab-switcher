# Build and release

## Requirements

- **Node.js** with npm, at the version in `.tool-versions` (asdf: `asdf install`).
- **Playwright's Chromium**: installed by `make setup`; `make dev` and the end-to-end tests run in it.
- **Microsoft Edge**, for the end-to-end tests in Edge (`make e2e browser=msedge`).
- **xvfb** on Linux, for the end-to-end tests (`sudo apt install xvfb`).
- **GNU make**: usually already in Linux, macOS and WSL; on Windows `winget install --id ezwinports.make --exact`.
- **GitHub CLI** (`gh`), signed in: pull requests, starting the tests on a branch.

## Commands

- `Makefile`, which runs the npm scripts. Options are make variables, lowercase
  (`make e2e category=<name>`): an option written `--category` would be taken by make itself (GNU make accepts
  abbreviations of its own options).
  - `make setup`: installs the dependencies (`npm ci`) and Playwright's Chromium when it is missing. Run it after
    cloning and whenever `package-lock.json` changes.
  - `make dev`: builds the development build and starts it in Playwright's Chromium with a fresh browser profile
    (`scripts/dev.mjs`); it rebuilds on every change.
  - `make build`: the zip for the stores in `.output/`, for the version in `package.json`. Nothing is uploaded.
  - `make docs serve=1` serves the website preview as the real site (`docs.md`).
  - The other targets are in the `Makefile`.
- Always build after changes and fix all errors and warnings you introduced.

## Dev and prod builds

- **Prod** (`make build`): the zip for the Chrome Web Store and Microsoft Edge Add-ons.
- Development builds are isolated from an installed Better Tab Switcher: they have their own extension ID, so they never
  share its data.

## Secrets

- **The repository is public: never publish secrets anywhere in it**, on any branch, in any commit,
  pull request, issue, comment or workflow log: passwords, tokens, keys, codes or links, personal documents. Secrets go
  only in GitHub's encrypted secrets.
- Before merging a pull request from someone else, check above all what it changes in `scripts/`, `package.json` and
  `.github/workflows/`. Pull requests from forks never get the secrets, and their workflows wait for approval the first
  time a contributor opens one.

## Workflows

GitHub Actions, in `.github/workflows/`. Workflow, job and step names are lowercase with underscores; each says what
it does (the workflow the phase, the job the action). Each workflow declares its own `permissions`; the default token
stays read only (Settings > Actions > General > Workflow permissions).

The ruleset "Protect main" requires the checks `unit_test` and `e2e_test` (`git-workflow.md`): renaming those jobs
needs the ruleset changed in the same moment, or no pull request can be merged.

## Changes between releases

`CHANGELOG.md` starts with `## Unreleased`, split into `### Added`, `### Changed`, `### Fixed`. Every user-visible
change adds its line there, in its own pull request. The version lives only in `package.json` (`version`); the build
writes it into the extension's manifest. A normal pull request never changes it.
