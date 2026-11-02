// The browser as a user runs it, for the end-to-end tests (tests/e2e/fixtures.ts) and make dev (scripts/dev.mjs): we
// start it, then Playwright attaches to it with noDefaults, so it emulates nothing (no fake focus, no color scheme nor
// reduced motion of its own): what the tests and the developer see is what users see.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

/**
 * How long each step of starting the browser may take: opening its DevTools port, then Playwright attaching to it. A
 * step that hangs fails saying which, with what the browser wrote, inside the time the tests give the browser to start
 * (tests/e2e/fixtures.ts), never the test's own. Microsoft Edge on GitHub's Windows machines, with a fresh profile, once
 * answered Playwright's first question only after 15 s (busy starting: nothing in its output for 14 s); as for its
 * extensions' start (the user's choice), it is waited for longer: 60 s.
 */
const STEP_MS = 60_000;

/**
 * For the tests, Microsoft Edge without the services it runs by itself (quietEdge): with a fresh profile on GitHub's
 * Windows machines it started the extension after 50 s and loaded the tests' first page 31 s late, its CPU idle (1.9 s
 * in 85 s), waiting. The switches Playwright gives the browsers it starts that turn off background services (updates,
 * network requests of its own, forced sign-in, its relaunch on Windows that loses DevTools), none that changes what a
 * page or the extension does. Chromium, which has none of Microsoft's services, starts as a user's.
 */
const EDGE_QUIET_SWITCHES = [
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-edgeupdater',
  '--disable-updater-scheduler',
  '--no-service-autorun',
  '--edge-skip-compat-layer-relaunch',
];
const EDGE_QUIET_FEATURES = [
  'OptimizationHints',
  'NetworkTimeServiceQuerying',
  'AimEnabled',
  'msForceBrowserSignIn',
  'msEdgeUpdateLaunchServicesPreferredVersion',
];

/**
 * Starts the browser with the extension in `extensionDir`, in a new profile, and attaches Playwright to it;
 * `installedBefore`, other extensions installed before it (the first ones get the keys they ask for). `language`
 * is Chrome's own language (--lang, on Linux the environment's too, on macOS its app's preferences: macLanguage),
 * `dark` the system's dark mode, `reducedMotion` the system's "reduce motion" on or off (the system's own setting when
 * not given); `windowSize` the first window's size; `siteRules`, for the tests, the test sites' server (tests/e2e/site.ts):
 * every *.test site goes to its port on this machine, down.test is a site that can't be found, and the server's
 * certificate (the hash of its public key) is the one trusted besides the usual ones; `quietEdge`, for the tests,
 * Microsoft Edge without the services it runs by itself (EDGE_QUIET_SWITCHES). Returns its one browser context,
 * close(), its process (pid) and sendToBrowser (browserPipe).
 * @param {{ browser?: string, extensionDir: string, installedBefore?: string[], headless?: boolean, language?: string,
 *   dark?: boolean, reducedMotion?: boolean, windowSize?: string,
 *   siteRules?: { port: number, certificate: string }, quietEdge?: boolean }} options
 * @returns {Promise<{ context: import('@playwright/test').BrowserContext, close: () => Promise<void>,
 *   closed: Promise<string>, pid: number, sendToBrowser: (method: string, params?: object) => Promise<any>,
 *   output: () => string }>}
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
  siteRules,
  quietEdge = false,
}) {
  const disabledFeatures = [
    // On Windows, Chrome pauses the pages of a window it thinks other windows cover. A machine with no screen of its own
    // (GitHub's) makes it think so of a window in plain sight, whose pages then never load: as Playwright does, Chrome
    // doesn't look for covered windows there.
    ...(process.platform === 'win32' ? ['CalculateNativeWinOcclusion'] : []),
    ...(quietEdge && browser === 'msedge' ? EDGE_QUIET_FEATURES : []),
  ];
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
    // Chrome takes only the last --disable-features: one for all.
    ...(disabledFeatures.length > 0 ? [`--disable-features=${disabledFeatures.join(',')}`] : []),
    ...(quietEdge && browser === 'msedge' ? EDGE_QUIET_SWITCHES : []),
    ...(headless ? ['--headless'] : []),
    ...(language ? [`--lang=${language}`] : []),
    ...(dark ? ['--force-dark-mode'] : []),
    // Unless told, the system's own setting (the macOS machines of GitHub ask for less motion).
    ...(reducedMotion === undefined
      ? []
      : [reducedMotion ? '--force-prefers-reduced-motion' : '--force-prefers-no-reduced-motion']),
    ...(windowSize ? [`--window-size=${windowSize}`] : []),
    // The first rule that matches a host applies: down.test can't be found, as a site that is down.
    ...(siteRules
      ? [
          `--host-resolver-rules=MAP down.test ~NOTFOUND, MAP *.test 127.0.0.1:${siteRules.port}`,
          `--ignore-certificate-errors-spki-list=${siteRules.certificate}`,
        ]
      : []),
    `--disable-extensions-except=${[...installedBefore, extensionDir].join(',')}`,
    `--load-extension=${[...installedBefore, extensionDir].join(',')}`,
    'about:blank',
  ];
  // Chrome takes its language from --lang; on Linux it needs the environment's language too; on macOS from its app's
  // preferences (macLanguage).
  const env = language
    ? { ...process.env, LANGUAGE: language, LANG: `${language.replace('-', '_')}.UTF-8` }
    : process.env;
  const forgetLanguage = macLanguage(browser, language);
  const process_ = spawn(browserExecutable(browser), args, {
    env,
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    // On macOS and Linux a process group of its own, so its pages' processes can be stopped with it (stopTree).
    detached: process.platform !== 'win32',
  });
  const sendToBrowser = browserPipe(process_);
  let output = '';
  process_.stderr?.on('data', (data) => {
    output += data.toString();
  });
  /** Once the browser's process has ended: how (its exit code, or the signal that stopped it). */
  const exited = new Promise((resolve) =>
    process_.once('exit', (code, signal) => resolve(signal ? `stopped by ${signal}` : `exit code ${code}`)),
  );

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
    if (ended || Date.now() - started > STEP_MS) {
      process_.kill();
      forgetLanguage?.();
      throw new Error(
        `The browser ${ended ? 'stopped' : `didn't open its DevTools port within ${STEP_MS} ms`}:\n${output}`,
      );
    }
    await delay(50);
    lines = portLines();
  }
  const [port, path] = lines;
  const connected = await chromium
    .connectOverCDP(`ws://127.0.0.1:${port}${path}`, { noDefaults: true, timeout: STEP_MS })
    .catch((error) => {
      process_.kill();
      forgetLanguage?.();
      throw new Error(`Playwright didn't attach to the browser within ${STEP_MS} ms (${error.message}):\n${output}`);
    });
  const context = connected.contexts()[0];
  if (!context) throw new Error('The browser has no context to attach to.');

  // Closed as the browser closes itself (Browser.close): on Windows its other processes keep the profile's files open
  // a moment after the first one is stopped, and the profile couldn't be removed.
  async function close() {
    const session = await connected.newBrowserCDPSession().catch(() => undefined);
    await session?.send('Browser.close').catch(() => {});
    const closedInTime = await Promise.race([exited.then(() => true), delay(10_000).then(() => false)]);
    if (!closedInTime) {
      stopTree(/** @type {number} */ (process_.pid));
      await exited;
    }
    await connected.close().catch(() => {});
    forgetLanguage?.();
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  return {
    context,
    close,
    closed: exited,
    pid: /** @type {number} */ (process_.pid),
    sendToBrowser,
    output: () => output,
  };
}

/**
 * Chrome on macOS takes its language from its app's preferred languages, never from --lang: they are written in the
 * app's own preferences (defaults, under its bundle's id) before it starts, and removed once it is closed: the
 * system's settings and the other apps stay as they are. Playwright's Chromium is an app only the tests use. Microsoft
 * Edge on a developer's Mac is their own browser: its preferences are written only on GitHub's machines (CI), which are
 * thrown away after the job; elsewhere it keeps the system's language (the language tests skip it there). Returns how to
 * remove them, or nothing when none were written.
 * @param {string} browser
 * @param {string | undefined} language
 */
function macLanguage(browser, language) {
  if (process.platform !== 'darwin' || !language || (browser === 'msedge' && !process.env.CI)) return undefined;
  // The executable is in <app>.app/Contents/MacOS/; the bundle's id in <app>.app/Contents/Info.plist.
  const info = join(dirname(dirname(browserExecutable(browser))), 'Info.plist');
  const app = execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', info], { encoding: 'utf8' }).trim();
  execFileSync('defaults', ['write', app, 'AppleLanguages', '-array', language]);
  return () => spawnSync('defaults', ['delete', app, 'AppleLanguages']);
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

/**
 * Stops a browser that didn't close by itself, with every process it started (its pages': hundreds with hundreds of
 * tabs). Stopping only the first one leaves the others running on Windows, and they slowed the next tests down to a
 * stop (30 s to start a browser).
 * @param {number} pid
 */
function stopTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
  else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}
