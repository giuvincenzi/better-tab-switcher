import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { Switcher, type SwitcherProps } from '../../components/switcher/Switcher';
import type { Key } from '../../lib/keys/keys';
import type { Direction, SwitcherSnapshot } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { DEFAULT_EM_PX, sizes } from '../../lib/switcher/sizes';
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
  const [moves] = createSignal<{ direction: Direction; count: number }>({ direction: 'next', count: 0 });
  const [pageKeys] = createSignal<{ key: Key; count: number }>();
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const [pictureTaken] = createSignal(false);
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
        pageKeys={pageKeys}
        canSeeRelease={more.canSeeRelease ?? true}
        previews={previews}
        pictureTaken={pictureTaken}
        listedTabs={() => undefined}
        {...handlers}
      />
    ),
    host,
  );
  const press = (key: string, type: 'keydown' | 'keyup' = 'keydown') =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  return { host, handlers, press, setPreviews };
}

const selectedTitle = (host: HTMLElement) => host.querySelector('[aria-selected="true"]')?.getAttribute('aria-label');

// What the user does with the switcher on the real browser (the keys, the search, the toolbar, closing tabs, the delay):
// tests/e2e/switcher.spec.ts, switching.spec.ts, search.spec.ts, settings.spec.ts and grid.spec.ts.

describe('Switcher', () => {
  it('shows the toolbar with its search field (the default), without the focus', () => {
    const { host } = open();
    const field = host.querySelector('[role="toolbar"] input[type="search"]') as HTMLInputElement;
    expect(field).not.toBeNull();
    expect(document.activeElement).not.toBe(field);
    expect(selectedTitle(host)).toBe('Inbox (3), example.com/2');
  });
});

describe('Switcher size', () => {
  it("grows with the user's text size: rows and tiles in em", () => {
    // The UI's root sets --bts-em to the user's text size (styles/theme.css): 20 px instead of the default 16.
    document.body.style.setProperty('--bts-em', '20px');
    try {
      const row = open().host.querySelector('[role="option"]') as HTMLElement;
      expect(row.getBoundingClientRect().height).toBe(48 * 1.25);
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

  it('takes its share of the page in the list, between its narrowest and its widest', async () => {
    const { share, min, max } = sizes.listWidth;
    await page.viewport(1280, 800);
    expect(panelWidth(open().host)).toBe((1280 * share) / 100);
    dispose?.();
    await page.viewport(2560, 800);
    expect(panelWidth(open().host)).toBe(max * DEFAULT_EM_PX);
    dispose?.();
    await page.viewport(1000, 800);
    expect(panelWidth(open().host)).toBe(min * DEFAULT_EM_PX);
  });

  it('shows a short address whole beside the title, in the compact list', async () => {
    await page.viewport(1280, 800);
    const { host } = open({ compact: true, details: { ...defaultSettings.details, address: true } });
    const shortAddresses = tabs.map((t) => `example.com/${t.id}`);
    const addresses = [...host.querySelectorAll('span')].filter(
      (span) => span.children.length === 0 && shortAddresses.includes(span.textContent ?? ''),
    );
    expect(addresses).toHaveLength(tabs.length);
    for (const address of addresses) {
      expect(address.offsetWidth).toBeLessThanOrEqual((address.parentElement as HTMLElement).clientWidth);
    }
  });

  it('is never wider than the page, its margins left', async () => {
    await page.viewport(380, 800);
    expect(panelWidth(open().host)).toBe(380 - 2 * sizes.margin * DEFAULT_EM_PX);
  });

  it('is as wide as its columns in the grid, never narrower than the narrowest switcher', async () => {
    await page.viewport(1920, 800);
    const { host } = open({ view: 'grid' });
    const grid = host.querySelector('[role="listbox"]') as HTMLElement;
    // Four tabs: two columns of tiles, in the middle of the narrowest switcher, with no tile cut.
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')).toHaveLength(2);
    expect(panelWidth(host)).toBe(sizes.listWidth.min * DEFAULT_EM_PX);
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

  it("shows the site's icon until the tab's picture arrives", () => {
    const { host, setPreviews } = open({ view: 'grid' });
    const tile = () => host.querySelector('[aria-label="Q4 planning, example.com/3"]') as HTMLElement;
    expect(tile().querySelector('img[src^="data:"]')).toBeNull();
    expect(tile().querySelectorAll('img[src*="_favicon"]')).toHaveLength(2);
    setPreviews({ 3: 'data:image/webp;base64,UklGRg==' });
    expect(tile().querySelector('img[src^="data:"]')).not.toBeNull();
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

  it('turns Compact on and off', () => {
    const { host, handlers } = open();
    expect(button(host, 'Compact').getAttribute('aria-pressed')).toBe('false');
    button(host, 'Compact').click();
    expect(handlers.onSettingsChange).toHaveBeenCalledWith({ compact: true });
    expect(button(host, 'Compact').getAttribute('aria-pressed')).toBe('true');
    button(host, 'Compact').click();
    expect(handlers.onSettingsChange).toHaveBeenLastCalledWith({ compact: false });
    expect(button(host, 'Compact').getAttribute('aria-pressed')).toBe('false');
  });

  it('turns the website address and the last used time on and off, in the list and in the grid', () => {
    for (const view of ['list', 'grid'] as const) {
      const { host, handlers } = open({ view });
      const address = button(host, 'Website address');
      const lastUsed = button(host, 'Last used');
      // Both on by default: off first, then on again.
      expect([address.getAttribute('aria-pressed'), lastUsed.getAttribute('aria-pressed')]).toEqual(['true', 'true']);
      address.click();
      lastUsed.click();
      expect(handlers.onSettingsChange).toHaveBeenCalledWith({ details: { address: false } });
      expect(handlers.onSettingsChange).toHaveBeenCalledWith({ details: { lastUsed: false } });
      expect(address.getAttribute('aria-pressed')).toBe('false');
      expect(lastUsed.getAttribute('aria-pressed')).toBe('false');
      expect(host.querySelector('[role="option"]')?.textContent).not.toMatch(/example\.com|ago/);
      address.click();
      lastUsed.click();
      expect(handlers.onSettingsChange).toHaveBeenCalledWith({ details: { address: true } });
      expect(handlers.onSettingsChange).toHaveBeenCalledWith({ details: { lastUsed: true } });
      expect(address.getAttribute('aria-pressed')).toBe('true');
      expect(lastUsed.getAttribute('aria-pressed')).toBe('true');
      // The tabs shown follow at once: the address beside or under the title, and the last used time.
      expect(host.querySelector('[role="option"]')?.textContent).toMatch(/example\.com.*ago/);
      dispose?.();
    }
  });

  it('has no website address nor last used in the grid of icons, which shows neither', () => {
    const { host } = open({ view: 'grid', gridShow: 'icons' });
    expect(button(host, 'Website address')).toBeNull();
    expect(button(host, 'Last used')).toBeNull();
  });
});
