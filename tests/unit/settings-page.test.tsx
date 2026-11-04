import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SettingsPage, type SettingsPageProps } from '../../components/settings/SettingsPage';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  // The section chosen is in the page's address: each test starts without one.
  history.replaceState(null, '', location.pathname + location.search);
});

/** The page with the settings kept in memory, as the settings page keeps them in storage. */
function open(
  start: Partial<Settings> = {},
  shortcuts = { next: 'Alt+S', previous: 'Alt+Shift+S', icon: '' },
  askShortcuts = false,
  more: Partial<SettingsPageProps> = {},
) {
  const [settings, setSettings] = createSignal<Settings>({ ...defaultSettings, ...start });
  const saved: SettingsChange[] = [];
  const save = (change: SettingsChange) => {
    saved.push(change);
    setSettings((now) => ({ ...now, ...change, details: { ...now.details, ...change.details } }));
  };
  const handlers = { onChangeShortcut: vi.fn(), onRestore: vi.fn(), onManageExtension: vi.fn() };
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <SettingsPage
        settings={settings()}
        save={save}
        shortcuts={shortcuts}
        askShortcuts={askShortcuts}
        language="en"
        now={Date.UTC(2026, 9, 28, 12)}
        iconUrl=""
        guideUrl="https://example.com/guide"
        version="1.2.0"
        extensionPage="chrome://extensions/?id=abc"
        {...handlers}
        {...more}
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

/** Whether the user sees it: it, its row and its section are shown. */
const shown = (element: Element) => element.checkVisibility();

/** Chooses a section in the sidebar, by its name. */
function choose(host: HTMLElement, name: string) {
  const link = [...host.querySelectorAll<HTMLAnchorElement>('nav a')].find((element) => element.textContent === name);
  if (!link) throw new Error(`No section "${name}"`);
  link.click();
}

/** Types in the search field (the whole text at once, as a paste). */
function search(host: HTMLElement, text: string) {
  const field = host.querySelector<HTMLInputElement>('input[type="search"]') as HTMLInputElement;
  field.value = text;
  field.dispatchEvent(new InputEvent('input', { bubbles: true }));
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
      'System',
      'About',
    ]);
    expect(links[0]?.getAttribute('aria-current')).toBe('page');
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
    expect(compact.getAttribute('aria-checked')).toBe('false');
    compact.click();
    expect(saved).toEqual([{ compact: true }]);
    expect(compact.getAttribute('aria-checked')).toBe('true');
  });

  it('saves a tab detail on its own', () => {
    const { host, saved } = open();
    toggle(host, 'Last used').click();
    expect(saved).toEqual([{ details: { lastUsed: false } }]);
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

  it('shows the auto-select time only with Auto-select, under it', () => {
    const { host } = open();
    choose(host, 'Switching');
    expect(shown(number(host, 'Auto-select time'))).toBe(false);
    toggle(host, 'Auto-select').click();
    const seconds = number(host, 'Auto-select time');
    expect(shown(seconds)).toBe(true);
    expect(seconds.disabled).toBe(false);
    toggle(host, 'Auto-select').click();
    expect(shown(seconds)).toBe(false);
  });

  it('shows Full address and the long addresses choice only with the website address', () => {
    const { host, saved } = open();
    choose(host, 'Tab details');
    expect(shown(toggle(host, 'Full address'))).toBe(true);
    expect(shown(select(host, 'Long website addresses'))).toBe(true);
    toggle(host, 'Website address').click();
    expect(shown(toggle(host, 'Full address'))).toBe(false);
    expect(shown(select(host, 'Long website addresses'))).toBe(false);
    expect(toggle(host, 'Full address').disabled).toBe(true);
    toggle(host, 'Full address').click();
    expect(saved).toEqual([{ details: { address: false } }]);
    toggle(host, 'Website address').click();
    expect(shown(toggle(host, 'Full address'))).toBe(true);
    expect(toggle(host, 'Full address').disabled).toBe(false);
    expect(select(host, 'Long website addresses').disabled).toBe(false);
  });

  it('indents the settings that depend on another one under it, in the same block', () => {
    const { host } = open({ autoSelect: true });
    choose(host, 'Switching');
    const row = (element: Element) => element.closest('[class*="row"]') as HTMLElement;
    const main = row(toggle(host, 'Auto-select'));
    const seconds = row(number(host, 'Auto-select time'));
    expect(main.parentElement).toBe(seconds.parentElement);
    const start = (element: HTMLElement) => Number.parseFloat(getComputedStyle(element).paddingInlineStart);
    expect(start(seconds)).toBeGreaterThan(start(main));
    // No line between them: one block.
    expect(getComputedStyle(seconds).borderTopStyle).toBe('none');
  });

  it('lists the tab details in their order: the icons, the last used time, New, Copy address, then the address and its two settings', () => {
    const { host } = open();
    const labels = [...host.querySelectorAll('#details [aria-labelledby]')].map(
      (element) => document.getElementById(element.getAttribute('aria-labelledby') ?? '')?.textContent,
    );
    expect(labels).toEqual([
      'Pinned tab icon',
      'Playing audio icon',
      'Inactive tabs',
      'Tab group color',
      'Last used',
      'Tabs not opened yet',
      'Copy address button',
      'Website address',
      'Full address',
      'Long website addresses',
    ]);
  });

  it('explains Tabs not opened yet with the label the switcher shows, and Copy address button, under their names', () => {
    const { host } = open();
    expect(describedBy(toggle(host, 'Tabs not opened yet'))).toBe(
      'Tabs opened in the background show “New” until you open them.',
    );
    expect(describedBy(toggle(host, 'Copy address button'))).toBe(
      'A button on the tab under the mouse copies its website address.',
    );
  });

  it('explains Full address and the long addresses choice under their names', () => {
    const { host } = open();
    expect(describedBy(toggle(host, 'Full address'))).toBe('The whole address of the page, not only the site.');
    expect(describedBy(select(host, 'Long website addresses'))).toBe(
      'Scrolling on the selected tab and on the one under the mouse to show them whole, or cut short with “…”.',
    );
  });

  it('writes the units and the example in the language in use', () => {
    const { host } = open();
    expect(texts(host)).toContain('ms');
    expect(texts(host)).toContain('For example, 15 min. ago.');
  });

  it('shows the shortcuts, and opens the page to change them', () => {
    const { host, handlers } = open({}, { next: 'Alt+S', previous: '', icon: '' });
    const keys = [...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent);
    expect(keys).toEqual(['Alt+S', 'Not set', 'Not set']);
    [...host.querySelectorAll('button')].find((button) => button.textContent === 'Change shortcut')?.click();
    expect(handlers.onChangeShortcut).toHaveBeenCalled();
    expect(host.querySelector('a[href="https://example.com/guide"]')?.textContent).toBe('How to use Ctrl+Tab');
  });

  it('names the browser it runs in and its extension store: Chrome, or Microsoft Edge in Edge', () => {
    const userAgent = vi.spyOn(Navigator.prototype, 'userAgent', 'get');
    const chrome =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
    for (const [agent, name, store] of [
      [chrome, 'Chrome', 'Chrome Web Store'],
      [`${chrome} Edg/156.0.0.0`, 'Microsoft Edge', 'Microsoft Edge Add-ons'],
    ]) {
      userAgent.mockReturnValue(agent as string);
      const { host } = open();
      expect(texts(host)).toContain(`${name} doesn't let extensions use Ctrl+Tab.`);
      expect(toggle(host, `Open the switcher in a window on ${name}'s pages`)).toBeTruthy();
      expect(texts(host)).toContain(
        `${name} doesn't let extensions into its own pages, like Settings, or into its extension store, ${store}.`,
      );
      dispose?.();
    }
    userAgent.mockRestore();
  });

  it('restores the default settings once the user confirms it, and nothing when the user cancels', async () => {
    const { host, handlers } = open();
    const button = (within: ParentNode, text: string) =>
      [...within.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement;
    button(host, 'Restore').click();
    const dialog = host.querySelector('dialog[open]') as HTMLDialogElement;
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.querySelector('h2')?.textContent).toBe('Restore default settings?');
    button(dialog, 'Cancel').click();
    await vi.waitFor(() => expect(host.querySelector('dialog[open]')).toBeNull());
    expect(handlers.onRestore).not.toHaveBeenCalled();
    button(host, 'Restore').click();
    button(host.querySelector('dialog[open]') as HTMLDialogElement, 'Restore').click();
    expect(handlers.onRestore).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(host.querySelector('dialog[open]')).toBeNull());
  });
});

/** Every setting with a valid value that is not its default, in the list (the grid has its own options). */
const notDefaults: Settings = {
  theme: 'dark',
  view: 'list',
  compact: true,
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
    address: false,
    fullAddress: false,
    longAddress: 'cut',
    pinnedIcon: false,
    audioIcon: false,
    sleeping: false,
    groupColor: false,
    lastUsed: false,
    notOpened: false,
    copyAddress: false,
  },
};

/** Each switch of the page, by its label, with the setting it saves. */
const switches: [string, (settings: Settings) => boolean, (on: boolean) => SettingsChange][] = [
  ['Show toolbar', (s) => s.toolbar, (toolbar) => ({ toolbar })],
  ['Compact', (s) => s.compact, (compact) => ({ compact })],
  ['Show pinned tabs', (s) => s.showPinned, (showPinned) => ({ showPinned })],
  ['Stay open until you choose a tab', (s) => s.stayOpen, (stayOpen) => ({ stayOpen })],
  [
    "Open the switcher in a window on Chrome's pages",
    (s) => s.chromePagesWindow,
    (chromePagesWindow) => ({ chromePagesWindow }),
  ],
  ['Auto-select', (s) => s.autoSelect, (autoSelect) => ({ autoSelect })],
  ['Website address', (s) => s.details.address, (address) => ({ details: { address } })],
  ['Full address', (s) => s.details.fullAddress, (fullAddress) => ({ details: { fullAddress } })],
  ['Pinned tab icon', (s) => s.details.pinnedIcon, (pinnedIcon) => ({ details: { pinnedIcon } })],
  ['Playing audio icon', (s) => s.details.audioIcon, (audioIcon) => ({ details: { audioIcon } })],
  ['Inactive tabs', (s) => s.details.sleeping, (sleeping) => ({ details: { sleeping } })],
  ['Tab group color', (s) => s.details.groupColor, (groupColor) => ({ details: { groupColor } })],
  ['Last used', (s) => s.details.lastUsed, (lastUsed) => ({ details: { lastUsed } })],
  ['Tabs not opened yet', (s) => s.details.notOpened, (notOpened) => ({ details: { notOpened } })],
  ['Copy address button', (s) => s.details.copyAddress, (copyAddress) => ({ details: { copyAddress } })],
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
    expect(select(host, 'Long website addresses').value).toBe('cut');
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
        if (label === 'Full address' && !start.details.address) {
          // Turned off with the website address: the click changes nothing.
          expect(saved, label).toEqual([]);
          expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(value(start)));
        } else {
          expect(saved, label).toEqual([changeOf(!value(start))]);
          expect(toggle(host, label).getAttribute('aria-checked'), label).toBe(String(!value(start)));
        }
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
      ['Long website addresses', 'cut', { details: { longAddress: 'cut' } }],
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
    expect(labels('Long website addresses')).toEqual(['Scroll', 'Cut short']);
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

  it('shows the auto-select time, Full address and the long addresses faded when a search finds them while what they depend on is off', () => {
    const { host } = open({ details: { ...defaultSettings.details, address: false } });
    const row = (name: string) =>
      [...host.querySelectorAll('div[id]')].find((element) => element.textContent === name)?.parentElement
        ?.parentElement as HTMLElement;
    search(host, 'auto-select time');
    expect(shown(row('Auto-select time'))).toBe(true);
    expect(Number(getComputedStyle(row('Auto-select time')).opacity)).toBeLessThan(1);
    expect(number(host, 'Auto-select time').disabled).toBe(true);
    search(host, 'address');
    expect(Number(getComputedStyle(row('Full address')).opacity)).toBeLessThan(1);
    expect(Number(getComputedStyle(row('Long website addresses')).opacity)).toBeLessThan(1);
    expect(Number(getComputedStyle(row('Website address')).opacity)).toBe(1);
    toggle(host, 'Website address').click();
    expect(Number(getComputedStyle(row('Full address')).opacity)).toBe(1);
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
    choose(host, 'Switching');
    const delay = number(host, delayName);
    await userEvent.clear(delay);
    await userEvent.type(delay, '300');
    expect(saved).toEqual([]);
    await userEvent.keyboard('{Enter}');
    expect(saved).toEqual([{ delayMs: 300 }]);
  });

  it('saves a number typed when the field is left with Tab', async () => {
    const { host, saved } = open();
    choose(host, 'Switching');
    const delay = number(host, delayName);
    await userEvent.clear(delay);
    await userEvent.type(delay, '75');
    await userEvent.tab();
    expect(saved).toEqual([{ delayMs: 75 }]);
  });

  it('can not be changed while it is turned off', async () => {
    const { host, saved } = open();
    // Shown, faded, only to a search that finds it.
    search(host, 'auto-select time');
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
    expect(saved).toEqual([{ compact: true }]);
    await userEvent.keyboard('{Enter}');
    expect(saved).toEqual([{ compact: true }, { compact: false }]);
    expect(compact.getAttribute('aria-checked')).toBe('false');
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

  it("reaches the chosen section's switches, lists and buttons with Tab, and skips the controls not shown", async () => {
    const reachedIn = async (section: string, start: Partial<Settings> = {}) => {
      const { host } = open(start);
      choose(host, section);
      const reached: Element[] = [];
      (host.querySelector('input[type="search"]') as HTMLElement).focus();
      for (let i = 0; i < 40 && host.contains(document.activeElement); i++) {
        reached.push(document.activeElement as Element);
        await userEvent.tab();
      }
      return { host, reached };
    };
    const appearance = await reachedIn('Appearance');
    expect(appearance.reached).toContain(toggle(appearance.host, 'Compact'));
    expect(appearance.reached).toContain(select(appearance.host, 'Theme'));
    expect(appearance.reached).not.toContain(number(appearance.host, 'Delay before the switcher appears'));
    dispose?.();
    const switching = await reachedIn('Switching');
    expect(switching.reached).toContain(number(switching.host, 'Delay before the switcher appears'));
    expect(switching.reached).not.toContain(number(switching.host, 'Auto-select time'));
    expect(switching.reached).not.toContain(toggle(switching.host, 'Compact'));
    dispose?.();
    const details = await reachedIn('Tab details', { details: { ...defaultSettings.details, address: false } });
    expect(details.reached).toContain(toggle(details.host, 'Website address'));
    expect(details.reached).not.toContain(toggle(details.host, 'Full address'));
    expect(details.reached).not.toContain(select(details.host, 'Long website addresses'));
    dispose?.();
    const system = await reachedIn('System');
    expect(system.reached).toContain(system.host.querySelector('#system a'));
    expect(system.reached).toContain(button(system.host, 'Restore')[0]);
  });
});

describe('SettingsPage, shortcuts and restore', () => {
  it('shows "Not set" for each shortcut the browser gives none', () => {
    const { host } = open({}, { next: '', previous: '', icon: '' });
    expect([...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual(['Not set', 'Not set', 'Not set']);
  });

  it("shows the shortcuts as the browser writes them, the toolbar icon's third", () => {
    const { host } = open({}, { next: 'Ctrl+Shift+Comma', previous: '⌃⇧S', icon: 'Alt+K' });
    expect([...host.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual([
      'Ctrl+Shift+Comma',
      '⌃⇧S',
      'Alt+K',
    ]);
    expect(host.textContent).toContain('Toolbar icon');
  });

  it("warns, after the section's note, when the next or previous tab shortcut has no keys, not for the icon's", () => {
    const warning = (shortcuts: { next: string; previous: string; icon: string }) => {
      const { host } = open({}, shortcuts);
      const text = host.querySelector('#shortcuts [role="status"]')?.textContent ?? null;
      dispose?.();
      host.remove();
      return text;
    };
    const missing =
      'A shortcut has no keys, maybe because another extension already uses them. Choose your own keys with Change shortcut.';
    expect(warning({ next: '', previous: 'Alt+Shift+S', icon: '' })).toBe(missing);
    expect(warning({ next: 'Alt+S', previous: '', icon: '' })).toBe(missing);
    expect(warning({ next: 'Alt+S', previous: 'Alt+Shift+S', icon: '' })).toBeNull();
  });

  it("opens on the shortcuts' dialog when asked (after the install), with the same section, closed with Done", async () => {
    const { host } = open({}, { next: '', previous: 'Alt+Shift+S', icon: '' }, true);
    const dialog = host.querySelector('dialog[open]') as HTMLDialogElement;
    expect(dialog.querySelector('h2')?.textContent).toBe('Choose your keyboard shortcuts');
    expect(dialog.querySelector('[role="status"]')).not.toBeNull();
    expect([...dialog.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual([
      'Not set',
      'Alt+Shift+S',
      'Not set',
    ]);
    [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Done')?.click();
    await vi.waitFor(() => expect(host.querySelector('dialog[open]')).toBeNull());
  });

  it('has a button to change each shortcut, named by its shortcut', () => {
    const { host, handlers } = open();
    const buttons = button(host, 'Change shortcut');
    expect(buttons.map(describedBy)).toEqual(['Next tab', 'Previous tab', 'Toolbar icon']);
    for (const element of buttons) element.click();
    expect(handlers.onChangeShortcut).toHaveBeenCalledTimes(3);
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
    // The confirmation's own Restore.
    button(host.querySelector('dialog[open]') as HTMLElement, 'Restore')[0]?.click();
    expect(handlers.onRestore).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([]);
  });

  it('marks the section chosen in the sidebar', () => {
    const { host } = open();
    const links = [...host.querySelectorAll<HTMLAnchorElement>('nav a')];
    links.find((link) => link.textContent === 'System')?.click();
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, null, null, 'page', null]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#appearance',
      '#switching',
      '#details',
      '#shortcuts',
      '#system',
      '#about',
    ]);
    for (const link of links) expect(host.querySelector(link.getAttribute('href') as string)).not.toBeNull();
  });
});

/** The titles of the sections the user sees. */
const sectionsShown = (host: HTMLElement) =>
  [...host.querySelectorAll('section')].filter(shown).map((section) => section.querySelector('h2')?.textContent);

describe('SettingsPage, one section at a time', () => {
  it('shows the first section alone, then the one chosen in the sidebar, named in the address', () => {
    const { host } = open();
    expect(sectionsShown(host)).toEqual(['Appearance']);
    choose(host, 'Keyboard shortcuts');
    expect(sectionsShown(host)).toEqual(['Keyboard shortcuts']);
    expect(location.hash).toBe('#shortcuts');
  });

  it('opens on the section its address names, and follows Back', async () => {
    history.replaceState(null, '', '#details');
    const { host } = open();
    expect(sectionsShown(host)).toEqual(['Tab details']);
    choose(host, 'System');
    expect(sectionsShown(host)).toEqual(['System']);
    history.back();
    await vi.waitFor(() => expect(sectionsShown(host)).toEqual(['Tab details']));
  });
});

describe('SettingsPage, search', () => {
  /** The names of the settings the user sees: each row's label. */
  const labelsShown = (host: HTMLElement) =>
    [...host.querySelectorAll('section [class*="row"]')]
      .filter(shown)
      .map((row) => row.querySelector('[class*="label"]')?.textContent);

  it('shows the settings of every section that match, and only them', () => {
    const { host } = open();
    search(host, 'shortcut');
    // Two notes in Switching, and the section whose title says it, whole.
    expect(sectionsShown(host)).toEqual(['Switching', 'Keyboard shortcuts']);
    expect(labelsShown(host)).toEqual([
      'Delay before the switcher appears',
      'Stay open until you choose a tab',
      'Next tab',
      'Previous tab',
      'Toolbar icon',
    ]);
  });

  it('finds a setting by one of its choices', () => {
    const { host } = open();
    search(host, 'all windows');
    expect(labelsShown(host)).toEqual(['Show tabs from']);
  });

  it('marks what it found, without case', () => {
    const { host } = open();
    search(host, 'COMPACT');
    expect([...host.querySelectorAll('mark')].filter(shown).map((mark) => mark.textContent)).toEqual(['Compact']);
  });

  it('shows linked settings together when it finds one of them', () => {
    const { host } = open({ autoSelect: true });
    search(host, 'line shows the time');
    expect(labelsShown(host)).toEqual(['Auto-select', 'Auto-select time']);
  });

  it('marks no section in the sidebar while searching, and a section chosen ends the search', () => {
    const { host } = open();
    search(host, 'theme');
    expect(host.querySelector('nav a[aria-current]')).toBeNull();
    choose(host, 'System');
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
    expect(sectionsShown(host)).toEqual(['System']);
  });

  it('says so when no setting matches, and the chosen section comes back once the search is cleared', () => {
    const { host } = open();
    search(host, 'xyzzy');
    expect(sectionsShown(host)).toEqual([]);
    expect(host.textContent).toContain('No settings match your search.');
    (host.querySelector('button[aria-label="Clear search"]') as HTMLButtonElement).click();
    expect(sectionsShown(host)).toEqual(['Appearance']);
    expect(host.textContent).not.toContain('No settings match your search.');
  });

  it('is cleared with Esc', async () => {
    const { host } = open();
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    await userEvent.type(field, 'compact');
    expect(sectionsShown(host)).toEqual(['Appearance']);
    await userEvent.keyboard('{Escape}');
    expect(field.value).toBe('');
  });
});

describe('SettingsPage, About', () => {
  const link = (host: HTMLElement, name: string) =>
    [...host.querySelectorAll<HTMLAnchorElement>('#about a')].find((element) =>
      element.textContent?.startsWith(name),
    ) as HTMLAnchorElement;

  it('shows the version, and links that open in a new tab', () => {
    const { host } = open();
    choose(host, 'About');
    expect(host.querySelector('#about')?.textContent).toContain('Version 1.2.0');
    const links: [string, string][] = [
      ["What's new", 'https://github.com/giuvincenzi/better-tab-switcher/releases/tag/v1.2.0'],
      ['User guide', 'https://bettertabswitcher.gviam.app/guide/latest/'],
      ['Report an issue', 'https://github.com/giuvincenzi/better-tab-switcher/issues/new/choose'],
      ['Website', 'https://bettertabswitcher.gviam.app/'],
      ['Rate this extension', 'https://chromewebstore.google.com/detail/fkalmlegojojpcjdfndipmnakgakokei/reviews'],
      ['Star on GitHub', 'https://github.com/giuvincenzi/better-tab-switcher'],
    ];
    for (const [name, href] of links) {
      const element = link(host, name);
      expect(element.href, name).toBe(href);
      expect(element.target, name).toBe('_blank');
      expect(element.rel, name).toContain('noopener');
      expect(shown(element), name).toBe(true);
    }
    expect(link(host, 'Rate this extension').textContent).toContain('Write a review on Chrome Web Store.');
  });

  it('rates the extension on Microsoft Edge Add-ons in Edge', () => {
    const userAgent = vi.spyOn(Navigator.prototype, 'userAgent', 'get');
    userAgent.mockReturnValue('Mozilla/5.0 (X11; Linux x86_64) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0');
    const { host } = open();
    expect(link(host, 'Rate this extension').href).toBe(
      'https://microsoftedge.microsoft.com/addons/detail/kkoilicikefpkggldhpdeabmgnpngelg',
    );
    expect(link(host, 'Rate this extension').textContent).toContain('Write a review on Microsoft Edge Add-ons.');
    userAgent.mockRestore();
  });

  it('shows the version with no button: only the links do something', () => {
    const { host } = open();
    choose(host, 'About');
    expect(host.querySelector('#about')?.textContent).toContain('Version 1.2.0');
    expect(host.querySelectorAll('#about button')).toHaveLength(0);
  });
});

describe('SettingsPage, System', () => {
  it("opens the browser's page of the extension with Manage extension, a link with no note, last after Restore", () => {
    const { host, handlers } = open();
    choose(host, 'System');
    const manage = host.querySelector<HTMLAnchorElement>('#system a') as HTMLAnchorElement;
    expect(manage.textContent).toBe('Manage extension');
    // Last in System, after Restore default settings.
    // Its rows: the confirmation's dialog, after them, is not one.
    const rows = [...(host.querySelector('#system [class*="card"]') as Element).children].filter(
      (element) => element.localName !== 'dialog',
    );
    expect(rows.at(-1)).toBe(manage);
    expect(rows.at(-2)?.textContent).toContain('Restore default settings');
    expect(manage.getAttribute('href')).toBe('chrome://extensions/?id=abc');
    // The browser opens it (tabs.create): a page can't follow a link to chrome://.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    manage.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(handlers.onManageExtension).toHaveBeenCalledTimes(1);
    expect(handlers.onRestore).not.toHaveBeenCalled();
    expect(button(host, 'Restart')).toEqual([]);
  });

  it('shows Show pinned tabs in Switching, under Show tabs from: both choose which tabs the switcher lists', () => {
    const { host } = open();
    const labels = [...host.querySelectorAll('#switching [aria-labelledby]')].map(
      (element) => document.getElementById(element.getAttribute('aria-labelledby') ?? '')?.textContent,
    );
    expect(labels.slice(0, 2)).toEqual(['Show tabs from', 'Show pinned tabs']);
  });

  it('gives each section of the sidebar its icon, and sets System and About apart', () => {
    const { host } = open();
    const links = [...host.querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map((link) => link.querySelector('svg')?.dataset.icon)).toEqual([
      'palette',
      'swap',
      'bullets',
      'keyboard',
      'settings',
      'info',
    ]);
    // The line before System, on its item alone (the line itself, on screen: tests/e2e/settings.spec.ts).
    const apart = links.map((link) => (link.parentElement as Element).className.includes('apart'));
    expect(apart).toEqual([false, false, false, false, true, false]);
  });
});
