import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { shortcutsPageUrl } from '../../lib/browser';
import { listenToSettingsChanges } from '../../lib/settings/service';
import { defaultSettings } from '../../lib/settings/settings';
import { loadSettings, saveSettings } from '../../lib/settings/store';

// The settings page as the extension opens it (entrypoints/options/main.tsx): the settings saved in the extension's
// storage, the shortcuts from the browser. The page opens once for this file, so the tests follow each other. Its
// messages go to the background's settings service, as in the extension (the fake browser carries no messages).
const messages = await vi.hoisted(async () => (await import('./background-world')).fakeMessages());
vi.mock('../../lib/messages', () => ({ sendMessage: messages.sendMessage, onMessage: messages.onMessage }));

const shortcuts = vi.fn(async () => [
  { name: 'next-tab', shortcut: 'Alt+S' },
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
    listenToSettingsChanges();
    messages.state.receive = async (type, data) => {
      await messages.ask(type, data);
    };
    (fakeBrowser.commands as { getAll: unknown }).getAll = shortcuts;
    await saveSettings({ theme: 'dark', compact: true, details: { ...defaultSettings.details, lastUsed: false } });
    const host = document.createElement('div');
    host.id = 'settings';
    document.body.append(host);
    await import('../../entrypoints/options/main');
  });

  it('opens with the saved settings, their theme and the shortcuts the browser gives', () => {
    expect(root.dataset.theme).toBe('dark');
    expect(toggle('Compact').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Last used').getAttribute('aria-checked')).toBe('false');
    expect(toggle('Show toolbar').getAttribute('aria-checked')).toBe('true');
    expect(keys()).toEqual(['Alt+S', 'Not set', 'Not set']);
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
    // The confirmation's own Restore.
    (
      [...(document.querySelector('dialog[open]') as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent === 'Restore',
      ) as HTMLButtonElement
    ).click();
    await vi.waitFor(async () => expect(await fakeBrowser.storage.local.get('settings')).toEqual({}));
    await vi.waitFor(() => expect(root.dataset.theme).toBe(defaultSettings.theme));
    await vi.waitFor(() => expect(toggle('Compact').getAttribute('aria-checked')).toBe('false'));
    expect(toggle('Show toolbar').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Website address').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Full address').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Last used').getAttribute('aria-checked')).toBe('true');
  });

  it("opens the browser's page of the shortcuts to change one", async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    for (const change of document.querySelectorAll('button')) {
      if (change.textContent === 'Change shortcut') change.click();
    }
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create).toHaveBeenCalledWith({ url: shortcutsPageUrl() });
    create.mockRestore();
  });

  it('shows the shortcuts changed meanwhile when the page is back in front', async () => {
    shortcuts.mockResolvedValue([
      { name: '_execute_action', shortcut: 'Alt+K' },
      { name: 'previous-tab', shortcut: 'Alt+Shift+S' },
      { name: 'next-tab', shortcut: 'Ctrl+Q' },
    ]);
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(keys()).toEqual(['Ctrl+Q', 'Alt+Shift+S', 'Alt+K']));
  });
});
