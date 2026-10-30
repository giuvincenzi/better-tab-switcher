import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings } from '../../lib/settings/settings';
import { saveSettings } from '../../lib/settings/store';

// The settings page as the extension opens it (entrypoints/options/main.tsx): the settings saved in the extension's
// storage, the shortcuts from the browser. The page opens once for this file, so the tests follow each other. A change
// saved at once, Restore and the browser's shortcuts page, on the real browser: tests/e2e/settings.spec.ts.
vi.mock('../../lib/messages', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

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

describe('the settings page of the extension', () => {
  beforeAll(async () => {
    fakeBrowser.reset();
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

  it('follows the settings changed elsewhere, and their theme', async () => {
    await saveSettings({ theme: 'light', view: 'grid' });
    await vi.waitFor(() => expect(root.dataset.theme).toBe('light'));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Previews shows a picture of each tab'));
    expect(document.body.textContent).not.toContain('Compact');
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
