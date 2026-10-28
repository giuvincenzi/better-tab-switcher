import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
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
  return { host, saved, handlers, setSettings };
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

  it('shows 6, 10 or 15 rows, or as many as fit the screen; 10 at first', () => {
    const { host, saved } = open();
    const rows = select(host, 'Tabs shown before scrolling');
    expect([...rows.options].map((option) => option.textContent)).toEqual(['6', '10', '15', 'Fit the screen']);
    expect(rows.value).toBe('10');
    change(rows, 'fit');
    change(rows, '15');
    expect(saved).toEqual([{ listRows: 'fit' }, { listRows: 15 }]);
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

  it('names the browser it runs in: Chrome, or Microsoft Edge in Edge', () => {
    const userAgent = vi.spyOn(Navigator.prototype, 'userAgent', 'get');
    const chrome =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
    for (const [agent, name] of [
      [chrome, 'Chrome'],
      [`${chrome} Edg/156.0.0.0`, 'Microsoft Edge'],
    ]) {
      userAgent.mockReturnValue(agent as string);
      const { host } = open();
      expect(texts(host)).toContain(`${name} doesn't let extensions use Ctrl+Tab.`);
      expect(toggle(host, `Use a window on ${name}'s pages`)).toBeTruthy();
      expect(texts(host)).toContain(
        `${name} doesn't let extensions into its own pages, like Settings, or into its web store.`,
      );
      dispose?.();
    }
    userAgent.mockRestore();
  });

  it('restores the default settings', () => {
    const { host, handlers } = open();
    const restore = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Restore');
    restore?.click();
    expect(handlers.onRestore).toHaveBeenCalled();
  });
});

/** Every setting with a valid value that is not its default, in the list (the grid has its own options). */
const notDefaults: Settings = {
  theme: 'dark',
  view: 'list',
  compact: false,
  listRows: 'fit',
  gridShow: 'icons',
  scope: 'all',
  showPinned: false,
  delayMs: 400,
  stayOpen: true,
  autoSelect: true,
  autoSelectSeconds: 7,
  toolbar: false,
  chromePagesWindow: false,
  details: {
    address: true,
    longAddress: 'scroll',
    pinnedIcon: false,
    audioIcon: false,
    sleeping: false,
    groupColor: false,
    lastUsed: true,
  },
};

/** Each switch of the page, by its label, with the setting it saves. */
const switches: [string, (settings: Settings) => boolean, (on: boolean) => SettingsChange][] = [
  ['Show toolbar', (s) => s.toolbar, (toolbar) => ({ toolbar })],
  ['Compact', (s) => s.compact, (compact) => ({ compact })],
  ['Show pinned tabs', (s) => s.showPinned, (showPinned) => ({ showPinned })],
  ['Stay open until you choose a tab', (s) => s.stayOpen, (stayOpen) => ({ stayOpen })],
  ["Use a window on Chrome's pages", (s) => s.chromePagesWindow, (chromePagesWindow) => ({ chromePagesWindow })],
  ['Auto-select', (s) => s.autoSelect, (autoSelect) => ({ autoSelect })],
  ['Website address', (s) => s.details.address, (address) => ({ details: { address } })],
  ['Pinned tab icon', (s) => s.details.pinnedIcon, (pinnedIcon) => ({ details: { pinnedIcon } })],
  ['Playing audio icon', (s) => s.details.audioIcon, (audioIcon) => ({ details: { audioIcon } })],
  ['Sleeping tabs', (s) => s.details.sleeping, (sleeping) => ({ details: { sleeping } })],
  ['Tab group color', (s) => s.details.groupColor, (groupColor) => ({ details: { groupColor } })],
  ['Last used', (s) => s.details.lastUsed, (lastUsed) => ({ details: { lastUsed } })],
];

const radio = (host: HTMLElement, value: string) => {
  const found = host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
  if (!found) throw new Error(`No option "${value}"`);
  return found;
};
const button = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll('button')].filter((element) => element.textContent === text);
const describedBy = (element: Element) =>
  document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;

describe('SettingsPage, every setting', () => {
  it('shows every setting as saved', () => {
    const { host } = open(notDefaults);
    for (const [label, value] of switches) {
      expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(value(notDefaults)));
    }
    expect(select(host, 'Theme').value).toBe('dark');
    expect(radio(host, 'list').checked).toBe(true);
    expect(select(host, 'Tabs shown before scrolling').value).toBe('fit');
    expect(select(host, 'Show tabs from').value).toBe('all');
    expect(number(host, 'Delay before the switcher appears').value).toBe('400');
    expect(number(host, 'Auto-select time').value).toBe('7');
    expect(select(host, 'Long website addresses').value).toBe('scroll');
  });

  it("shows the grid's choice as saved", () => {
    const { host } = open({ ...notDefaults, view: 'grid' });
    expect(radio(host, 'grid').checked).toBe(true);
    expect(radio(host, 'icons').checked).toBe(true);
    expect(radio(host, 'previews').checked).toBe(false);
  });

  it('saves each switch as its own setting and shows it changed', () => {
    for (const start of [defaultSettings, notDefaults]) {
      for (const [label, value, changeOf] of switches) {
        const { host, saved } = open(start);
        toggle(host, label).click();
        expect(saved, label).toEqual([changeOf(!value(start))]);
        expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(!value(start)));
        dispose?.();
      }
    }
  });

  it('saves each choice from a list as its own setting and shows it changed', () => {
    const { host, saved } = open({ details: { ...defaultSettings.details, address: true } });
    const choices: [string, string, SettingsChange][] = [
      ['Theme', 'light', { theme: 'light' }],
      ['Theme', 'dark', { theme: 'dark' }],
      ['Theme', 'device', { theme: 'device' }],
      ['Show tabs from', 'all', { scope: 'all' }],
      ['Tabs shown before scrolling', '6', { listRows: 6 }],
      ['Long website addresses', 'scroll', { details: { longAddress: 'scroll' } }],
    ];
    for (const [label, value, expected] of choices) {
      change(select(host, label), value);
      expect(saved.at(-1), label).toEqual(expected);
      expect(select(host, label).value, label).toBe(value);
    }
  });

  it('offers the themes and the windows in that order', () => {
    const { host } = open();
    const labels = (name: string) => [...select(host, name).options].map((option) => option.textContent);
    expect(labels('Theme')).toEqual(['Device theme', 'Light', 'Dark']);
    expect(labels('Show tabs from')).toEqual(['This window', 'All windows']);
    expect(labels('Long website addresses')).toEqual(['Cut short', 'Scroll']);
  });

  it("saves the grid's choice between previews and icons", () => {
    const { host, saved } = open({ view: 'grid' });
    radio(host, 'icons').click();
    expect(saved).toEqual([{ gridShow: 'icons' }]);
    radio(host, 'previews').click();
    expect(saved).toEqual([{ gridShow: 'icons' }, { gridShow: 'previews' }]);
  });

  it('goes back to the list and its options', () => {
    const { host, saved } = open({ view: 'grid' });
    radio(host, 'list').click();
    expect(saved).toEqual([{ view: 'list' }]);
    expect(toggle(host, 'Compact')).toBeTruthy();
    expect(texts(host)).not.toContain('Previews shows a picture of each tab');
  });

  it('saves the auto-select time', () => {
    const { host, saved } = open({ autoSelect: true });
    change(number(host, 'Auto-select time'), '7');
    expect(saved).toEqual([{ autoSelectSeconds: 7 }]);
  });

  it('shows the settings changed elsewhere, also in a field the user just changed', () => {
    const { host, setSettings } = open();
    const delay = number(host, 'Delay before the switcher appears');
    change(delay, '300');
    setSettings(notDefaults);
    for (const [label, value] of switches) {
      expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(value(notDefaults)));
    }
    expect(select(host, 'Theme').value).toBe('dark');
    expect(select(host, 'Tabs shown before scrolling').value).toBe('fit');
    expect(select(host, 'Show tabs from').value).toBe('all');
    expect(delay.value).toBe('400');
    expect(number(host, 'Auto-select time').disabled).toBe(false);
    // Restored elsewhere: the defaults again.
    setSettings({ ...defaultSettings });
    for (const [label, value] of switches) {
      expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(value(defaultSettings)));
    }
    expect(select(host, 'Theme').value).toBe('device');
    expect(delay.value).toBe('50');
    expect(number(host, 'Auto-select time').disabled).toBe(true);
  });

  it('shows the auto-select time and the long addresses faded while what they depend on is off', () => {
    const { host } = open();
    const row = (name: string) =>
      [...host.querySelectorAll('div[id]')].find((element) => element.textContent === name)?.parentElement
        ?.parentElement as HTMLElement;
    expect(Number(getComputedStyle(row('Auto-select time')).opacity)).toBeLessThan(1);
    expect(Number(getComputedStyle(row('Long website addresses')).opacity)).toBeLessThan(1);
    expect(Number(getComputedStyle(row('Delay before the switcher appears')).opacity)).toBe(1);
    toggle(host, 'Auto-select').click();
    toggle(host, 'Website address').click();
    expect(Number(getComputedStyle(row('Auto-select time')).opacity)).toBe(1);
    expect(Number(getComputedStyle(row('Long website addresses')).opacity)).toBe(1);
  });
});

describe('SettingsPage, number fields', () => {
  const delayName = 'Delay before the switcher appears';

  it('rounds a number with decimals to a whole one', () => {
    const { host, saved } = open();
    const delay = number(host, delayName);
    change(delay, '120.6');
    expect(saved).toEqual([{ delayMs: 121 }]);
    expect(delay.value).toBe('121');
  });

  it('takes a number below the lowest to the lowest, above the highest to the highest', () => {
    const { host, saved } = open({ autoSelect: true });
    change(number(host, delayName), '-20');
    const seconds = number(host, 'Auto-select time');
    change(seconds, '0');
    change(seconds, '60');
    expect(saved).toEqual([{ delayMs: 0 }, { autoSelectSeconds: 1 }, { autoSelectSeconds: 10 }]);
    expect(seconds.value).toBe('10');
  });

  it('goes back to the saved value when the field is left empty or with text', () => {
    const { host, saved } = open({ delayMs: 400 });
    const delay = number(host, delayName);
    for (const typed of ['', '   ', 'abc', 'e']) {
      change(delay, typed);
      expect(delay.value, JSON.stringify(typed)).toBe('400');
    }
    expect(saved).toEqual([]);
  });

  it('saves nothing when the number does not change', () => {
    const { host, saved } = open({ delayMs: 400 });
    const delay = number(host, delayName);
    change(delay, '400');
    change(delay, '400.2');
    expect(saved).toEqual([]);
    expect(delay.value).toBe('400');
  });

  it('saves a number typed when Enter is pressed', async () => {
    const { host, saved } = open();
    const delay = number(host, delayName);
    await userEvent.clear(delay);
    await userEvent.type(delay, '300');
    expect(saved).toEqual([]);
    await userEvent.keyboard('{Enter}');
    expect(saved).toEqual([{ delayMs: 300 }]);
  });

  it('saves a number typed when the field is left with Tab', async () => {
    const { host, saved } = open();
    const delay = number(host, delayName);
    await userEvent.clear(delay);
    await userEvent.type(delay, '75');
    await userEvent.tab();
    expect(saved).toEqual([{ delayMs: 75 }]);
  });

  it('can not be changed while it is turned off', async () => {
    const { host, saved } = open();
    const seconds = number(host, 'Auto-select time');
    expect(seconds.disabled).toBe(true);
    await userEvent.click(seconds, { force: true });
    await userEvent.keyboard('9{Enter}');
    expect(saved).toEqual([]);
  });
});

describe('SettingsPage, with the keyboard', () => {
  it('turns a switch on and off with Space and Enter', async () => {
    const { host, saved } = open();
    const compact = toggle(host, 'Compact');
    compact.focus();
    await userEvent.keyboard(' ');
    expect(saved).toEqual([{ compact: false }]);
    await userEvent.keyboard('{Enter}');
    expect(saved).toEqual([{ compact: false }, { compact: true }]);
    expect(compact.getAttribute('aria-checked')).toBe('true');
  });

  it('chooses the view with the arrow keys', async () => {
    const { host, saved } = open();
    radio(host, 'list').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(saved).toEqual([{ view: 'grid' }]);
    expect(radio(host, 'grid').checked).toBe(true);
  });

  it('chooses from a list with the arrow keys', async () => {
    const { host, saved } = open();
    select(host, 'Theme').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(saved).toEqual([{ theme: 'light' }]);
  });

  it('reaches the switches, lists and buttons with Tab, and skips the controls turned off', async () => {
    const { host } = open();
    const reached: Element[] = [];
    (host.querySelector('a') as HTMLElement).focus();
    for (let i = 0; i < 40 && host.contains(document.activeElement); i++) {
      reached.push(document.activeElement as Element);
      await userEvent.tab();
    }
    expect(reached).toContain(toggle(host, 'Compact'));
    expect(reached).toContain(select(host, 'Theme'));
    expect(reached).toContain(number(host, 'Delay before the switcher appears'));
    expect(reached).toContain(button(host, 'Restore')[0]);
    expect(reached).not.toContain(number(host, 'Auto-select time'));
    expect(reached).not.toContain(select(host, 'Long website addresses'));
  });
});

describe('SettingsPage, shortcuts and restore', () => {
  it('shows "Not set" for each shortcut the browser gives none', () => {
    const { host } = open({}, { next: '', previous: '' });
    expect([...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual(['Not set', 'Not set']);
  });

  it('shows the shortcuts as the browser writes them', () => {
    const { host } = open({}, { next: 'Ctrl+Shift+Comma', previous: '⌥⇧Y' });
    expect([...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual(['Ctrl+Shift+Comma', '⌥⇧Y']);
  });

  it('has a button to change each shortcut, named by its shortcut', () => {
    const { host, handlers } = open();
    const buttons = button(host, 'Change shortcut');
    expect(buttons.map(describedBy)).toEqual(['Next tab', 'Previous tab']);
    for (const element of buttons) element.click();
    expect(handlers.onChangeShortcut).toHaveBeenCalledTimes(2);
  });

  it('opens the guide in a new tab', () => {
    const { host } = open();
    const guide = host.querySelector('a[href="https://example.com/guide"]');
    expect(guide?.getAttribute('target')).toBe('_blank');
    expect(guide?.getAttribute('rel')).toContain('noopener');
  });

  it('has one Restore button, named by what it restores, that saves nothing itself', () => {
    const { host, saved, handlers } = open();
    const [restore, ...others] = button(host, 'Restore');
    expect(others).toEqual([]);
    expect(describedBy(restore as Element)).toBe('Restore default settings');
    restore?.click();
    expect(handlers.onRestore).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([]);
  });

  it('marks the section chosen in the sidebar', () => {
    const { host } = open();
    const links = [...host.querySelectorAll<HTMLAnchorElement>('nav a')];
    links.find((link) => link.textContent === 'Reset')?.click();
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, null, null, 'true']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#appearance',
      '#switching',
      '#details',
      '#shortcuts',
      '#reset',
    ]);
    for (const link of links) expect(host.querySelector(link.getAttribute('href') as string)).not.toBeNull();
  });
});
