import { playwright } from '@vitest/browser-playwright';
import { generateChromeMessages, parseMessagesFile } from '@wxt-dev/i18n/build';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// The tests of the components (*.test.tsx) and of the code that needs a real browser (*.browser.test.ts) run in
// Chromium; the others in Node. WXT's plugin can't set up its fake browser there (wxt-dev/wxt#1724): they use
// WXT's other plugins and tests/unit/browser-setup.ts instead, which sets up the same fake browser with the English
// texts of locales/en.yml. Remove it once WXT supports Vitest's browser mode. Solid's plugin compiles the components
// (WXT's Solid module adds it to the extension's build only).
const wxtInBrowser = (await WxtVitest()).filter(
  (plugin) => !(plugin && 'name' in plugin && plugin.name === 'wxt:extension-api-mock'),
);
const englishMessages = generateChromeMessages(await parseMessagesFile('locales/en.yml'));

// WXT's plugin goes in each project: set at the root, the fake browser it sets up doesn't reach the projects.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [WxtVitest()],
        test: {
          name: 'logic',
          include: ['tests/unit/**/*.test.ts'],
          exclude: ['tests/unit/**/*.browser.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [...wxtInBrowser, solid()],
        define: { __ENGLISH_MESSAGES__: JSON.stringify(englishMessages) },
        // Prepared before the tests start: one Vite found while they ran would reload them, and they would fail on a
        // machine without Vite's cache (GitHub's).
        optimizeDeps: { include: ['wxt/browser', '@webext-core/messaging', 'wxt/utils/storage'] },
        test: {
          name: 'browser',
          include: ['tests/unit/**/*.test.tsx', 'tests/unit/**/*.browser.test.ts'],
          setupFiles: ['tests/unit/browser-setup.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
});
