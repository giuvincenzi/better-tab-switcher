# Tests

## Unit tests: `make test`

- `tests/unit`: Vitest. One test file per area, named `<area>.test.ts`. A large area splits by aspect into files named
  `<area>-<aspect>.test.ts` next to it; a file that only builds test data has no `.test` in its name.
- The unit tests run in English with en-US numbers whatever the PC's language; a test of another language sets it itself.
- On GitHub they are the required check `unit_test` ("Which changes run the tests on GitHub" below), and
  `publish_release` runs them before a release is built.

## End-to-end tests: `make e2e`

- `tests/e2e`: Playwright with the development build of the extension loaded in Chromium, on a fresh browser profile,
  in English, so every test starts from the same state and finds controls by their English texts on any PC.
- On GitHub they are the required check `e2e_test` ("Which changes run the tests on GitHub" and "End-to-end tests in
  groups" below), and `publish_release` runs them before a release.
- `make e2e` runs them locally; it builds the development build first.
- Every test file has a category (a Playwright tag). `make e2e category=<name>` runs only one category: use it while
  working on that feature; before pushing, and on GitHub, all of them run.
- Find controls by their UI text or by their accessible name (`ui.md`), never by the texts inside a row. Wait for a state,
  never fixed sleeps.

## Which changes run the tests on GitHub

On a pull request or a push to `main`, the `test` workflow's first job, `decide_which_tests_run`, looks at the changed
files and tells which tests can change their result: a file the build of the extension reads, a file the tests read while
running, or the workflow itself. The other tests are skipped: a job skipped by its `if` counts as passing for a
required check, and `e2e_test` passes when the end-to-end tests were not needed. Called by `publish_release` or started
by hand (`gh workflow run test.yml --ref <branch>`), every test runs. The push of a release merge skips them, as
`publish_release` runs them on that commit. A pull request whose branch is not `release/…`
fails when it changes the version in `package.json` (`build-and-release.md`).

| Changed file | `unit_test` | end-to-end | Why |
|---|---|---|---|
| `tests/unit/**` | yes | no | The unit tests |
| `tests/e2e/**` | no | yes | The end-to-end tests |
| `package.json`, `package-lock.json` | yes | yes | The dependencies and the scripts the tests run |
| `.gitattributes` | yes | yes | Line endings at checkout |
| `.github/workflows/test.yml` | yes | yes | The workflow |

The extension's sources get their row in the pull request that adds them.

`screenshots_test` takes the release's screenshots as `create_release_pr` does (saved only as an artifact) when a file
they depend on changes: a change that breaks them fails the pull request (`e2e_test` checks its result) instead of the
release. Not when `publish_release` calls the tests: the release's screenshots were taken by `create_release_pr`, and a
machine problem there would block the release for nothing in the extension.

`readme_test` checks the README against the home page's texts, publishing nothing (`discoverability.md`); `e2e_test`
checks its result, so it blocks the merge.

Nothing else is read by the builds or the tests (`.claude/`, the rest of `site/`, the other Markdown files,
`LICENSE`, `Makefile`, the other `scripts/`, the other workflows). When the extension, the tests or a test
starts reading another file or folder, add it to this table and to the patterns of `decide_which_tests_run` in the
same pull request.

Do not filter the `test` workflow with `paths` / `paths-ignore`: a workflow that does not start leaves
its required check pending and blocks the merge (GitHub docs, "Troubleshooting required status
checks"), while a job or step skipped by `if` counts as passing.

## End-to-end tests in groups

On GitHub the end-to-end tests run on **`E2E_GROUPS` machines at once**, written once at the top of
`.github/workflows/test.yml`. Every test runs in every pull request, exactly once. The groups do not follow the
categories: they stay even whatever the categories grow into, and a new test needs nothing.

- Every machine lists the tests by full name, sorted the same way, numbered from 1; test n goes to the group of n
  modulo N (0 to group N). So every test is in exactly one group, and the groups differ by at most one test.
- With `E2E_SCREENSHOTS` set (only on GitHub, never locally), every test saves at its end a screenshot and Playwright's
  trace.
- Each group saves the artifact **`e2e_group_<n>_attempt_<a>`** (`<a>`: the run's attempt, so a "Re-run failed jobs"
  does not mix with the failed one), also when tests failed.
- **`e2e_test` (the required check):** takes each group's newest attempt, then is green when the end-to-end tests were
  not needed, or when every group saw the same list, every test ran exactly once and every test and group passed.
  Otherwise red, with the missing, doubled or failed tests in the run's summary.

**When an end-to-end test fails on GitHub**, start from the test's code and the line that failed. Each group's artifact
(the run's page > Artifacts, or `gh run download <run> --name e2e_group_<n>_attempt_<a>`) holds what helps understand
why: screenshots and traces of every test, the failed ones apart, and the report.
**Its `README.txt` says what each file and folder is and how it can help**; it is written by the step
`describe_group_result` of `test.yml`, the one description of the artifact (change it there when the artifact changes).

**Changing the number of machines:** change only `E2E_GROUPS`. Nothing else: not the ruleset (it requires `e2e_test`,
not the groups), not the tests. Each group adds about a minute of fixed cost (machine, checkout, build), so more
groups help less and less.
GitHub runs at most 20 jobs at once for the whole account (all pull requests and workflows together): the jobs over it
wait in a queue, they do not fail. Never rename `e2e_test` without changing the ruleset in the same moment
(`build-and-release.md`).

## When a test fails

**A failing test is a bug until proven otherwise** (the user's decision): fix the code, not the test. A test already on
`main` is changed only when the behavior it checks changes on purpose, in a change the user approved, and the plan or
the pull request says which test changes and why; it is never loosened to pass (fewer checks, wider margins, longer
waits, skipped). When the test itself looks wrong (it checks something false, or it is flaky), say why with the
evidence and ask before changing it: for an end-to-end test on GitHub the evidence is in its group's artifact (above,
"When an end-to-end test fails on GitHub"). A test written in the same change, not on `main` yet, is part of that work
and is fixed like its code.

## When to add and run tests

- New logic outside the UI (models, storage, migrations, the order of the tabs): add unit tests in
  the same change. A settings migration always gets a test with old data. Run `make test`
  before every commit.
- **A change that touches the UI** (the switcher, the settings page, what the user sees or does): add or update the
  end-to-end tests that cover it, then run all the end-to-end tests to check that nothing else broke, locally
  (`make e2e`) or on the branch (GitHub: push the branch and start the `test` workflow on it with
  `gh workflow run test.yml --ref <branch>`, then `gh run watch`; the pull request also runs them).
