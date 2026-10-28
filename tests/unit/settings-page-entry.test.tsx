import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { shortcutsPageUrl } from '../../lib/browser';
import { defaultSettings } from '../../lib/settings/settings';
import { loadSettings, saveSettings } from '../../lib/settings/store';

// The settings page as the extension opens it (entrypoints/options/main.tsx): the settings saved in the extension's
// storage, the shortcuts from the browser. The page opens once for this file, so the tests follow each other.

const shortcuts = vi.fn(async () => [
  { name: 'next-tab', shortcut: 'Alt+Y' },
  { name: 'previous-tab', shortcut: '' },
]);
const root = document.documentElement;

function control<T extends HTMLElement>(selector: string, name: string): T {
  const found = [...document.querySelectorAll<T>(selector)].find((element) => {
    const label = element.getAttribute('aria-labelledby');
    return label && document.getElementById(label)?.textContent === name;
  });
  if (!found) throw new Error(`No ${selector} named "${name}"`);
  return found;
}
const toggle = (name: string) => control<HTMLButtonElement>('[role="switch"]', name);
const keys = () => [...document.querySelectorAll('kbd')].map((kbd) => kbd.textContent);
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((element) => element.textContent === text) as HTMLButtonElement;

describe('the settings page of the extension', () => {
  beforeAll(async () => {
    fakeBrowser.reset();
    (fakeBrowser.commands as { getAll: unknown }).getAll = shortcuts;
    await saveSettings({ theme: 'dark', compact: false });
    const host = document.createElement('div');
    host.id = 'settings';
    document.body.append(host);
    await import('../../entrypoints/options/main');
  });

  it('opens with the saved settings, their theme and the shortcuts the browser gives', () => {
    expect(root.dataset.theme).toBe('dark');
    expect(toggle('Compact').getAttribute('aria-checked')).toBe('false');
    expect(toggle('Show toolbar').getAttribute('aria-checked')).toBe('true');
    expect(keys()).toEqual(['Alt+Y', 'Not set']);
    expect(document.title).toBe('Better Tab Switcher settings');
  });

  it('saves a change at once', async () => {
    toggle('Show toolbar').click();
    await vi.waitFor(async () => expect((await loadSettings()).toolbar).toBe(false));
    expect((await loadSettings()).theme).toBe('dark');
  });

  it('follows the settings changed elsewhere, and their theme', async () => {
    await saveSettings({ theme: 'light', view: 'grid' });
    await vi.waitFor(() => expect(root.dataset.theme).toBe('light'));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Previews shows a picture of each tab'));
    expect(document.body.textContent).not.toContain('Compact');
  });

  it('restores the defaults: nothing saved, the page and its theme as at the first install', async () => {
    button('Restore').click();
    await vi.waitFor(async () => expect(await fakeBrowser.storage.local.get('settings')).toEqual({}));
    await vi.waitFor(() => expect(root.dataset.theme).toBe(defaultSettings.theme));
    await vi.waitFor(() => expect(toggle('Compact').getAttribute('aria-checked')).toBe('true'));
    expect(toggle('Show toolbar').getAttribute('aria-checked')).toBe('true');
  });

  it("opens the browser's page of the shortcuts to change one", async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    for (const change of document.querySelectorAll('button')) {
      if (change.textContent === 'Change shortcut') change.click();
    }
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledWith({ url: shortcutsPageUrl() });
    create.mockRestore();
  });

  it('shows the shortcuts changed meanwhile when the page is back in front', async () => {
    shortcuts.mockResolvedValue([
      { name: 'previous-tab', shortcut: 'Alt+Shift+Y' },
      { name: 'next-tab', shortcut: 'Ctrl+Q' },
    ]);
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(keys()).toEqual(['Ctrl+Q', 'Alt+Shift+Y']));
  });
});
