// The browser as a user runs it, for the end-to-end tests (tests/e2e/fixtures.ts) and make dev (scripts/dev.mjs): we
// start it, then Playwright attaches to it with noDefaults, so it emulates nothing (no fake focus, no color scheme nor
// reduced motion of its own): what the tests and the developer see is what users see.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

/**
 * Where Microsoft Edge is installed (`npx playwright install msedge` puts it there), on each system.
 * @type {Partial<Record<NodeJS.Platform, string[]>>}
 */
const EDGE = {
  linux: ['/opt/microsoft/msedge/msedge'],
  darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  win32: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

/**
 * The program of the browser: Playwright's Chromium ("chromium") or Microsoft Edge ("msedge").
 * @param {string} name
 */
export function browserExecutable(name) {
  if (name === 'chromium') return chromium.executablePath();
  const found = (EDGE[process.platform] ?? []).find((path) => existsSync(path));
  if (found) return found;
  throw new Error(`Microsoft Edge is not installed here: install it with npx playwright install msedge.`);
}

/** How long the browser may take to start and open its DevTools port. */
const START_MS = 30_000;

/**
 * Starts the browser with the extension in `extensionDir`, in a new profile, and attaches Playwright to it;
 * `installedBefore`, other extensions installed before it (the first ones get the keys they ask for). `language`
 * is Chrome's own language (--lang and, on Linux, the environment's), `dark` the system's dark mode, `reducedMotion`
 * the system's "reduce motion" on or off (the system's own setting when not given); `windowSize` the first window's
 * size. Returns its one browser context, close(), its process (pid) and sendToBrowser (browserPipe).
 * @param {{ browser?: string, extensionDir: string, installedBefore?: string[], headless?: boolean, language?: string,
 *   dark?: boolean,
 *   reducedMotion?: boolean, windowSize?: string }} options
 * @returns {Promise<{ context: import('@playwright/test').BrowserContext, close: () => Promise<void>,
 *   closed: Promise<unknown>, pid: number, sendToBrowser: (method: string, params?: object) => Promise<any> }>}
 */
export async function launchRealBrowser({
  browser = 'chromium',
  extensionDir,
  installedBefore = [],
  headless = true,
  language,
  dark = false,
  reducedMotion,
  windowSize,
}) {
  const profile = mkdtempSync(join(tmpdir(), 'better-tab-switcher-'));
  const args = [
    // Port 0: the browser chooses a free one and writes it in DevToolsActivePort, in the profile. Playwright attaches
    // there. The pipe (the process's 4th and 5th streams) is for what the browser takes only from the program that
    // started it: Extensions.triggerAction, the toolbar button's own action (sendToBrowser).
    '--remote-debugging-port=0',
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Ubuntu (24.04 and later) lets no program it doesn't know use the sandbox Chrome isolates its pages with, and
    // Playwright's Chromium is not known to it: as Playwright does, on Linux the pages are not isolated from each other
    // (a matter of security, not of what the extension or the pages do).
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    // On Linux, X11 even on a Wayland desktop (WSL's): the tests give its windows the focus and the keys with X11's
    // own input (tests/e2e/x11.py).
    ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []),
    // On Windows, Chrome pauses the pages of a window it thinks other windows cover. A machine with no screen of its own
    // (GitHub's) makes it think so of a window in plain sight, whose pages then never load: as Playwright does, Chrome
    // doesn't look for covered windows there.
    ...(process.platform === 'win32' ? ['--disable-features=CalculateNativeWinOcclusion'] : []),
    ...(headless ? ['--headless'] : []),
    ...(language ? [`--lang=${language}`] : []),
    ...(dark ? ['--force-dark-mode'] : []),
    // Unless told, the system's own setting (the macOS machines of GitHub ask for less motion).
    ...(reducedMotion === undefined
      ? []
      : [reducedMotion ? '--force-prefers-reduced-motion' : '--force-prefers-no-reduced-motion']),
    ...(windowSize ? [`--window-size=${windowSize}`] : []),
    `--disable-extensions-except=${[...installedBefore, extensionDir].join(',')}`,
    `--load-extension=${[...installedBefore, extensionDir].join(',')}`,
    'about:blank',
  ];
  // Chrome takes its language from --lang; on Linux it needs the environment's language too. On macOS it takes it only
  // from the system's settings: there Chrome stays in the system's language.
  const env = language
    ? { ...process.env, LANGUAGE: language, LANG: `${language.replace('-', '_')}.UTF-8` }
    : process.env;
  const process_ = spawn(browserExecutable(browser), args, {
    env,
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
  });
  const sendToBrowser = browserPipe(process_);
  let output = '';
  process_.stderr?.on('data', (data) => {
    output += data.toString();
  });
  const exited = new Promise((resolve) => process_.once('exit', resolve));

  const portFile = join(profile, 'DevToolsActivePort');
  const started = Date.now();
  /** The port's two lines, once the browser has written them (on Windows the file is locked while it writes it). */
  const portLines = () => {
    try {
      const lines = readFileSync(portFile, 'utf8').split('\n');
      return lines.length >= 2 && lines[1] ? lines : undefined;
    } catch {
      return undefined;
    }
  };
  let lines = portLines();
  while (!lines) {
    const ended = process_.exitCode !== null || process_.signalCode !== null;
    if (ended || Date.now() - started > START_MS) {
      process_.kill();
      throw new Error(`The browser ${ended ? 'stopped' : "didn't start"}:\n${output}`);
    }
    await delay(50);
    lines = portLines();
  }
  const [port, path] = lines;
  const connected = await chromium.connectOverCDP(`ws://127.0.0.1:${port}${path}`, { noDefaults: true });
  const context = connected.contexts()[0];
  if (!context) throw new Error('The browser has no context to attach to.');

  // Closed as the browser closes itself (Browser.close): on Windows its other processes keep the profile's files open
  // a moment after the first one is stopped, and the profile couldn't be removed.
  async function close() {
    const session = await connected.newBrowserCDPSession().catch(() => undefined);
    await session?.send('Browser.close').catch(() => {});
    const closedInTime = await Promise.race([exited.then(() => true), delay(10_000).then(() => false)]);
    if (!closedInTime) {
      process_.kill();
      await exited;
    }
    await connected.close().catch(() => {});
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  return { context, close, closed: exited, pid: /** @type {number} */ (process_.pid), sendToBrowser };
}

/**
 * Sends DevTools commands to the browser on its pipe (--remote-debugging-pipe: messages in JSON, each ended by a null
 * character). Gives the command's result, or fails with its error.
 * @param {import('node:child_process').ChildProcess} browserProcess
 */
function browserPipe(browserProcess) {
  const toBrowser = /** @type {import('node:stream').Writable} */ (browserProcess.stdio[3]);
  const fromBrowser = /** @type {import('node:stream').Readable} */ (browserProcess.stdio[4]);
  /** @type {Map<number, { resolve: (result: any) => void, reject: (error: Error) => void }>} */
  const waiting = new Map();
  let received = '';
  let lastId = 0;
  fromBrowser.on('data', (data) => {
    received += data.toString();
    for (let end = received.indexOf('\0'); end >= 0; end = received.indexOf('\0')) {
      const message = JSON.parse(received.slice(0, end));
      received = received.slice(end + 1);
      const waiter = waiting.get(message.id);
      if (!waiter) continue;
      waiting.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
    }
  });
  // The browser closing: nothing more answers.
  fromBrowser.on('error', () => {});
  toBrowser.on('error', () => {});
  /** @type {(method: string, params?: object) => Promise<any>} */
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++lastId;
      waiting.set(id, { resolve, reject });
      toBrowser.write(`${JSON.stringify({ id, method, params })}\0`);
    });
}
