import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { DEFAULT_EM_PX, gridColumns, sizes, tileWidth } from '../../lib/switcher/sizes';
import {
  autoSelectLine,
  button,
  closeAll,
  columnsShown,
  listbox,
  manyTabs,
  openSwitcher,
  option,
  options,
  panel,
  selectedName,
  tab,
  tabs,
  typeInSearch,
} from './switcher-harness';

// Every test starts on the same page size, also when it runs alone.
beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  closeAll();
  document.body.style.removeProperty('--bts-em');
  document.body.removeAttribute('dir');
  await page.viewport(1280, 800);
});

const size = (element: HTMLElement) => {
  const { width, height } = element.getBoundingClientRect();
  return { width, height };
};
const settingsWith = (change: Partial<Settings>): Settings => ({ ...defaultSettings, ...change });

describe('Switcher frame', () => {
  it('keeps its size when the page is resized while it is open', async () => {
    await page.viewport(1280, 800);
    const { host } = openSwitcher();
    const opened = size(panel(host));
    await page.viewport(2000, 800);
    expect(size(panel(host))).toEqual(opened);
  });

  it('tells its size once it has taken it, and again after a toolbar change', () => {
    const { host, handlers } = openSwitcher({ view: 'grid' });
    expect(handlers.onFrame).toHaveBeenCalledOnce();
    expect(handlers.onFrame).toHaveBeenLastCalledWith(size(panel(host)));
    button(host, 'Website address').click();
    expect(handlers.onFrame).toHaveBeenCalledTimes(2);
    expect(handlers.onFrame).toHaveBeenLastCalledWith(size(panel(host)));
  });

  it('grows taller in the grid when the website address is turned on, as the tiles grow', () => {
    const { host } = openSwitcher({ view: 'grid', details: { ...defaultSettings.details, address: false } });
    const before = size(panel(host)).height;
    button(host, 'Website address').click();
    const tile = options(host)[0] as HTMLElement;
    expect(size(panel(host)).height).toBeGreaterThan(before);
    // Nothing is cut: the tiles fit the frame taken again.
    expect(listbox(host).scrollHeight).toBe(listbox(host).clientHeight);
    expect(tile.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel(host).getBoundingClientRect().bottom);
  });

  it("takes the grid's columns again when the toolbar changes what the grid shows, then keeps them while searching", async () => {
    await page.viewport(1920, 800);
    const { host } = openSwitcher({ view: 'grid' });
    const icons = settingsWith({ view: 'grid', gridShow: 'icons' });
    const previews = settingsWith({ view: 'grid', gridShow: 'previews' });
    expect(columnsShown(host)).toBe(gridColumns(previews, tabs.length, window.innerWidth, DEFAULT_EM_PX));
    (host.querySelector('input[type="radio"][value="icons"]') as HTMLInputElement).click();
    const iconColumns = gridColumns(icons, tabs.length, window.innerWidth, DEFAULT_EM_PX);
    expect(iconColumns).not.toBe(gridColumns(previews, tabs.length, window.innerWidth, DEFAULT_EM_PX));
    expect(columnsShown(host)).toBe(iconColumns);
    typeInSearch(host, 'Running');
    expect(columnsShown(host)).toBe(iconColumns);
  });

  it('keeps its width in the list while searching narrows the tabs shown to none', async () => {
    await page.viewport(1280, 800);
    const { host } = openSwitcher();
    const opened = size(panel(host));
    typeInSearch(host, 'passport');
    expect(size(panel(host))).toEqual(opened);
  });
});

describe('Switcher sizes', () => {
  it("chooses the grid's columns for the user's text size", async () => {
    await page.viewport(1280, 800);
    const many = manyTabs(30);
    const grid = settingsWith({ view: 'grid' });
    const larger = gridColumns(grid, many.length, window.innerWidth, 20);
    expect(larger).not.toBe(gridColumns(grid, many.length, window.innerWidth, DEFAULT_EM_PX));
    document.body.style.setProperty('--bts-em', '20px');
    const { host } = openSwitcher({ view: 'grid' }, { tabs: many });
    expect(columnsShown(host)).toBe(larger);
    expect(listbox(host).scrollWidth).toBe(listbox(host).clientWidth);
  });

  it('fits a narrow page in the grid: never wider than the page, no tile cut', async () => {
    await page.viewport(400, 800);
    const grid = settingsWith({ view: 'grid' });
    const { host } = openSwitcher({ view: 'grid' });
    expect(columnsShown(host)).toBe(gridColumns(grid, tabs.length, window.innerWidth, DEFAULT_EM_PX));
    expect(size(panel(host)).width).toBeLessThanOrEqual(400 - 2 * sizes.margin * DEFAULT_EM_PX);
    expect(listbox(host).scrollWidth).toBe(listbox(host).clientWidth);
  });

  it('is never taller than the page: the tabs scroll', async () => {
    await page.viewport(1280, 400);
    const { host } = openSwitcher({ listRows: 'fit', compact: false }, { tabs: manyTabs(40) });
    expect(panel(host).getBoundingClientRect().height).toBeLessThanOrEqual(400 - 2 * sizes.margin * DEFAULT_EM_PX);
    expect(listbox(host).scrollHeight).toBeGreaterThan(listbox(host).clientHeight);
  });

  it('shows the rows of the setting before it scrolls', () => {
    const { host } = openSwitcher({ listRows: 6 }, { tabs: manyTabs(20) });
    const list = listbox(host).getBoundingClientRect();
    const inSight = options(host).filter((row) => row.getBoundingClientRect().bottom <= list.bottom + 0.5);
    expect(inSight).toHaveLength(6);
  });

  it('keeps the list its width with a very long title, the title cut', async () => {
    await page.viewport(1280, 800);
    const long = tab(9, 'A very long title '.repeat(20));
    const { host } = openSwitcher({}, { tabs: [...tabs, long] });
    expect(size(panel(host)).width).toBe(512);
    const title = [...option(host, `${long.title}, example.com/9`).querySelectorAll('span')].find(
      (span) => span.childElementCount === 0 && span.textContent === long.title,
    ) as HTMLElement;
    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(panel(host).getBoundingClientRect().right);
  });

  it('keeps a tile its width with a long title, the title cut', () => {
    const long = tab(9, 'A very long title '.repeat(20));
    const { host } = openSwitcher({ view: 'grid' }, { tabs: [...tabs, long] });
    const tile = option(host, `${long.title}, example.com/9`);
    expect(tile.getBoundingClientRect().width).toBe(tileWidth * DEFAULT_EM_PX);
    const title = [...tile.querySelectorAll('span')].find(
      (span) => span.childElementCount === 0 && span.textContent === long.title,
    ) as HTMLElement;
    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
  });
});

describe('Switcher in the grid of icons', () => {
  /** The selected tab's name under the icons: shown, not read (screen readers have it from the selected icon). */
  const nameUnder = (host: HTMLElement) => listbox(host).nextElementSibling as HTMLElement | null;

  it("shows the selected tab's title under the icons, following the selection, hidden from screen readers", () => {
    const { host, press } = openSwitcher({ view: 'grid', gridShow: 'icons' });
    expect(nameUnder(host)?.textContent).toBe('Inbox (3)');
    expect(nameUnder(host)?.getAttribute('aria-hidden')).toBe('true');
    press('ArrowRight');
    expect(nameUnder(host)?.textContent).toBe('Q4 planning');
  });

  it('shows no title under the icons while the search field is selected', () => {
    const { host } = openSwitcher({ view: 'grid', gridShow: 'icons' });
    typeInSearch(host, 'plan');
    expect(nameUnder(host)).toBeNull();
  });

  it('names each icon after its tab, as the list does', () => {
    const { host } = openSwitcher({ view: 'grid', gridShow: 'icons' });
    expect(options(host).map((icon) => icon.getAttribute('aria-label'))).toEqual(
      tabs.map((t) => `${t.title}, example.com/${t.id}`),
    );
  });

  it('cuts a long title under the icons, never widening the switcher', () => {
    // Two icons fit the narrowest switcher (lib/switcher/sizes.ts): it stays as narrow, whatever the selected title.
    const long = tab(2, 'A very long title '.repeat(20));
    const { host } = openSwitcher({ view: 'grid', gridShow: 'icons' }, { tabs: [tabs[0] as (typeof tabs)[0], long] });
    expect(nameUnder(host)?.textContent).toBe(long.title);
    expect(panel(host).getBoundingClientRect().width).toBe(sizes.listWidth.min * DEFAULT_EM_PX);
    const name = nameUnder(host) as HTMLElement;
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  });
});

describe('Switcher tab details in every view', () => {
  const sleepy = tab(5, 'Sleeping tab', { sleeping: true });

  for (const [view, gridShow] of [
    ['list', 'previews'],
    ['grid', 'previews'],
    ['grid', 'icons'],
  ] as const) {
    it(`greys a sleeping tab, and names it so, in the ${view === 'list' ? 'list' : `grid of ${gridShow}`}`, () => {
      const { host } = openSwitcher({ view, gridShow }, { tabs: [...tabs, sleepy] });
      const sleeping = option(host, 'Sleeping tab, example.com/5, Inactive');
      expect(Number(getComputedStyle(sleeping).opacity)).toBeLessThan(1);
      expect(Number(getComputedStyle(option(host, 'Q4 planning, example.com/3')).opacity)).toBe(1);
    });
  }

  it('names a tile after what it shows: title, address, pinned, other window', () => {
    const pinned = tab(5, 'Docs', { pinned: true, windowLabel: '2', url: 'https://docs.example.org/a' });
    const { host } = openSwitcher(
      { view: 'grid', details: { ...defaultSettings.details, address: true } },
      { tabs: [...tabs, pinned] },
    );
    expect(option(host, 'Docs, docs.example.org/a, Pinned, Window 2')).not.toBeNull();
  });

  it('shows the last used time in a tile when it is on', () => {
    const { host } = openSwitcher({ view: 'grid', details: { ...defaultSettings.details, lastUsed: true } });
    expect(option(host, 'Q4 planning, example.com/3').textContent).toMatch(/ago/);
  });
});

describe('Switcher right to left', () => {
  it("puts the toolbar's start on the right: Compact on the right, All settings on the left", () => {
    document.body.dir = 'rtl';
    const { host } = openSwitcher();
    const compact = button(host, 'Compact').getBoundingClientRect();
    const settings = button(host, 'All settings').getBoundingClientRect();
    expect(compact.left).toBeGreaterThan(settings.right);
  });

  it('lays the grid out from the right', () => {
    document.body.dir = 'rtl';
    const { host } = openSwitcher({ view: 'grid' });
    const first = option(host, 'Pull request #12, example.com/1').getBoundingClientRect();
    const second = option(host, 'Inbox (3), example.com/2').getBoundingClientRect();
    expect(first.left).toBeGreaterThan(second.right);
  });

  it('moves the selection the way the arrow points in a right-to-left grid', () => {
    document.body.dir = 'rtl';
    const { host, press } = openSwitcher({ view: 'grid' });
    const place = () => option(host, selectedName(host) as string).getBoundingClientRect();
    // The selected tab (the previous one) ends the first row; the right arrow goes back to its start.
    press('ArrowRight');
    const start = place();
    expect(start.right).toBeGreaterThan(place().left);
    press('ArrowLeft');
    const left = place();
    expect(left.top).toBe(start.top);
    expect(left.left).toBeLessThan(start.left);
    press('ArrowRight');
    expect(place().left).toBe(start.left);
  });

  it("starts a tile's address past the site's icon, on the side the text starts", () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      document.body.dir = dir;
      const { host } = openSwitcher({ view: 'grid', details: { ...defaultSettings.details, address: true } });
      const tile = option(host, 'Inbox (3), example.com/2');
      const icon = (tile.querySelector('img') as HTMLElement).getBoundingClientRect();
      const address = [...tile.querySelectorAll('span')]
        .find((span) => span.children.length === 0 && span.textContent === 'example.com/2')
        ?.getBoundingClientRect() as DOMRect;
      if (dir === 'ltr') expect(address.left, dir).toBeGreaterThanOrEqual(icon.right);
      else expect(address.right, dir).toBeLessThanOrEqual(icon.left);
      closeAll();
    }
  });

  it('keeps a website address left to right: a long one shows its start, a short one sits where the text starts', () => {
    document.body.dir = 'rtl';
    const host = 'mail.workspace.example-international-holdings-and-subsidiaries-worldwide-operations-department.com';
    const long = tab(5, 'Mail', { url: `https://${host}/inbox` });
    const { host: switcher } = openSwitcher(
      { compact: false, details: { ...defaultSettings.details, address: true } },
      { tabs: [...tabs, long] },
    );
    const text = (name: string, address: string) =>
      [...option(switcher, `${name}, ${address}`).querySelectorAll('span')].find(
        (span) => span.childElementCount === 0 && span.textContent === address,
      ) as HTMLElement;
    const longText = text('Mail', `${host}/inbox`);
    const longPlace = (longText.parentElement as HTMLElement).getBoundingClientRect();
    expect(longText.getBoundingClientRect().width).toBeGreaterThan(longPlace.width);
    expect(longText.getBoundingClientRect().left).toBeCloseTo(longPlace.left, 0);
    const shortText = text('Inbox (3)', 'example.com/2');
    const shortPlace = (shortText.parentElement as HTMLElement).getBoundingClientRect();
    expect(shortText.getBoundingClientRect().right).toBeCloseTo(shortPlace.right, 0);
  });

  it('runs the auto-select line out from the side the text starts: the right', () => {
    document.body.dir = 'rtl';
    const { host } = openSwitcher({ autoSelect: true, autoSelectSeconds: 10 });
    const selected = host.querySelector('[aria-selected="true"]') as HTMLElement;
    const animation = autoSelectLine(selected) as Animation;
    animation.pause();
    animation.currentTime = 5000;
    const line = ((animation.effect as KeyframeEffect).target as HTMLElement).getBoundingClientRect();
    expect(line.width).toBeLessThan(selected.getBoundingClientRect().width);
    expect(line.right).toBeCloseTo(selected.getBoundingClientRect().right, 0);
  });
});
