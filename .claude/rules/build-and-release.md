# Build and release

## Requirements

- **Node.js** with npm, at the version in `.tool-versions` (asdf: `asdf install`).
- **Playwright's Chromium**: installed by `make setup`; `make dev` and the end-to-end tests run in it.
- **Microsoft Edge**, for the end-to-end tests in Edge (`make e2e browser=msedge`).
- **xvfb** on Linux, for the end-to-end tests (`sudo apt install xvfb`).
- **GNU make**: usually already in Linux, macOS and WSL; on Windows `winget install --id ezwinports.make --exact`.
- **GitHub CLI** (`gh`), signed in: pull requests, starting the tests on a branch, the release pull request.

## Commands

- The `Makefile` runs the npm scripts; its targets are described at its top. Options are make variables, lowercase
  (`make e2e category=<name>`): an option written `--category` would be taken by make itself (GNU make accepts
  abbreviations of its own options).
- Run `make setup` after cloning and whenever `package-lock.json` changes.
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

Renaming `unit_test` or `e2e_test` needs the ruleset "Protect main" changed in the same moment (`git-workflow.md`), or
no pull request can be merged.

## Releases

Releases are deterministic: never edit the version number or move CHANGELOG entries by hand.

### Between releases

- `CHANGELOG.md` starts with `## Unreleased`, split into `### Added`, `### Changed`, `### Fixed`. Every user-visible
  change adds its line there, in its own pull request.
- The version lives only in `package.json` (`version`); the build writes it into the extension's manifest. A normal
  pull request never changes it: the `test` workflow's `block_version_change` fails a pull request from a branch that
  is not `release/…` when it does.

### Making a release

1. **`create_release_pr`**, only when the user asks for a release: Actions > `create_release_pr` > Run workflow on
   `main`, or Claude (below). It stops when `## Unreleased` has no entries or a release pull request is already open;
   otherwise the next version is the latest tag plus a minor step with Added or Changed entries, a patch step with Fixed
   only (1.0.0 for the first release); the Unreleased entries move under `## X.Y.Z` (an empty `## Unreleased` stays
   above), X.Y.Z goes in `package.json`, and it opens the branch `release/X.Y.Z` with the pull request "Release X.Y.Z".
   The functions are in `scripts/release.mjs`. It needs the repository setting "Allow GitHub Actions to create and
   approve pull requests" (Settings > Actions > General).
2. **The pull request's tests wait for a maintainer's approval.** It was opened by `github-actions[bot]` (the
   workflow's token), and GitHub holds the workflows of such a pull request: a maintainer presses **Approve workflows to
   run** in the pull request. Tests started another way (`gh workflow run test.yml`) do not count: GitHub links to a
   pull request only the runs of its own events.
3. The user checks the pull request (version, CHANGELOG) and approves the merge.
4. **`publish_release`** starts with the merge, when the version in `package.json` changed. It runs the tests, builds
   the zip and signs it as a CRX, uploads each store's package and submits it for review (published as soon as it is
   approved), publishes the GitHub Release (GitHub creates the tag `vX.Y.Z` on the merge commit), then the site
   (`docs.md`). On the first release the Edge package only goes into the draft: Partner Center publishes a new
   extension by hand.

A failed job is retried with **Re-run failed jobs** on its run.

### The stores

- The extension's IDs on the stores are public, at the top of `publish_release.yml`. The credentials are secrets of the
  environment `production`, which gives them only to workflows on `main`, and are kept in the maintainer's password
  manager: `CHROME_SERVICE_ACCOUNT_JSON` (the key of the service account added in the Chrome dashboard's Settings),
  `EDGE_CLIENT_ID` and `EDGE_API_KEY` (Partner Center > Publish API; the key expires and is renewed there).
- **Every package for the Chrome Web Store is signed** (the user's requirement): the item has Verified CRX uploads,
  so the store takes only CRX files signed with `CHROME_CRX_PRIVATE_KEY`. Its public half is
  `.github/chrome-crx-public-key.pem`, and `publish_release` stops before uploading when the key doesn't match it.
  WXT's `wxt submit` uploads zips only, so `scripts/chrome-store.mjs` uploads the CRX; Edge uses `wxt submit`.

### When the user asks Claude for the release pull request

Claude does steps 1 and 2 and stops before the merge:
1. `gh workflow run create_release_pr.yml --ref main`, then `gh run watch` on its run; on a failure, its log says why.
2. Approves the release pull request's tests **as the user** (the user's `gh`, a maintainer), the same as the button:
   the run of the `test` workflow with event `pull_request` on the branch `release/X.Y.Z` and status
   `action_required` (`gh run list --branch release/X.Y.Z --workflow test.yml --json databaseId,event,conclusion`),
   then `gh api -X POST repos/{owner}/{repo}/actions/runs/<id>/approve`. Only for the pull request `create_release_pr`
   opened: its content is generated from `main`. Never for another pull request, never by a workflow.
3. Waits for `unit_test` and `e2e_test`, then gives the pull request's link and what it contains (version, CHANGELOG
   entries). The merge, which publishes the release, waits for the user's explicit OK.
