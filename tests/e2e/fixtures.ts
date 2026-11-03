import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type BrowserContext,
  test as base,
  type CDPSession,
  type Page,
  type TestInfo,
  type Worker,
} from '@playwright/test';
import { launchRealBrowser } from '../../scripts/real-browser.mjs';
import { dismissEdgeDeveloperModeBubble } from './edge-bubble';
import { type SiteAnswer, startTestSites, type TestSites } from './site';
import { run, screenPicture } from './system';

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
  /** The test sites (tests/e2e/site.ts): a test serves a page of its own on a *.test host for its duration. */
  site: TestSite;
}

/** What a test does with the test sites: serve a page of its own on a *.test host, for its duration. */
export interface TestSite {
  serve: (host: string, answer: SiteAnswer) => void;
}

interface WorkerFixtures {
  /** The test sites' server, one for each of Playwright's workers (tests/e2e/site.ts). */
  testSites: TestSites;
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
/**
 * How long the extension's background may take to start once the browser runs: Microsoft Edge on GitHub's Windows
 * machines, with a fresh profile, delays every extension's service worker: once its own started after 24.2 s and ours
 * not within 30 s (the user chose to wait up to 120 s, keeping the fresh profile). Each step of starting the browser
 * has its limit too (scripts/real-browser.mjs): one that hangs fails, saying which, never the test's own time.
 */
const BACKGROUND_MS = 120_000;

/**
 * The time to start the browser with the extension, and to close it, apart from the test's own: the steps' limits fit
 * in it, so a browser slow to start is reported by its step, and the test keeps its 30 seconds for what it checks.
 */
const BROWSER_MS = 300_000;

/**
 * Whether a test keeps what helps understand why it failed (its trace, the browser's state, the background's console):
 * on GitHub every test, to compare a failed test with a passed one or with another system; on the PC the failed ones.
 */
function keepsReport(testInfo: TestInfo): boolean {
  return !!process.env.CI || testInfo.status !== testInfo.expectedStatus;
}

/** Saves `body` in the test's folder, next to its screenshots and trace, and adds it to the report. */
async function attachText(testInfo: TestInfo, name: string, body: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.txt`);
  writeFileSync(path, body);
  await testInfo.attach(name, { path, contentType: 'text/plain' });
}

/** The browser's processes (type and id) and the CPU time each has used, in seconds: none when the browser can't say. */
async function processes(session: CDPSession | undefined): Promise<Map<string, number>> {
  const used = new Map<string, number>();
  const info = await session?.send('SystemInfo.getProcessInfo').catch(() => undefined);
  for (const { type, id, cpuTime } of info?.processInfo ?? []) used.set(`${type} ${id}`, cpuTime);
  return used;
}

/** For a failed test's report: the CPU time each process used between `before` and `after`, the busiest first. */
function cpuDuringTest(before: Map<string, number>, after: Map<string, number>): string[] {
  return [...after]
    .map(([process, cpu]) => ({ process, used: cpu - (before.get(process) ?? 0) }))
    .sort((a, b) => b.used - a.used)
    .map(
      ({ process, used }) => `${used.toFixed(2)} s ${process}${before.has(process) ? '' : ' (started in the test)'}`,
    );
}

/**
 * For a failed test's report on Windows: when each of the browser's processes started (ms since the test started), from
 * the system. In Chromium on GitHub's Windows machines the switcher's frame and window once both waited 6.8 s for the
 * process of the extension's pages, which used almost no CPU: whether the browser started that process late, or the
 * process took long to start.
 */
async function processStarts(processesNow: Map<string, number>, testStarted: number): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  const pidOf = (key: string) => key.split(' ').at(-1) ?? '';
  const ids = [...processesNow.keys()].map(pidOf).filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return [];
  const listed = await run('powershell', [
    '-NoProfile',
    '-Command',
    `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $(([DateTimeOffset]$_.StartTime).ToUnixTimeMilliseconds())" }`,
  ]).catch(() => '');
  const started = new Map(
    listed
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim().split(' ') as [string, string]),
  );
  return [
    "When each of the browser's processes started (ms into the test, from the system):",
    ...[...processesNow.keys()].map((key) => {
      const at = started.get(pidOf(key));
      return `${key}: ${at === undefined ? 'not found' : Number(at) - testStarted}`;
    }),
  ];
}

/**
 * What Chromium itself did, for a failed test on GitHub's Windows machines (chrome-trace.json, opened in
 * https://ui.perfetto.dev): in Chromium there the switcher's frame and its own window, two navigations, both waited
 * 7 to 15 s for something in the browser and went on at the same moment, while the disk, the CPU and the connections
 * were idle and Microsoft Edge on the same machines never waited more than 0.25 s. The browser's tasks on every thread,
 * its navigations and loads, kept in memory as they happen (the last ones only). Returns how to stop it: with a path, the
 * trace is saved there.
 */
async function startChromeTrace(
  session: CDPSession | undefined,
): Promise<((path?: string) => Promise<boolean>) | undefined> {
  if (!session) return undefined;
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: {
      recordMode: 'recordContinuously',
      includedCategories: [
        'toplevel',
        'navigation',
        'loading',
        'browser',
        'content',
        'extensions',
        'ipc',
        'mojom',
        'ServiceWorker',
        'disabled-by-default-navigation',
      ],
    },
  });
  return async (path) => {
    const complete = new Promise<{ stream?: string }>((resolve) => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end');
    const { stream } = await complete;
    if (!stream) return false;
    if (path) {
      const chunks: Buffer[] = [];
      for (;;) {
        const { data, eof, base64Encoded } = await session.send('IO.read', { handle: stream });
        chunks.push(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
        if (eof) break;
      }
      writeFileSync(path, Buffer.concat(chunks));
    }
    await session.send('IO.close', { handle: stream });
    return path !== undefined;
  };
}

/**
 * In every page and frame from its start: when the browser showed or hid it (visibilitychange, with Date.now()). A page
 * the browser takes as hidden (a window it thinks covered) draws nothing and runs no animation frame.
 */
function recordVisibility() {
  const seen: [number, string][] = [[Date.now(), document.visibilityState]];
  Object.assign(globalThis, { visibilitySeen: seen });
  addEventListener('visibilitychange', () => seen.push([Date.now(), document.visibilityState]), true);
  // And when the document itself finished loading: a frame's parent learns of it from its load event.
  addEventListener('DOMContentLoaded', () => seen.push([Date.now(), 'parsed']), true);
  addEventListener('load', (event) => event.target === document && seen.push([Date.now(), 'loaded']), true);
}

/**
 * For a failed test's report: each page's frames, with how far each has loaded (document.readyState) and when it was
 * shown or hidden (ms since the test started), or that it didn't answer within a second (its process busy, or the frame
 * stuck).
 */
async function framesState(context: BrowserContext, testStarted: number): Promise<string[]> {
  const lines = [
    "The pages' frames as the test ended, and when each was visible or hidden, parsed and loaded (ms into the test):",
  ];
  for (const page of context.pages()) {
    for (const frame of page.frames()) {
      const state = await Promise.race([
        frame
          .evaluate(() => {
            const seen = (globalThis as { visibilitySeen?: [number, string][] }).visibilitySeen ?? [];
            return { ready: document.readyState, seen };
          })
          .then(
            ({ ready, seen }) =>
              `${ready}, ${seen.map(([at, visibility]) => `${visibility} at ${at - testStarted}`).join(', ') || 'visibility not recorded'}`,
          )
          .catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`),
        new Promise<string>((late) => setTimeout(() => late('no answer within 1 s'), 1000)),
      ]);
      lines.push(`${frame === page.mainFrame() ? 'page' : '  frame'} ${frame.url()}: ${state}`);
    }
  }
  return lines;
}

/**
 * For a failed test's report: the window of each page, as the browser places it on the screen (its id, state, place
 * and size), asked of the browser itself (the extension's background may be stopped as the test ends).
 */
async function windowsState(context: BrowserContext): Promise<string[]> {
  const lines = ["The pages' windows as the test ended:"];
  for (const page of context.pages()) {
    const where = await context
      .newCDPSession(page)
      .then((session) => session.send('Browser.getWindowForTarget'))
      .then(
        ({ windowId, bounds }) =>
          `window ${windowId} ${bounds.windowState} at ${bounds.left},${bounds.top} ${bounds.width}x${bounds.height}`,
      )
      .catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
    lines.push(`${page.url()}: ${where}`);
  }
  return lines;
}

/** Waits for `found` to give something, every 100 ms, for at most `limitMs`; fails saying `what` didn't happen. */
async function waitFor<T>(found: () => Promise<T | undefined>, limitMs: number, what: string): Promise<T> {
  const until = Date.now() + limitMs;
  for (;;) {
    const value = await found();
    if (value !== undefined) return value;
    if (Date.now() > until) throw new Error(`${what} within ${limitMs} ms.`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export const test = base.extend<ExtensionFixtures & { ours: Worker }, WorkerFixtures>({
  testSites: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads what a fixture needs from this pattern: nothing here.
    async ({}, use) => {
      const sites = await startTestSites();
      await use(sites);
      await sites.close();
    },
    { scope: 'worker' },
  ],
  site: async ({ testSites }, use) => {
    await use({ serve: testSites.serve });
  },
  chromeLanguage: ['en-US', { option: true }],
  systemDark: [false, { option: true }],
  systemReducedMotion: [false, { option: true }],
  expectedConsole: [[], { option: true }],
  headed: [false, { option: true }],
  installedBefore: [[], { option: true }],
  context: [
    async (
      { chromeLanguage, systemDark, systemReducedMotion, expectedConsole, headed, installedBefore, testSites },
      use,
      testInfo,
    ) => {
      // The sites of the test before are forgotten: bts.test alone, until this test serves its own.
      testSites.reset();
      // On GitHub, Microsoft Edge writes its NetLog (Chrome's own account of every request: names looked up,
      // connections, certificates, checks, and how long each waited), kept for a failed test: a fresh Edge on Windows
      // loaded a test's first page 31 s late, its CPU idle.
      const netLog = process.env.CI && browser === 'msedge' ? testInfo.outputPath('netlog.json') : undefined;
      /** Once the browser is closed (its NetLog is whole then): kept for a failed test, else removed. */
      const keepNetLog = async () => {
        if (!netLog || !existsSync(netLog)) return;
        if (testInfo.status !== testInfo.expectedStatus)
          await testInfo.attach('netlog', { path: netLog, contentType: 'application/json' });
        else rmSync(netLog);
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
        siteRules: testSites.rules,
        quietEdge: true,
        netLog,
      });
      const { context } = real;
      // Microsoft Edge's bubble about developer mode would take the system's keys and focus (tests/e2e/edge-bubble.ts).
      if ((headed || process.env.HEADED) && browser === 'msedge' && process.platform === 'win32')
        await dismissEdgeDeveloperModeBubble();
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
            // When Chrome gives the extension a click of its toolbar button, in background-console (a click once took
            // 5 s to bring the switcher, on macOS Microsoft Edge: Chrome's delay or the extension's).
            chrome.action.onClicked.addListener(() =>
              console.info(`(test) Chrome gave the toolbar button's click at ${Date.now()}`),
            );
          })
          .catch(() => {});
      };
      await Promise.all(context.serviceWorkers().map(watchWorker));
      context.on('serviceworker', (worker) => void watchWorker(worker));
      // What the browser itself did with its tabs, frames and workers (made, changed, closed), from its start, for a
      // failed test's report.
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

      // Ready as a user's browser is: with the extension loaded (its background started). A page navigating while the
      // browser still loads it can have its navigation aborted (Windows: 'net::ERR_ABORTED; maybe frame was detached').
      // When it doesn't start: the service workers there are (the extension's missing: not loaded; there: stuck), with
      // what the browser made and wrote, so the cause shows.
      try {
        await waitFor(
          async () => {
            for (const worker of context.serviceWorkers()) await watchWorker(worker);
            return extension || undefined;
          },
          BACKGROUND_MS,
          "The extension's background didn't start",
        );
      } catch (error) {
        const workers = context.serviceWorkers().map((worker) => worker.url());
        await testInfo.attach('browser-start', {
          body: [
            `Service workers Playwright sees: ${workers.join(', ') || 'none'}`,
            'What the browser made:',
            ...targets,
            "The browser's output:",
            real.output(),
          ].join('\n'),
          contentType: 'text/plain',
        });
        throw new Error(
          `${(error as Error).message} Service workers: ${workers.join(', ') || 'none'} (attached: browser-start).`,
        );
      }
      // Ready once it has loaded a page too: right after starting, GitHub's Windows machines took seconds for the first
      // page (4.1 s) while the browser still started, and the switcher's first frame in a page ran past its limit then
      // (FIRST_TIME_MS), opening in its own window. The tests start once the browser has finished starting.
      // A page of the test sites first: a page from the network waits for the browser's cookies, which a data: page
      // never reads. Microsoft Edge on GitHub's Windows machines once loaded them 71.7 s after its start (its NetLog:
      // COOKIE_PERSISTENT_STORE_LOAD, waiting for the key that encrypts them), and the test's first page waited for
      // them 23 s of its 30. Then the data: page as before, so the tab the tests find is the same.
      const [first] = context.pages();
      if (first) {
        await first.goto('https://bts.test/ready', { waitUntil: 'load', timeout: BACKGROUND_MS });
        await first.goto('data:text/html,<title>ready</title>', { waitUntil: 'load' });
      }
      // Every page and frame the test opens notes when the browser shows or hides it (browser-state).
      await context.addInitScript(recordVisibility);

      // The test's trace: its pages (snapshots, screencast), their network and consoles, step by step. Recorded here:
      // Playwright's own `trace` option records only the contexts it makes, or that exist as the test starts, and this
      // one is reached with connectOverCDP inside this fixture, after the test started.
      await context.tracing.start({ screenshots: true, snapshots: true });
      const processesAtStart = await processes(browserSession);
      const stopChromeTrace =
        browser === 'chromium' && process.platform === 'win32' && process.env.CI
          ? await startChromeTrace(browserSession).catch(() => undefined)
          : undefined;
      // The browser leaving during the test (its process gone, or Playwright's connection to it): Playwright then closes
      // the context, and the trace can't be saved any more. Noted with when, and how the process ended.
      const testStarted = Date.now();
      let disconnectedAt: number | undefined;
      let ended: string | undefined;
      context.browser()?.once('disconnected', () => {
        disconnectedAt ??= Date.now() - testStarted;
      });
      void real.closed.then((how) => {
        ended = how;
      });
      await use(context);
      const disconnected = disconnectedAt !== undefined;
      const howItLeft = `Playwright lost the browser ${disconnectedAt} ms into the test; its process ${
        ended === undefined ? 'was still running' : `had ended (${ended})`
      }.`;

      if (stopChromeTrace && !disconnected) {
        const failed = testInfo.status !== testInfo.expectedStatus;
        const path = testInfo.outputPath('chrome-trace.json');
        if (await stopChromeTrace(failed ? path : undefined).catch(() => false))
          await testInfo.attach('chrome-trace', { path, contentType: 'application/json' });
      }

      if (keepsReport(testInfo) || disconnected) {
        const processesAtEnd = await processes(browserSession);
        // Saved first, so they are there whatever happens to the trace.
        await attachText(testInfo, 'browser-targets', targets.join('\n'));
        await attachText(testInfo, 'browser-output', real.output());
        // Why the browser was slow, when it was: how far each frame has loaded, and which processes were busy.
        await attachText(
          testInfo,
          'browser-state',
          [
            `The test started at ${testStarted} (ms since 1970; the times below are ms after it).`,
            ...(disconnected ? [howItLeft] : []),
            ...(await framesState(context, testStarted)),
            ...(await windowsState(context)),
            "The browser's processes, with the CPU time each used during the test:",
            ...cpuDuringTest(processesAtStart, processesAtEnd),
            ...(testInfo.status !== testInfo.expectedStatus ? await processStarts(processesAtEnd, testStarted) : []),
          ].join('\n'),
        );
        // A failed test: the whole screen too, what covers a window or what took the focus (macOS and Windows).
        if (testInfo.status !== testInfo.expectedStatus) {
          const screen = await screenPicture();
          if (screen) {
            const path = testInfo.outputPath('screen.png');
            writeFileSync(path, screen);
            await testInfo.attach('screen', { path, contentType: 'image/png' });
          }
        }
      }
      if (disconnected) {
        await real.close();
        await keepNetLog();
        throw new Error(
          `The browser left during the test, so its trace can't be saved: ${howItLeft} (attached: browser-output, browser-state).`,
        );
      }
      if (keepsReport(testInfo)) {
        const path = testInfo.outputPath('trace.zip');
        await context.tracing.stop({ path });
        await testInfo.attach('trace', { path, contentType: 'application/zip' });
      } else {
        await context.tracing.stop();
      }

      for (const worker of context.serviceWorkers()) {
        const uncaught = await worker
          .evaluate(() => (globalThis as { uncaughtErrors?: string[] }).uncaughtErrors ?? [])
          .catch(() => []);
        for (const error of uncaught)
          messages.push({ from: 'background', text: `uncaught error in the background: ${error}` });
      }
      await real.close();
      await keepNetLog();
      const unexpected = messages
        .filter(({ from }) => from === 'background' || (extension !== '' && from.startsWith(extension)))
        .map(({ text }) => text)
        .filter((text) => !expectedConsole.some((expected) => expected.test(text)));
      if (unexpected.length > 0 && testInfo.status === testInfo.expectedStatus) {
        throw new Error(`The console has errors or warnings no test expects:\n${unexpected.join('\n')}`);
      }
    },
    { scope: 'test', timeout: BROWSER_MS },
  ],
  ours: async ({ context }, use) => {
    // Looked for again until found: a worker still starting may not answer the first time.
    const worker = await waitFor(
      async () => {
        for (const candidate of context.serviceWorkers()) if (await isOurs(candidate)) return candidate;
        return undefined;
      },
      BACKGROUND_MS,
      "The extension's background didn't answer",
    );
    await use(worker);
  },
  serviceWorker: async ({ context, ours }, use, testInfo) => {
    contextOf.set(ours, context);
    // What the background wrote in its console (why the switcher fell back to its window…): the trace has the pages'
    // consoles, not the background's.
    const console: string[] = [];
    ours.on('console', (message) => console.push(`${message.type()}: ${message.text()}`));
    await use(ours);
    if (keepsReport(testInfo) && console.length > 0)
      await attachText(testInfo, 'background-console', console.join('\n'));
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
