// Development build: WXT builds the extension and rebuilds it on every change; this script opens it in Playwright's
// Chromium with a fresh browser profile. Closing the browser or pressing Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

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

const profile = mkdtempSync(join(tmpdir(), 'better-tab-switcher-dev-'));
const browser = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: null,
  args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
});

async function stop() {
  await browser.close().catch(() => {});
  wxt.kill('SIGINT');
  await wxtExited;
  rmSync(profile, { recursive: true, force: true });
  process.exit(0);
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
browser.once('close', stop);

const page = browser.pages()[0] ?? (await browser.newPage());
await page.goto('chrome://extensions');
