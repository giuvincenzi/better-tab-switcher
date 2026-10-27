import { readFileSync } from 'node:fs';
import type { browser } from 'wxt/browser';
import { expect, test } from './fixtures';

/** The extension APIs, inside code evaluated in the extension's service worker. */
declare const chrome: typeof browser;

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test.describe('extension @setup', () => {
  test('starts its service worker', async ({ serviceWorker, extensionId }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    expect(serviceWorker.url()).toBe(`chrome-extension://${extensionId}/background.js`);
  });

  test('has the version of package.json', async ({ serviceWorker }) => {
    const version = await serviceWorker.evaluate(() => chrome.runtime.getManifest().version);
    expect(version).toBe(pkg.version);
  });
});
