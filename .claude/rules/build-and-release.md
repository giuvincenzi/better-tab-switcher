# Build and release

## Requirements

- **Node.js** with npm, at the version in `.tool-versions` (asdf: `asdf install`).
- **Playwright's Chromium**: installed by `make setup`; `make dev` and the end-to-end tests run in it.
- **GNU make**: usually already in Linux, macOS and WSL; on Windows `winget install --id ezwinports.make --exact`.
- **GitHub CLI** (`gh`), signed in: pull requests, starting workflows (`create_release_pr`, the tests on a branch).

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
- There is no `make` for releases or screenshots: GitHub workflows do them (Releases below).
- Always build after changes and fix all errors and warnings you introduced.

## Dev and prod builds

- **Prod** (`make build`, the `publish_release` workflow): the zip uploaded to the Chrome Web Store and to Microsoft
  Edge Add-ons. The stores update the installed extension.
- Development builds are isolated from an installed Better Tab Switcher: they have their own extension ID, so they never
  share its data. They show development marks, hidden when built for the screenshots.

## Secrets

- **The repository is public: never publish secrets anywhere in it**, on any branch, in any commit,
  pull request, issue, comment or workflow log: passwords, tokens, keys, codes or links, personal documents. Secrets go
  only in GitHub's encrypted secrets.
- The GitHub environment **`production`** (repository Settings > Environments) holds the stores' credentials.
- Environments are named after where a job publishes, as GitHub intends them: `production` is the release (each run of
  `publish_extension` shows in the repository's Deployments). A new place to publish gets an environment of its own with
  the same secret names and its own values (GitHub cannot rename or copy one: a new environment, its branch rule and its
  secrets are set by hand). `github-pages` is the site's, the name `actions/deploy-pages` expects.
- Publishing happens only in the `publish_release` workflow, on `main`, when a release is published: its
  `publish_extension` job uses the `production` environment. The environment allows only the `main` branch (Settings >
  Environments > `production` > Deployment branches and tags), so no other branch or pull request can use the secrets.
- Code merged into `main` runs in the `publish_release` workflow with the secrets. Before merging a pull
  request from someone else, check above all what it changes in `scripts/`, `package.json` and `.github/workflows/`.
  Pull requests from forks never get the secrets, and their workflows wait for approval the first
  time a contributor opens one.

## Workflows

GitHub Actions, in `.github/workflows/`. Workflow, job and step names are lowercase with underscores; each says what
it does (the workflow the phase, the job the action).

| Workflow | Starts |
|---|---|
| `test` | every pull request and push to `main`; `workflow_dispatch` (`gh workflow run test.yml --ref <branch>`); `workflow_call` (`publish_release`) |
| `create_release_pr` | only by hand (`workflow_dispatch`) on `main` |
| `publish_release` | a push to `main` that changes the version in `package.json` |

- Repository settings they need (Settings > Actions > General > Workflow permissions): the default token stays read
  only (each workflow declares its own `permissions`), and **Allow GitHub Actions to create and approve pull requests**
  is on, for `create_release_pr`.
- The ruleset "Protect main" requires the checks `unit_test` and `e2e_test` (`git-workflow.md`): renaming those jobs
  needs the ruleset changed in the same moment, or no pull request can be merged.

## Releases

Releases are deterministic: never edit the version number or move CHANGELOG entries by hand.
The version lives only in `package.json` (`version`); the build writes it into the extension's manifest.

### Between releases
- `CHANGELOG.md` starts with `## Unreleased`, split into `### Added`, `### Changed`,
  `### Fixed`. Every user-visible change adds its line there, in its own pull request.
- A normal pull request never changes the version in `package.json`: the `test` workflow's `block_version_change` fails a
  pull request from a branch that is not `release/…` when it does.

### Making a release
1. **`create_release_pr`**, only when the user asks for a release: Actions > `create_release_pr` > Run workflow on
   `main`, or Claude (below). It stops when `## Unreleased` has no entries or a release
   pull request is already open; otherwise the next version is the latest tag plus a minor step with Added or Changed
   entries, a patch step with Fixed only; the Unreleased entries move under `## X.Y.Z` (an empty `## Unreleased` stays
   above), X.Y.Z goes in `package.json`, the screenshots are taken (`docs.md`), and it opens
   the branch `release/X.Y.Z` with the pull request "Release X.Y.Z".
2. **The pull request's tests wait for a maintainer's approval.** It was opened by `github-actions[bot]` (the
   workflow's token), and GitHub holds the workflows of such a pull request: its `test` run shows "action_required" and
   the pull request "1 workflow awaiting approval", with `unit_test` and `e2e_test` "Expected". A maintainer presses
   **Approve workflows to run** in the pull request. Tests started another way (`gh workflow run test.yml`) do not
   count: GitHub links to a pull request only the runs of its own events, so it would stay blocked.
3. The user checks the pull request (version, CHANGELOG, screenshots) and approves the merge.
4. **`publish_release`** starts with the merge: merging adds a commit to `main` (a push), and GitHub starts the
   workflow because that commit changes the version in `package.json`; for any other push it does nothing. It runs the
   tests, builds the zip, uploads it to the stores (`wxt submit`), publishes the GitHub Release (GitHub creates the tag `vX.Y.Z` on the
   merge commit), then the site (`docs.md`).

A failed job is retried with **Re-run failed jobs** on its run.

### When the user asks Claude for the release pull request

Claude does steps 1 and 2 and stops before the merge:
1. `gh workflow run create_release_pr.yml --ref main`, then `gh run watch` on its run; on a failure, its log says why
   (for example `stop_if_nothing_to_release`).
2. Approves the release pull request's tests **as the user** (the user's `gh`, a maintainer), the same as the button:
   the run of the `test` workflow with event `pull_request` on the branch `release/X.Y.Z` and status
   `action_required` (`gh run list --branch release/X.Y.Z --workflow test.yml --json databaseId,event,conclusion`),
   then `gh api -X POST repos/{owner}/{repo}/actions/runs/<id>/approve`. Only for the pull request `create_release_pr`
   opened: its content is generated from `main`. Never for another pull request, never by a workflow.
3. Waits for `unit_test` and `e2e_test`, then gives the pull request's link and what it contains (version, CHANGELOG
   entries, screenshots to look at). The merge, which publishes the release, waits for the user's explicit OK.
