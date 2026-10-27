import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WXT's plugin goes in each project: set at the root, the fake browser it sets up doesn't reach the projects.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [WxtVitest()],
        test: { name: 'logic', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [WxtVitest()],
        test: {
          name: 'components',
          include: ['tests/unit/**/*.test.tsx'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
});
