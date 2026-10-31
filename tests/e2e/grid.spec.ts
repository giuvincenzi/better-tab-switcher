import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rows, selected, showSwitcher, switcher, useSettings } from './helpers';

const pictures = (page: Page) => rows(page).locator('img[src^="data:image/webp"]');

const savedPictures = (worker: Worker) =>
  worker.evaluate(async () =>
    Object.keys(await chrome.storage.session.get(null)).filter((k) => k.startsWith('preview-')),
  );

/**
 * How light the middle of a tab's saved picture is, from 0 (black) to 255 (white): where the switcher's panel is over
 * the page, had the picture been taken with the switcher in it.
 */
const middleOfPicture = (worker: Worker, tabId: number) =>
  worker.evaluate(async (id) => {
    const key = `preview-${id}`;
    const saved = (await chrome.storage.session.get(key))[key] as { picture: string };
    const bitmap = await createImageBitmap(await (await fetch(saved.picture)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    context.drawImage(bitmap, 0, 0);
    const [r, g, b] = context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
    return Math.min(r as number, g as number, b as number);
  }, tabId);

/**
 * Uses each page in turn, as a person would: the switcher opens on it (its picture is taken then) and closes. Chrome
 * takes at most two pictures a second: a switcher opened sooner gets none, so it opens again until the picture is kept.
 */
async function useEach(worker: Worker, pages: Page[]) {
  for (const page of pages) {
    await page.bringToFront();
    const title = await page.title();
    const tabId = await worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id, title);
    await expect(async () => {
      await showSwitcher(worker);
      await page.keyboard.press('Escape');
      await expect(rows(page)).toHaveCount(0);
      await expect.poll(() => savedPictures(worker), { timeout: 1000 }).toContain(`preview-${tabId}`);
    }).toPass();
  }
}

/** The id of the tab with this title. */
const tabIdOf = (worker: Worker, title: string) =>
  worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id as number, title);

/** When a tab's picture was saved, or undefined when it has none. */
const savedAt = (worker: Worker, tabId: number) =>
  worker.evaluate(async (id) => {
    const key = `preview-${id}`;
    return ((await chrome.storage.session.get(key))[key] as { savedAt: number } | undefined)?.savedAt;
  }, tabId);

/**
 * Fills the session's memory to its last byte with old pictures of tabs closed long ago (keys from preview-100000 +
 * `from`): big ones, then small ones. Returns the number after the last one saved.
 */
const fillMemory = (worker: Worker, from: number) =>
  worker.evaluate(async (start) => {
    let next = start;
    for (const size of [512 * 1024, 1024, 16]) {
      for (;;) {
        const key = `preview-${100000 + next}`;
        try {
          await chrome.storage.session.set({ [key]: { picture: 'x'.repeat(size), savedAt: next } });
          next++;
        } catch {
          break;
        }
      }
    }
    return next;
  }, from);

/** Frees the session's memory filled by fillMemory (its newest items first) until `bytes` of it are free. */
const freeMemory = (worker: Worker, last: number, bytes: number) =>
  worker.evaluate(
    async ({ last, bytes }) => {
      const session = chrome.storage.session as typeof chrome.storage.session & { QUOTA_BYTES: number };
      for (let i = last - 1; session.QUOTA_BYTES - (await session.getBytesInUse(null)) < bytes; i--)
        await session.remove(`preview-${100000 + i}`);
    },
    { last, bytes },
  );

/** The room the previews leave for the switcher's own state (lib/previews/store.ts, STATE_ROOM_BYTES). */
const STATE_ROOM_BYTES = 1024 * 1024;

test.describe('grid @grid', () => {
  test('fits the tiles to the page, moves with the arrows, and leaves left and right to the search field', async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    // Two tiles across (lib/switcher/sizes.ts): 208 px each, with the switcher's margins and padding.
    await page.setViewportSize({ width: 600, height: 800 });
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(4);
    // Both rows of tiles in sight: the grid scrolls only when the page is too low for it.
    const grid = switcher(page).locator('[role="listbox"]');
    expect(await grid.evaluate((list) => list.scrollHeight - list.clientHeight)).toBe(0);
    await expect(selected(page)).toHaveAccessibleName(named('gamma'));
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await expect(selected(page)).toHaveAccessibleName(named('delta'));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('delta');
    // Typing in the search field, left and right move its cursor and select no tile.
    await showSwitcher(serviceWorker, 'next', 'icon');
    const field = switcher(page).getByRole('searchbox', { name: 'Search tabs' });
    await field.click();
    await page.keyboard.type('ta');
    await expect(rows(page)).toHaveCount(2);
    const caret = () => field.evaluate((input: HTMLInputElement) => input.selectionStart);
    expect(await caret()).toBe(2);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(caret).toBe(1);
    await expect(selected(page)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(caret).toBe(2);
    await expect(selected(page)).toHaveCount(0);
    await expect(field).toBeFocused();
  });

  test('opens with about as many columns as rows, all of them in sight', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta']);
    const page = pages[6] as Page;
    await page.setViewportSize({ width: 1280, height: 800 });
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(7);
    const grid = switcher(page).locator('[role="listbox"]');
    const fits = await grid.evaluate((list) => ({
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
      across: list.scrollWidth - list.clientWidth,
      down: list.scrollHeight - list.clientHeight,
    }));
    // Seven tabs: three columns, three rows, all in sight on a 1280 by 800 page.
    expect(fits).toEqual({ columns: 3, across: 0, down: 0 });
  });

  test('shows a picture of each tab used, the first one coming into the open switcher, never with the switcher in it', async ({
    context,
    serviceWorker,
  }) => {
    // The dark theme: a dark panel over the test site's white pages. No delay: the switcher would show at once, before
    // the picture is taken, did it not wait for it.
    await useSettings(serviceWorker, { view: 'grid', theme: 'dark', delayMs: 0 });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = pages[2] as Page;
    // The first opening, on a tab with no picture yet: its picture comes into the switcher while it is open.
    expect(await savedPictures(serviceWorker)).toEqual([]);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    const current = switcher(page).getByRole('option', { name: named('gamma') });
    await expect(current.locator('img[src^="data:image/webp"]')).toHaveCount(1);
    await expect(pictures(page)).toHaveCount(1);
    await expect(rows(page)).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    await useEach(serviceWorker, pages);
    await showSwitcher(serviceWorker);
    await expect(pictures(page)).toHaveCount(3);
    const kept = await serviceWorker.evaluate(async () => ({
      session: Object.keys(await chrome.storage.session.get(null)).filter((key) => key.startsWith('preview-')),
      local: Object.keys(await chrome.storage.local.get(null)).filter((key) => key.startsWith('preview-')),
    }));
    expect(kept.session).toHaveLength(3);
    expect(kept.local).toHaveLength(0);
    // Each picture is of the page alone: white where the switcher's panel would be.
    for (const key of kept.session)
      expect(await middleOfPicture(serviceWorker, Number(key.slice('preview-'.length)))).toBeGreaterThan(200);
  });

  test("keeps the new picture when the session's memory is full, the oldest going first, a tab's own counting as free", async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const [alpha] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    const filled = await fillMemory(serviceWorker, 0);
    await useEach(serviceWorker, [alpha]);
    const kept = await savedPictures(serviceWorker);
    expect(kept).not.toContain('preview-100000');
    expect(kept).toContain(`preview-${100000 + filled - 1}`);
    // Full again but for the room the previews leave for the switcher's state, alpha's picture taken again: the place
    // of its own preview is free, so no other preview goes.
    const refilled = await fillMemory(serviceWorker, filled);
    await freeMemory(serviceWorker, refilled, STATE_ROOM_BYTES + 512);
    const alphaId = await tabIdOf(serviceWorker, 'alpha');
    const others = async () => (await savedPictures(serviceWorker)).filter((key) => key !== `preview-${alphaId}`);
    const before = (await others()).length;
    const first = await savedAt(serviceWorker, alphaId);
    await expect(async () => {
      await showSwitcher(serviceWorker);
      await alpha.keyboard.press('Escape');
      await expect(rows(alpha)).toHaveCount(0);
      await expect.poll(() => savedAt(serviceWorker, alphaId), { timeout: 1000 }).not.toBe(first);
    }).toPass();
    expect((await others()).length).toBe(before);
  });

  test("leaves room for the switcher in a session's memory full of pictures: it opens, in a page and in its own window", async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const [alpha] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    // Full to the last byte but a little for the first opening's state, as old pictures would leave it.
    const filled = await fillMemory(serviceWorker, 0);
    await freeMemory(serviceWorker, filled, 512);
    await useEach(serviceWorker, [alpha]);
    // The picture kept, and room left for the switcher's own state: the oldest pictures went.
    const free = await serviceWorker.evaluate(async () => {
      const session = chrome.storage.session as typeof chrome.storage.session & { QUOTA_BYTES: number };
      return session.QUOTA_BYTES - (await session.getBytesInUse(null));
    });
    expect(free).toBeGreaterThanOrEqual(STATE_ROOM_BYTES);
    // The switcher opens where its state takes the most: its own window, on a Chrome page, with its window's tabs.
    const chromePage = await context.newPage();
    await chromePage.goto('chrome://version');
    await chromePage.bringToFront();
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect((await opened).getByRole('option')).toHaveCount(3);
  });

  test('keeps the pictures while the list is chosen, forgets them when the grid shows icons, and takes none then', async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    await useEach(serviceWorker, pages);
    const page = pages[2] as Page;
    // The list: the pictures stay, for when the grid comes back. Checked once the switcher showed the list, so the
    // background has heard of the new settings.
    await useSettings(serviceWorker, { view: 'list' });
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(switcher(page).getByRole('listbox')).not.toHaveCSS('display', 'grid');
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await savedPictures(serviceWorker)).toHaveLength(3);
    await useSettings(serviceWorker, { view: 'grid', gridShow: 'icons' });
    await expect.poll(() => savedPictures(serviceWorker)).toHaveLength(0);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(pictures(page)).toHaveCount(0);
    // No picture taken for the grid of icons: none saved once this switcher closed and another opened and closed.
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await savedPictures(serviceWorker)).toEqual([]);
  });

  test("switches to the grid from the switcher's toolbar, the same tab selected and the arrows moving it, and keeps it", async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const panel = switcher(page);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await panel.getByRole('radio', { name: 'Grid' }).locator('xpath=ancestor::label').click();
    await expect(panel.getByRole('listbox')).toHaveCSS('display', 'grid');
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => {
          const { settings } = await chrome.storage.local.get('settings');
          return (settings as { view?: string } | undefined)?.view;
        }),
      )
      .toBe('grid');
    // The tab selected in the list is still selected in the grid, and the arrows move from it.
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await page.keyboard.press('ArrowRight');
    await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(selected(page)).toHaveAccessibleName(named('gamma'));
    await expect(panel.getByRole('listbox')).toHaveCSS('display', 'grid');
  });
});

test.describe('grid of icons @grid', () => {
  test('moves with the arrows by tab and by row, naming the selected tab, and opens it with Enter', async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid', gridShow: 'icons' });
    const names = Array.from({ length: 12 }, (_, i) => `tab${String(i + 1).padStart(2, '0')}`);
    const pages = await openPages(context, names);
    const page = pages[11] as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(12);
    // Most recent first: tab12, tab11… tab01.
    const order = [...names].reverse();
    const grid = switcher(page).locator('[role="listbox"]');
    const columns = await grid.evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length);
    expect(columns).toBeGreaterThanOrEqual(2);
    // At least two rows, so that down has a row to go to from the first one.
    expect(columns).toBeLessThanOrEqual(9);
    // The selected tab's name, under the icons.
    const name = switcher(page).locator('[aria-hidden="true"]', { hasText: /^\w+$/ });
    await expect(selected(page)).toHaveAccessibleName(named('tab11'));
    await expect(name).toHaveText('tab11');
    await page.keyboard.press('ArrowRight');
    await expect(selected(page)).toHaveAccessibleName(named(order[2] as string));
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named(order[2 + columns] as string));
    await expect(name).toHaveText(order[2 + columns] as string);
    await page.keyboard.press('ArrowLeft');
    await expect(selected(page)).toHaveAccessibleName(named(order[1 + columns] as string));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe(order[1 + columns]);
  });
});

test.describe('grid tiles @grid', () => {
  test("forgets a tab's picture when the tab closes", async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    await useEach(serviceWorker, pages);
    const alphaId = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'alpha' }))[0]?.id);
    await (pages[0] as Page).close();
    await expect.poll(() => savedPictures(serviceWorker)).toHaveLength(2);
    expect(await savedPictures(serviceWorker)).not.toContain(`preview-${alphaId}`);
    const page = pages[2] as Page;
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(2);
    await expect(pictures(page)).toHaveCount(2);
  });

  test('closes a tab with a middle click on its tile', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await rows(page).filter({ hasText: 'alpha' }).click({ button: 'middle' });
    await expect(rows(page)).toHaveCount(2);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await expect
      .poll(() => serviceWorker.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.title).sort()))
      .toEqual(['beta', 'gamma']);
  });
});
