import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type BrowserContext, test as base, type Page, type Worker } from '@playwright/test';
import { launchRealBrowser } from '../../scripts/real-browser.mjs';
import { dismissEdgeDeveloperModeBubble } from './edge-bubble';

/** The extension's test build (`wxt build --mode e2e`): the published one plus the hook that opens the switcher. */
export const extensionDir = resolve('.output/chrome-mv3-e2e');

interface ExtensionFixtures {
  /** Chrome's own language (a BCP 47 tag): English by default; a test file can choose another with test.use(). */
  chromeLanguage: string;
  /** The system in dark mode (Chrome's --force-dark-mode, as when the system is set so): light by default. */
  systemDark: boolean;
  /**
   * The system asking for less motion (Chrome's --force-prefers-reduced-motion), or not: off by default, always told to
   * Chrome, as each machine has its own (GitHub's macOS machines ask for less motion).
   */
  systemReducedMotion: boolean;
  /**
   * Console messages a test expects (errors or warnings the extension writes on purpose, as when it says why the
   * switcher fell back to its own window): each one with its reason, where the test sets it.
   */
  expectedConsole: RegExp[];
  /**
   * The browser's window on screen, for the tests that use the desktop (tests/e2e/system.ts): the system's focus is
   * real only there. On Linux it needs a desktop (xvfb-run on GitHub). Without: none, unless HEADED is set.
   */
  headed: boolean;
  /** Other extensions installed before this one (tests/e2e/keys-taken: one that takes its keys). */
  installedBefore: string[];
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

/** How long a browser may take to get the extension's background ready before its start is written down. */
const SLOW_START_MS = 5000;

/** The worker of this extension: the browser has its own extensions' workers too. */
async function isOurs(worker: Worker): Promise<boolean> {
  if (!worker.url().startsWith('chrome-extension://')) return false;
  // At most 2 s: a worker of the browser's own extensions may never answer (starting, or stopped), and the question
  // would hold up everything (Windows: 30 s, the test's whole time). Asked again on the next look.
  return Promise.race([
    worker.evaluate(() => 'next-tab' in (chrome.runtime.getManifest().commands ?? {})).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);
}

/**
 * Every test gets the real browser (scripts/real-browser.mjs: nothing emulated, the focus and the system's theme are
 * the real ones) with a fresh profile and the extension loaded, in English (chromeLanguage). The windows are real,
 * 1280 by 720 pixels: the switcher's own window measures its frame (outer and inner sizes).
 *
 * Every test also fails on any error or warning the extension causes in a console (its background, its pages, its
 * frame in a page, its script in a page), and on any error nothing caught there, unless the test expects it
 * (expectedConsole). The pages' own messages are theirs (Microsoft Edge's new tab page has some): not the extension's.
 */
export const test = base.extend<ExtensionFixtures & { ours: Worker }>({
  chromeLanguage: ['en-US', { option: true }],
  systemDark: [false, { option: true }],
  systemReducedMotion: [false, { option: true }],
  expectedConsole: [[], { option: true }],
  headed: [false, { option: true }],
  installedBefore: [[], { option: true }],
  context: async (
    { chromeLanguage, systemDark, systemReducedMotion, expectedConsole, headed, installedBefore },
    use,
    testInfo,
  ) => {
    // How the browser started, step by step, written to startup.txt in the test's folder once its start is slow: a test
    // whose browser never gets ready runs out of time before anything else could be reported.
    const started = Date.now();
    const steps: string[] = [];
    let slow = false;
    const step = (what: string) => {
      const line = `${Date.now() - started} ms ${what}\n`;
      if (slow) appendFileSync(testInfo.outputPath('startup.txt'), line);
      else steps.push(line);
    };
    const real = await launchRealBrowser({
      browser,
      extensionDir,
      installedBefore: installedBefore.map((dir) => resolve(dir)),
      headless: !(headed || process.env.HEADED),
      language: chromeLanguage,
      dark: systemDark,
      reducedMotion: systemReducedMotion,
      windowSize: '1280,720',
    });
    const { context } = real;
    // Microsoft Edge's bubble about developer mode would take the system's keys and focus (tests/e2e/edge-bubble.ts).
    if ((headed || process.env.HEADED) && browser === 'msedge' && process.platform === 'win32')
      dismissEdgeDeveloperModeBubble();
    browserPid.set(context, real.pid);
    browserPipe.set(context, real.sendToBrowser);
    /** Each message, with where it comes from: a page or script's address, or the background. */
    const messages: { from: string; text: string }[] = [];
    /** The extension's own addresses (chrome-extension://<its id>/), known once its background is found. */
    let extension = '';
    const watch = (page: Page) => {
      page.on('console', (message) => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        const from = message.location().url || page.url();
        messages.push({ from, text: `${message.type()} in ${from}: ${message.text()}` });
      });
      page.on('pageerror', (error) =>
        messages.push({ from: page.url(), text: `uncaught error in ${page.url()}: ${error.message}` }),
      );
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    // The extension's background, each time it starts: its console, and the errors nothing caught (read at the end).
    const watched = new Set<Worker>();
    const watchWorker = async (worker: Worker) => {
      if (watched.has(worker) || !(await isOurs(worker)) || watched.has(worker)) return;
      watched.add(worker);
      extension = `${new URL(worker.url()).origin}/`;
      worker.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning')
          messages.push({ from: 'background', text: `${message.type()} in the background: ${message.text()}` });
      });
      await worker
        .evaluate(() => {
          const errors: string[] = [];
          Object.assign(globalThis, { uncaughtErrors: errors });
          addEventListener('error', (event) => errors.push(event.message));
          addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
        })
        .catch(() => {});
    };
    await Promise.all(context.serviceWorkers().map(watchWorker));
    context.on('serviceworker', (worker) => void watchWorker(worker));
    // Ready as a user's browser is: with the extension loaded (its background started). A page navigating while the
    // browser still loads it can have its navigation aborted (Windows: 'net::ERR_ABORTED; maybe frame was detached').
    step(`connected to the browser (process ${real.pid})`);
    let looked = 0;
    while (!extension) {
      for (const worker of context.serviceWorkers()) await watchWorker(worker);
      if (extension) break;
      if (!slow && Date.now() - started > SLOW_START_MS) {
        slow = true;
        writeFileSync(testInfo.outputPath('startup.txt'), steps.join(''));
      }
      // Once a second while slow: what the browser has, and the workers Playwright sees.
      if (slow && Date.now() - looked > 1000) {
        looked = Date.now();
        const targets = await Promise.race([
          real
            .sendToBrowser('Target.getTargets')
            .then((answer) => (answer as { targetInfos: { type: string; url: string }[] }).targetInfos),
          new Promise<undefined>((resolve) => setTimeout(resolve, 1000)),
        ]).catch(() => undefined);
        step(
          `browser targets: ${targets ? targets.map(({ type, url }) => `${type} ${url}`).join(' | ') || 'none' : 'no answer in 1 s'}`,
        );
        step(
          `workers Playwright sees: ${
            context
              .serviceWorkers()
              .map((worker) => worker.url())
              .join(' | ') || 'none'
          }`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    step("the extension's background is ready");

    // What the browser itself did with its tabs and frames (made, changed, closed), for a failed test's report.
    const targets: string[] = [];
    const browserSession = await context.browser()?.newBrowserCDPSession();
    if (browserSession) {
      const started = Date.now();
      const note = (what: string, info: { type: string; url: string; targetId: string }) =>
        targets.push(`${Date.now() - started} ms ${what} ${info.type} ${info.targetId.slice(0, 8)} ${info.url}`);
      browserSession.on('Target.targetCreated', ({ targetInfo }) => note('made', targetInfo));
      browserSession.on('Target.targetInfoChanged', ({ targetInfo }) => note('changed', targetInfo));
      browserSession.on('Target.targetDestroyed', ({ targetId }) =>
        targets.push(`${Date.now() - started} ms closed ${targetId.slice(0, 8)}`),
      );
      await browserSession.send('Target.setDiscoverTargets', { discover: true });
    }

    await use(context);

    if (testInfo.status !== testInfo.expectedStatus && targets.length > 0)
      await testInfo.attach('browser-targets', { body: targets.join('\n'), contentType: 'text/plain' });

    for (const worker of context.serviceWorkers()) {
      const uncaught = await worker
        .evaluate(() => (globalThis as { uncaughtErrors?: string[] }).uncaughtErrors ?? [])
        .catch(() => []);
      for (const error of uncaught)
        messages.push({ from: 'background', text: `uncaught error in the background: ${error}` });
    }
    await real.close();
    const unexpected = messages
      .filter(({ from }) => from === 'background' || (extension !== '' && from.startsWith(extension)))
      .map(({ text }) => text)
      .filter((text) => !expectedConsole.some((expected) => expected.test(text)));
    if (unexpected.length > 0 && testInfo.status === testInfo.expectedStatus) {
      throw new Error(`The console has errors or warnings no test expects:\n${unexpected.join('\n')}`);
    }
  },
  ours: async ({ context }, use) => {
    // Looked for again until found: a worker still starting may not answer the first time.
    let worker: Worker | undefined;
    while (!worker) {
      for (const candidate of context.serviceWorkers()) if (await isOurs(candidate)) worker = candidate;
      if (!worker) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await use(worker);
  },
  serviceWorker: async ({ context, ours }, use, testInfo) => {
    contextOf.set(ours, context);
    // What the background wrote in its console (why the switcher fell back to its window…): with a failed test.
    const console: string[] = [];
    ours.on('console', (message) => console.push(`${message.type()}: ${message.text()}`));
    await use(ours);
    if (testInfo.status !== testInfo.expectedStatus && console.length > 0) {
      // A file in the test's folder, next to its screenshots and trace, and in the report.
      const path = testInfo.outputPath('background-console.txt');
      writeFileSync(path, console.join('\n'));
      await testInfo.attach('background-console', { path, contentType: 'text/plain' });
    }
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

/** The process of each test's browser, for the system's own input (tests/e2e/system.ts). */
export const browserPid = new WeakMap<BrowserContext, number>();

/** Each test's browser's own DevTools pipe (scripts/real-browser.mjs), for what only it does (tests/e2e/system.ts). */
export const browserPipe = new WeakMap<BrowserContext, (method: string, params?: object) => Promise<unknown>>();

/** The browser context of each extension's background, for the helpers that only get the background (helpers.ts). */
export const contextOf = new WeakMap<Worker, BrowserContext>();
