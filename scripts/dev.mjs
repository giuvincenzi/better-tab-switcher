// Development build: WXT builds the extension and rebuilds it on every change; this script opens it in Playwright's
// Chromium with a fresh browser profile, as a user runs it (scripts/real-browser.mjs: nothing emulated, the focus and
// the system's theme are the real ones). Closing the browser or pressing Ctrl+C stops both.
// --tabs=N (1 to 100, `make dev tabs=N`) also opens N tabs of real sites, one after the other, to try the switcher.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { launchRealBrowser } from './real-browser.mjs';

/** Varied public sites: their icons, pages and dialogs are what the switcher meets. Repeated to reach N tabs. */
const SITES = [
  'https://en.wikipedia.org/wiki/Tab_(interface)',
  'https://github.com/',
  'https://developer.mozilla.org/',
  'https://developer.chrome.com/docs/extensions',
  'https://www.youtube.com/',
  'https://news.ycombinator.com/',
  'https://www.bbc.com/news',
  'https://stackoverflow.com/questions',
  'https://www.reddit.com/',
  'https://www.google.com/maps',
  'https://www.amazon.com/',
  'https://www.theguardian.com/international',
  'https://weather.com/',
  'https://www.imdb.com/',
  'https://open.spotify.com/',
  'https://www.figma.com/',
  'https://www.notion.com/',
  'https://web.dev/',
  'https://www.w3.org/',
  'https://www.npmjs.com/',
  'https://vite.dev/',
  'https://www.solidjs.com/',
  'https://wxt.dev/',
  'https://www.typescriptlang.org/',
  'https://www.wikipedia.org/',
];
const MAX_TABS = 100;

const tabsArgument = process.argv.find((argument) => argument.startsWith('--tabs='));
const tabs = tabsArgument === undefined ? 0 : Number(tabsArgument.slice('--tabs='.length));
if (tabsArgument !== undefined && (!Number.isInteger(tabs) || tabs < 1 || tabs > MAX_TABS)) {
  console.error(`tabs must be a whole number from 1 to ${MAX_TABS}: make dev tabs=10`);
  process.exit(1);
}

const extensionDir = resolve('.output/chrome-mv3-dev');
const manifest = join(extensionDir, 'manifest.json');

if (!existsSync(chromium.executablePath())) {
  console.error("Playwright's Chromium is not installed. Install it with: npx playwright install chromium");
  process.exit(1);
}

rmSync(extensionDir, { recursive: true, force: true });
const wxt = spawn('npx', ['wxt'], { stdio: 'inherit' });
const wxtExited = new Promise((done) => wxt.once('exit', done));

while (!existsSync(manifest)) {
  if (wxt.exitCode !== null) process.exit(wxt.exitCode);
  await delay(100);
}

const { context: browser, close, closed } = await launchRealBrowser({ extensionDir, headless: false });

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await close();
  wxt.kill('SIGINT');
  await wxtExited;
  process.exit(0);
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
void closed.then(stop);

const page = browser.pages()[0] ?? (await browser.newPage());
await page.goto('chrome://extensions');

// One after the other, so the switcher lists them most recently used first. A site that doesn't answer stays as it is.
for (let i = 0; i < tabs; i++) {
  const tab = await browser.newPage();
  await tab.goto(SITES[i % SITES.length] ?? '', { waitUntil: 'commit' }).catch(() => undefined);
}
