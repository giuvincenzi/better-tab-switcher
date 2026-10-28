import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../components/settings/SettingsPage';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});

/** The page with the settings kept in memory, as the settings page keeps them in storage. */
function open(start: Partial<Settings> = {}, shortcuts = { next: 'Alt+Y', previous: 'Alt+Shift+Y' }) {
  const [settings, setSettings] = createSignal<Settings>({ ...defaultSettings, ...start });
  const saved: SettingsChange[] = [];
  const save = (change: SettingsChange) => {
    saved.push(change);
    setSettings((now) => ({ ...now, ...change, details: { ...now.details, ...change.details } }));
  };
  const handlers = { onChangeShortcut: vi.fn(), onRestore: vi.fn() };
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <SettingsPage
        settings={settings()}
        save={save}
        shortcuts={shortcuts}
        language="en"
        now={Date.UTC(2026, 9, 28, 12)}
        iconUrl=""
        guideUrl="https://example.com/guide"
        {...handlers}
      />
    ),
    host,
  );
  return { host, saved, handlers };
}

/** A control by the text that names it. */
function control<T extends HTMLElement>(host: HTMLElement, selector: string, name: string): T {
  const found = [...host.querySelectorAll<T>(selector)].find((element) => {
    const label = element.getAttribute('aria-labelledby');
    return label && document.getElementById(label)?.textContent === name;
  });
  if (!found) throw new Error(`No ${selector} named "${name}"`);
  return found;
}

const toggle = (host: HTMLElement, name: string) => control<HTMLButtonElement>(host, '[role="switch"]', name);
const select = (host: HTMLElement, name: string) => control<HTMLSelectElement>(host, 'select', name);
const number = (host: HTMLElement, name: string) => control<HTMLInputElement>(host, 'input[type="number"]', name);
const texts = (host: HTMLElement) => host.textContent ?? '';

function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SettingsPage', () => {
  it('has the sections in its sidebar, the first one marked', () => {
    const { host } = open();
    const links = [...host.querySelectorAll('nav a')];
    expect(links.map((link) => link.textContent)).toEqual([
      'Appearance',
      'Switching',
      'Tab details',
      'Keyboard shortcuts',
      'Reset',
    ]);
    expect(links[0]?.getAttribute('aria-current')).toBe('true');
  });

  it("shows the list's options for the list, the grid's for the grid", () => {
    const { host, saved } = open();
    expect(texts(host)).toContain('Tabs shown before scrolling');
    expect(texts(host)).not.toContain('Previews shows a picture of each tab');
    const grid = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
      (radio) => radio.value === 'grid',
    );
    grid?.click();
    expect(saved).toContainEqual({ view: 'grid' });
    expect(texts(host)).toContain('Previews shows a picture of each tab');
    expect(texts(host)).not.toContain('Compact');
    expect(texts(host)).not.toContain('Tabs shown before scrolling');
  });

  it('saves a switch at once', () => {
    const { host, saved } = open();
    const compact = toggle(host, 'Compact');
    expect(compact.getAttribute('aria-checked')).toBe('true');
    compact.click();
    expect(saved).toEqual([{ compact: false }]);
    expect(compact.getAttribute('aria-checked')).toBe('false');
  });

  it("chooses the list's width", () => {
    const { host, saved } = open();
    const large = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.value === 'large');
    large?.click();
    expect(saved).toEqual([{ listWidth: 'large' }]);
  });

  it('saves a tab detail on its own', () => {
    const { host, saved } = open();
    toggle(host, 'Last used').click();
    expect(saved).toEqual([{ details: { lastUsed: true } }]);
  });

  it('keeps numbers within their limits', () => {
    const { host, saved } = open();
    const delay = number(host, 'Delay before the switcher appears');
    change(delay, '5000');
    expect(saved).toEqual([{ delayMs: 1000 }]);
    expect(delay.value).toBe('1000');
    change(delay, '');
    expect(delay.value).toBe('1000');
    expect(saved).toHaveLength(1);
  });

  it('shows up to 12 rows, or as many as fit the screen', () => {
    const { host, saved } = open();
    const rows = select(host, 'Tabs shown before scrolling');
    expect([...rows.options].map((option) => option.textContent).slice(-2)).toEqual(['12', 'Fit the screen']);
    change(rows, 'fit');
    change(rows, '12');
    expect(saved).toEqual([{ listRows: 'fit' }, { listRows: 12 }]);
  });

  it('turns on the auto-select time only with Auto-select', () => {
    const { host } = open();
    expect(number(host, 'Auto-select time').disabled).toBe(true);
    toggle(host, 'Auto-select').click();
    expect(number(host, 'Auto-select time').disabled).toBe(false);
  });

  it('turns on the long addresses choice only with the website address', () => {
    const { host } = open();
    expect(select(host, 'Long website addresses').disabled).toBe(true);
    toggle(host, 'Website address').click();
    expect(select(host, 'Long website addresses').disabled).toBe(false);
  });

  it('writes the units and the example in the language in use', () => {
    const { host } = open();
    expect(texts(host)).toContain('ms');
    expect(texts(host)).toContain('For example, 15 min. ago.');
  });

  it('shows the shortcuts, and opens the page to change them', () => {
    const { host, handlers } = open({}, { next: 'Alt+Y', previous: '' });
    const keys = [...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent);
    expect(keys).toEqual(['Alt+Y', 'Not set']);
    [...host.querySelectorAll('button')].find((button) => button.textContent === 'Change shortcut')?.click();
    expect(handlers.onChangeShortcut).toHaveBeenCalled();
    expect(host.querySelector('a[href="https://example.com/guide"]')?.textContent).toBe('How to use Ctrl+Tab');
  });

  it('restores the default settings', () => {
    const { host, handlers } = open();
    const restore = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Restore');
    restore?.click();
    expect(handlers.onRestore).toHaveBeenCalled();
  });
});
