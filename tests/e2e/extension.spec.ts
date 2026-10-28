import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { defaultShortcuts, shortcutText } from './helpers';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test.describe('extension @setup', () => {
  test('asks at install only for what it needs, and for no site', () => {
    // The published build (.output/chrome-mv3): the test build adds the permission for all sites (wxt.config.ts).
    const manifest = JSON.parse(readFileSync('.output/chrome-mv3/manifest.json', 'utf8'));
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.permissions.sort()).toEqual(
      ['activeTab', 'favicon', 'scripting', 'storage', 'tabGroups', 'tabs'].sort(),
    );
  });

  test('starts its service worker', async ({ serviceWorker, extensionId }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    expect(serviceWorker.url()).toBe(`chrome-extension://${extensionId}/background.js`);
  });

  test('has the version of package.json', async ({ serviceWorker }) => {
    const version = await serviceWorker.evaluate(() => chrome.runtime.getManifest().version);
    expect(version).toBe(pkg.version);
  });

  test('is named Better Tab Switcher', async ({ serviceWorker }) => {
    const name = await serviceWorker.evaluate(() => chrome.i18n.getMessage('Extension_Name'));
    expect(name).toBe('Better Tab Switcher');
  });

  test('gives the next and previous tab shortcuts their default keys', async ({ serviceWorker }) => {
    const commands = await serviceWorker.evaluate(() => chrome.commands.getAll());
    const defaults = await defaultShortcuts(serviceWorker);
    for (const [name, expected] of [
      ['next-tab', defaults.next],
      ['previous-tab', defaults.previous],
    ]) {
      expect(expected).toBeTruthy();
      expect(commands.find((c) => c.name === name)?.shortcut).toBe(shortcutText(expected as string));
    }
    expect(commands.find((c) => c.name === 'next-tab')?.description).toBe('Open the switcher on the next tab');
    expect(commands.find((c) => c.name === 'previous-tab')?.description).toBe('Open the switcher on the previous tab');
  });
});
