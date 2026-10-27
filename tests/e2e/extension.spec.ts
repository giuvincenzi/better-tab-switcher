import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

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

  test('is named Better Tab Switcher', async ({ serviceWorker }) => {
    const name = await serviceWorker.evaluate(() => chrome.i18n.getMessage('Extension_Name'));
    expect(name).toBe('Better Tab Switcher');
  });

  test('has the next and previous tab shortcuts', async ({ serviceWorker }) => {
    const commands = await serviceWorker.evaluate(() => chrome.commands.getAll());
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'next-tab',
          shortcut: 'Alt+Y',
          description: 'Open the switcher on the next tab',
        }),
        expect.objectContaining({
          name: 'previous-tab',
          shortcut: 'Alt+Shift+Y',
          description: 'Open the switcher on the previous tab',
        }),
      ]),
    );
  });
});
