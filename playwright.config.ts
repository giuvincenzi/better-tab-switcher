import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Every test is on its own (its own browser and profile, tests/e2e/fixtures.ts): the groups on GitHub split them one
  // by one (--shard), not by file. On the PC one at a time.
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // On GitHub every test keeps its screenshot and its trace, to compare a failed test with a passed one or with
  // another system; on the PC only the failed ones, so the tests stay quick.
  use: {
    trace: process.env.CI ? 'on' : 'retain-on-failure',
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
  },
});
