import { resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';

/** The extension's test build (`wxt build --mode e2e`): the published one plus the hook that opens the switcher. */
const extensionDir = resolve('.output/chrome-mv3-e2e');

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/**
 * The browser the tests run in (E2E_BROWSER): Playwright's Chromium, or Microsoft Edge ("msedge", installed on the
 * machine). Both load the extension with --load-extension.
 */
const BROWSERS = ['chromium', 'msedge'] as const;
const browser = process.env.E2E_BROWSER ?? 'chromium';
if (!(BROWSERS as readonly string[]).includes(browser)) {
  throw new Error(`E2E_BROWSER must be one of ${BROWSERS.join(', ')}: '${browser}'.`);
}

/**
 * Every test gets a fresh browser profile with the extension loaded, in English. The windows are real, 1280 by 720
 * pixels, never an emulated viewport: the switcher's own window measures its frame (outer and inner sizes).
 */
export const test = base.extend<ExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures take their dependencies as a destructured object.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: browser,
      headless: !process.env.HEADED,
      locale: 'en-US',
      viewport: null,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        '--lang=en-US',
        '--window-size=1280,720',
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
