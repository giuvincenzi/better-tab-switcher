import { resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';

/** The extension's test build (`wxt build --mode e2e`): the published one plus the hook that opens the switcher. */
export const extensionDir = resolve('.output/chrome-mv3-e2e');

interface ExtensionFixtures {
  /** Chrome's own language (a BCP 47 tag): English by default; a test file can choose another with test.use(). */
  chromeLanguage: string;
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
 * Every test gets a fresh browser profile with the extension loaded, in English (chromeLanguage). The windows are real,
 * 1280 by 720 pixels, never an emulated viewport: the switcher's own window measures its frame (outer and inner sizes).
 */
export const test = base.extend<ExtensionFixtures>({
  chromeLanguage: ['en-US', { option: true }],
  context: async ({ chromeLanguage }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: browser,
      headless: !process.env.HEADED,
      locale: chromeLanguage,
      viewport: null,
      // Chrome takes its language from --lang; on Linux it needs the environment's language too. On macOS it takes it
      // only from the system's settings, which no test changes: there Chrome stays in the system's language.
      env: { ...process.env, LANGUAGE: chromeLanguage, LANG: `${chromeLanguage.replace('-', '_')}.UTF-8` },
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        `--lang=${chromeLanguage}`,
        '--window-size=1280,720',
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    contextOf.set(worker, context);
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

/** The browser context of each extension's background, for the helpers that only get the background (helpers.ts). */
export const contextOf = new WeakMap<Worker, BrowserContext>();
