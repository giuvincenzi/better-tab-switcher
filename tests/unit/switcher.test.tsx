import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { Switcher, type SwitcherProps } from '../../components/switcher/Switcher';
import type { Direction, SwitcherSnapshot } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

const tab = (id: number, title: string): SwitcherTab => ({
  id,
  windowId: 1,
  title,
  url: `https://example.com/${id}`,
  pinned: false,
  audible: false,
  sleeping: false,
  incognito: false,
  lastAccessed: 1000 - id,
});
const tabs = [tab(1, 'Pull request #12'), tab(2, 'Inbox (3)'), tab(3, 'Q4 planning'), tab(4, 'Running plan')];

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});

function open(settings: Partial<Settings> = {}, more: Partial<SwitcherSnapshot & SwitcherProps> = {}) {
  const snapshot: SwitcherSnapshot = {
    tabs,
    settings: { ...defaultSettings, delayMs: 0, ...settings },
    direction: 'next',
    fromIcon: false,
    waitForPicture: false,
    ...more,
  };
  const [moves, setMoves] = createSignal<{ direction: Direction; count: number }>({ direction: 'next', count: 0 });
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const [pictureTaken, setPictureTaken] = createSignal(false);
  const handlers = {
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCloseTab: vi.fn(),
    onSettings: vi.fn(),
    onSettingsChange: vi.fn(),
  };
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <Switcher
        snapshot={snapshot}
        moves={moves}
        canSeeRelease={more.canSeeRelease ?? true}
        previews={previews}
        pictureTaken={pictureTaken}
        {...handlers}
      />
    ),
    host,
  );
  const press = (key: string, type: 'keydown' | 'keyup' = 'keydown') =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  const move = (direction: Direction) => setMoves((m) => ({ direction, count: m.count + 1 }));
  return { host, handlers, press, move, setPreviews, takePicture: () => setPictureTaken(true) };
}

const selectedTitle = (host: HTMLElement) => host.querySelector('[aria-selected="true"]')?.getAttribute('aria-label');

describe('Switcher', () => {
  it('selects the previous tab and shows the keys with the real shortcuts', () => {
    const { host } = open();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(selectedTitle(host)).toBe('Inbox (3)');
  });

  it('stays open on release with Stay open, from the toolbar icon, or when it cannot see the release', () => {
    for (const [settings, more] of [
      [{ stayOpen: true }, {}],
      [{}, { fromIcon: true }],
      [{}, { canSeeRelease: false }],
    ] as const) {
      const { handlers, press } = open(settings, more);
      press('Alt', 'keyup');
      expect(handlers.onOpen).not.toHaveBeenCalled();
      dispose?.();
    }
  });

  it('opens the selected tab when Alt is released', () => {
    const { handlers, press } = open();
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[1]);
  });

  it('moves when the shortcut is pressed again, and with the arrows', () => {
    const { host, move, press, handlers } = open();
    move('next');
    expect(selectedTitle(host)).toBe('Q4 planning');
    press('ArrowDown');
    expect(selectedTitle(host)).toBe('Running plan');
    move('previous');
    press('Enter');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[2]);
  });

  it('closes on Esc', () => {
    const { handlers, press } = open();
    press('Escape');
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('shows the toolbar with its search field (the default), without the focus', () => {
    const { host } = open();
    const field = host.querySelector('[role="toolbar"] input[type="search"]') as HTMLInputElement;
    expect(field).not.toBeNull();
    expect(document.activeElement).not.toBe(field);
    expect(selectedTitle(host)).toBe('Inbox (3)');
  });

  it('opens the selected tab on release with the toolbar, as without it', () => {
    const { handlers, press } = open();
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[1]);
  });

  it('stays open once the search field is clicked', () => {
    const { host, handlers, press } = open();
    (host.querySelector('input[type="search"]') as HTMLInputElement).focus();
    press('Alt', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('shows the tabs that match what is typed, with the match highlighted', () => {
    const { host } = open();
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    field.focus();
    field.value = 'plan';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    const shown = [...host.querySelectorAll('[role="option"]')].map((row) => row.getAttribute('aria-label'));
    expect(shown).toEqual(['Q4 planning', 'Running plan']);
    expect([...host.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['plan', 'plan']);
  });

  it('says so when nothing matches', () => {
    const { host } = open();
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    field.focus();
    field.value = 'passport';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(host.textContent).toContain('No tabs match your search.');
  });

  it('shows only the tabs with the toolbar off: no search field, no buttons', () => {
    const { host } = open({ toolbar: false });
    expect(host.querySelector('[role="toolbar"]')).toBeNull();
    expect(host.querySelector('input[type="search"]')).toBeNull();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(4);
  });

  it('closes a tab and keeps the list', () => {
    const { host, handlers } = open();
    (host.querySelectorAll('button[aria-label="Close tab"]')[3] as HTMLButtonElement).click();
    expect(handlers.onCloseTab).toHaveBeenCalledWith(tabs[3]);
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it('stays hidden for the delay, so a quick tap never shows it', async () => {
    const { host, handlers, press } = open({ delayMs: 200 });
    const backdrop = host.firstElementChild as HTMLElement;
    expect(getComputedStyle(backdrop).visibility).toBe('hidden');
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[1]);
    dispose?.();
    const later = open({ delayMs: 50 });
    await vi.waitFor(() =>
      expect(getComputedStyle(later.host.firstElementChild as HTMLElement).visibility).toBe('visible'),
    );
  });

  it("stays hidden until the page's picture is taken, so it is not in it", async () => {
    const { host, takePicture } = open({ view: 'grid' }, { waitForPicture: true });
    const backdrop = host.firstElementChild as HTMLElement;
    expect(getComputedStyle(backdrop).visibility).toBe('hidden');
    takePicture();
    await vi.waitFor(() => expect(getComputedStyle(backdrop).visibility).toBe('visible'));
  });
});

describe('Switcher size', () => {
  it("grows with the user's text size: rows and tiles in em", () => {
    // The UI's root sets --bts-em to the user's text size (styles/theme.css): 20 px instead of the default 16.
    document.body.style.setProperty('--bts-em', '20px');
    try {
      const row = open().host.querySelector('[role="option"]') as HTMLElement;
      expect(row.getBoundingClientRect().height).toBe(36 * 1.25);
      dispose?.();
      const tile = open({ view: 'grid' }).host.querySelector('[role="option"]') as HTMLElement;
      expect(tile.getBoundingClientRect().width).toBe(208 * 1.25);
    } finally {
      document.body.style.removeProperty('--bts-em');
    }
  });

  const panel = (host: HTMLElement) => host.querySelector('[style*="--panel-width"]') as HTMLElement;
  const size = (host: HTMLElement) => {
    const { width, height } = panel(host).getBoundingClientRect();
    return { width, height };
  };
  const type = (host: HTMLElement, text: string) => {
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    field.focus();
    field.value = text;
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };

  for (const view of ['list', 'grid'] as const) {
    it(`never changes while open, in the ${view}: searching, closing tabs`, async () => {
      await page.viewport(1280, 800);
      const { host } = open({ view });
      const opened = size(host);
      type(host, 'plan');
      expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
      expect(size(host)).toEqual(opened);
      type(host, '');
      (host.querySelectorAll('button[aria-label="Close tab"]')[3] as HTMLButtonElement).click();
      expect(host.querySelectorAll('[role="option"]')).toHaveLength(3);
      expect(size(host)).toEqual(opened);
    });
  }

  it("keeps the grid's columns while open, so up and down still jump a whole row", async () => {
    await page.viewport(1280, 800);
    const { host } = open({ view: 'grid' });
    const grid = host.querySelector('[role="listbox"]') as HTMLElement;
    const columns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    expect(columns()).toBe(2);
    // One result would make one column: the grid keeps the two it opened with.
    type(host, 'Running');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(columns()).toBe(2);
  });
});

describe('Switcher list width', () => {
  const panelWidth = (host: HTMLElement) => (host.querySelector('[style*="--panel-width"]') as HTMLElement).offsetWidth;

  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it('takes 40% of the page in the list, between 500 and 768 px', async () => {
    await page.viewport(1280, 800);
    expect(panelWidth(open().host)).toBe(512);
    dispose?.();
    await page.viewport(2560, 800);
    expect(panelWidth(open().host)).toBe(768);
    dispose?.();
    await page.viewport(1000, 800);
    expect(panelWidth(open().host)).toBe(500);
  });

  it('shows a short address whole beside the title, in the compact list', async () => {
    await page.viewport(1280, 800);
    const { host } = open({ compact: true, details: { ...defaultSettings.details, address: true } });
    const addresses = [...host.querySelectorAll('span')].filter(
      (span) => span.children.length === 0 && span.textContent === 'example.com',
    );
    expect(addresses).toHaveLength(tabs.length);
    for (const address of addresses) {
      expect(address.offsetWidth).toBeLessThanOrEqual((address.parentElement as HTMLElement).clientWidth);
    }
  });

  it('is never wider than the page', async () => {
    await page.viewport(380, 800);
    expect(panelWidth(open().host)).toBe(348);
  });

  it('is as wide as its columns in the grid, never narrower than 500 px', async () => {
    await page.viewport(1920, 800);
    const { host } = open({ view: 'grid' });
    const grid = host.querySelector('[role="listbox"]') as HTMLElement;
    // Four tabs: two columns of tiles, in the middle of the narrowest switcher, with no tile cut.
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')).toHaveLength(2);
    expect(panelWidth(host)).toBe(500);
    expect(grid.scrollWidth).toBe(grid.clientWidth);
  });

  it('fills the narrowest switcher with icons: the room left is shared evenly around them, no empty sides', async () => {
    await page.viewport(1920, 800);
    const { host } = open({ view: 'grid', gridShow: 'icons' });
    const grid = host.querySelector('[role="listbox"]') as HTMLElement;
    // Four tabs: one row of four icons, where a square would make two rows of two in the middle.
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')).toHaveLength(4);
    const box = grid.getBoundingClientRect();
    const cells = [...grid.querySelectorAll('[role="option"]')].map((cell) => cell.getBoundingClientRect());
    const first = cells[0] as DOMRect;
    const second = cells[1] as DOMRect;
    const last = cells[3] as DOMRect;
    const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
    const between = second.left - first.right - gap;
    expect(first.left - box.left).toBeCloseTo(between, 0);
    expect(box.right - last.right).toBeCloseTo(between, 0);
  });
});

describe('Switcher in the grid', () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it('fits as many tiles as the page is wide, and moves between rows with up and down', async () => {
    // Two tiles across (lib/switcher/sizes.ts): 208 px each, with the switcher's margins and padding.
    await page.viewport(600, 800);
    const { host, press } = open({ view: 'grid' });
    expect(selectedTitle(host)).toBe('Inbox (3)');
    press('ArrowDown');
    expect(selectedTitle(host)).toBe('Running plan');
    press('ArrowLeft');
    expect(selectedTitle(host)).toBe('Q4 planning');
    press('ArrowUp');
    expect(selectedTitle(host)).toBe('Pull request #12');
    press('ArrowRight');
    expect(selectedTitle(host)).toBe('Inbox (3)');
  });

  it("shows the site's icon until the tab's picture arrives", () => {
    const { host, setPreviews } = open({ view: 'grid' });
    const tile = () => host.querySelector('[aria-label="Q4 planning"]') as HTMLElement;
    expect(tile().querySelector('img[src^="data:"]')).toBeNull();
    expect(tile().querySelectorAll('img[src*="_favicon"]')).toHaveLength(2);
    setPreviews({ 3: 'data:image/webp;base64,UklGRg==' });
    expect(tile().querySelector('img[src^="data:"]')).not.toBeNull();
  });

  it("shows only the sites' icons, and the selected tab's title under them, with Show Icons", () => {
    const { host, setPreviews } = open({ view: 'grid', gridShow: 'icons' });
    setPreviews({ 3: 'data:image/webp;base64,UklGRg==' });
    expect(host.querySelector('img[src^="data:"]')).toBeNull();
    expect(host.querySelectorAll('[role="option"] img[src*="_favicon"]')).toHaveLength(4);
    expect(host.textContent).toContain('Inbox (3)');
    expect(host.textContent).not.toContain('Q4 planning');
  });
});

describe('Switcher toolbar', () => {
  const button = (host: HTMLElement, name: string) =>
    host.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  const radio = (host: HTMLElement, value: string) =>
    host.querySelector(`[role="toolbar"] input[type="radio"][value="${value}"]`) as HTMLInputElement;

  it("has the list's Compact at the start, the view and the settings at the end", () => {
    const { host } = open();
    const [start, , end] = [...(host.querySelector('[role="toolbar"]') as HTMLElement).children];
    expect(start?.querySelector('button[aria-label="Compact"]')).not.toBeNull();
    expect(end?.querySelector('[aria-label="View"]')).not.toBeNull();
    expect(end?.lastElementChild?.getAttribute('aria-label')).toBe('All settings');
  });

  it('shows what the grid shows at the start, in the grid', () => {
    const { host } = open({ view: 'grid' });
    expect(radio(host, 'previews').checked).toBe(true);
    expect(button(host, 'Compact')).toBeNull();
  });

  it('changes the view at once, saves it, and keeps the switcher open', () => {
    const { host, handlers, press } = open();
    radio(host, 'grid').click();
    expect(handlers.onSettingsChange).toHaveBeenCalledWith({ view: 'grid' });
    expect(host.querySelector('[role="listbox"]')?.className).toContain('previews');
    press('Alt', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('turns Compact on and off', () => {
    const { host, handlers } = open();
    expect(button(host, 'Compact').getAttribute('aria-pressed')).toBe('true');
    button(host, 'Compact').click();
    expect(handlers.onSettingsChange).toHaveBeenCalledWith({ compact: false });
    expect(button(host, 'Compact').getAttribute('aria-pressed')).toBe('false');
  });

  it('opens the settings page', () => {
    const { host, handlers } = open();
    button(host, 'All settings').click();
    expect(handlers.onSettings).toHaveBeenCalledOnce();
  });

  it('leaves the keyboard on the tabs when a button is clicked', () => {
    const { host, press } = open();
    const list = host.querySelector('[role="listbox"]') as HTMLElement;
    const pressed = new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true });
    button(host, 'Compact').dispatchEvent(pressed);
    expect(pressed.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(list);
    press('ArrowDown');
    expect(selectedTitle(host)).toBe('Q4 planning');
  });
});
