# Tests

## Unit tests: `make test`

- `tests/unit`, Vitest in two projects (`vitest.config.ts`): the logic in Node, with WXT's in-memory browser where it
  needs storage; the components and `*.browser.test.ts` in headless Chromium. What depends on Chrome's own behavior
  (tabs, windows, messages, focus, the switcher in a page) is tested end to end only.
- One test file per area, named `<area>.test.ts` (`.test.tsx` for components, `.browser.test.ts` for what needs a
  browser's APIs); a large area splits by aspect into `<area>-<aspect>.test.ts`; a file that only builds test data has
  no `.test` in its name.
- They run in English; a test of another language sets it itself.

## End-to-end tests: `make e2e`

- `tests/e2e`: Playwright on the real browser (`scripts/real-browser.mjs`), Chromium or Microsoft Edge
  (`make e2e browser=msedge`), with the extension's e2e build, a fresh profile, in English. Nothing is emulated: no fake
  focus, color scheme or motion; the system's dark mode or reduced motion is a launch option, only where a test needs it.
- The tests that use the desktop (real keys, mouse, focus, another program: `tests/e2e/system.ts`) act only on the
  tested browser or on a window the test opened itself. On Linux they run on a virtual screen (`xvfb-run`), on Windows
  and macOS on the PC's own.
- **Never run `make e2e` on a contributor's PC without asking first**: on Windows and macOS the tests take the keyboard
  and the screen. Ask where to run them: locally, or on the branch on GitHub
  (`gh workflow run test.yml --ref <branch>`, then `gh run watch`). `make test` runs any time.
- On macOS the browser's language is written in its app's own preferences for the test, never in the system's:
  Playwright's Chromium always, Microsoft Edge only on GitHub's machines (on a developer's Mac it is their own browser).
- Every test fails on an error or a warning of the extension in any console (background, pages, frames) or on an error
  nothing caught: checked once, in the fixture (`tests/e2e/fixtures.ts`). A test that expects one says it, with why.
- A test checks the real result (the colors on screen, the focus the system gives, the tab Chrome shows), never a proxy
  (a CSS property, a spy).
- Each test checks what no other does: no duplicates.
- Every test file has a category, the `@tag` in its `test.describe` title: `make e2e category=<name>` runs one.
- Find controls by their UI text or their accessible name (`ui.md`), never by the texts inside a row. Wait for a state,
  never fixed sleeps.

## On GitHub

- The `test` workflow runs on every pull request and push to `main`. `unit_test` and `e2e_test` are the required checks
  (`git-workflow.md`): `unit_test` passes when lint, types and every unit test pass; `e2e_test` when every end-to-end
  test ran once and passed and the site built (`site_test`). The end-to-end tests run on Linux, Windows and
  macOS, in Chromium and Microsoft Edge, split in groups (`E2E_SYSTEMS`, `E2E_BROWSERS`, `E2E_GROUPS` at the top of
  `test.yml`).
- `decide_which_tests_run` skips the tests a change can't affect: its patterns are the list of what the builds and the
  tests read. When a build or a test starts reading another file, add it there in the same pull request. Never filter
  the workflow with `paths`: a workflow that doesn't start leaves its required check pending and blocks the merge.
- `site_test` builds the whole site and checks the README (`docs.md`); `build_extension` checks `third-party.json`
  against the build.
- **When an end-to-end test fails on GitHub**, start from the test's code and the line that failed. Its group's
  artifact holds the screenshots, traces and report; its `README.txt`, written by the step `describe_group_result` of
  `test.yml`, says what each file is (change it there when the artifact changes).

## When a test fails

**A failing test is a bug until proven otherwise** (the user's decision): fix the code, not the test. A test already on
`main` is changed only when the behavior it checks changes on purpose, in a change the user approved, and the plan or
the pull request says which test changes and why; it is never loosened to pass (fewer checks, wider margins, longer
waits, skipped). When the test itself looks wrong (it checks something false, or it is flaky), say why with the
evidence and ask before changing it: for an end-to-end test on GitHub the evidence is in its group's artifact (above).
A test written in the same change, not on `main` yet, is part of that work and is fixed like its code.

## When to add and run tests

- New logic: unit tests in the same change. A settings migration always gets a test with old data. Run `make test`
  before every commit.
- A change to what the user sees or does: add or update its end-to-end tests, then run them all (where: ask, above).
- Every bug fix comes with an end-to-end test shown to fail without the fix.
