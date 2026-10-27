import { resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';

/** The built extension, as `make build` and `npm run e2e` make it. */
const extensionDir = resolve('.output/chrome-mv3');

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/** Every test gets a fresh browser profile with the extension loaded, in English. */
export const test = base.extend<ExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures take their dependencies as a destructured object.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      locale: 'en-US',
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`, '--lang=en-US'],
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
