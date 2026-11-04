import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The program for the system's own input, built once before every test (tests/e2e/system-tool.ts).
  globalSetup: './tests/e2e/global-setup.ts',
  // Every test is on its own (its own browser and profile, tests/e2e/fixtures.ts): the groups on GitHub split them one
  // by one (--shard), not by file. On the PC one at a time.
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // On GitHub every test keeps its screenshot, to compare a failed test with a passed one or with another system; on
  // the PC only the failed ones, so the tests stay quick. Its trace is recorded by the fixture (tests/e2e/fixtures.ts):
  // Playwright's `trace` option doesn't reach the browser the fixture connects to.
  use: {
    // An action (a click, typing) that can't happen fails within 10 s, saying what it waited for (the element to be
    // visible, still, not covered), instead of the test running out of its 30 s with no word of why.
    actionTimeout: 10_000,
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
  },
});
