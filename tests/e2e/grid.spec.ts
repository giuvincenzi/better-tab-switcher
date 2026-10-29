import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rows, selected, showSwitcher, switcher, useSettings } from './helpers';

const pictures = (page: Page) => rows(page).locator('img[src^="data:image/webp"]');

const savedPictures = (worker: Worker) =>
  worker.evaluate(async () =>
    Object.keys(await chrome.storage.session.get(null)).filter((k) => k.startsWith('preview-')),
  );

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

test.describe('grid @grid', () => {
  test('fits the tiles to the page and moves with the arrows', async ({ context, serviceWorker }) => {
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

  test('shows a picture of each tab used, taken in memory', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    await useEach(serviceWorker, pages);
    const page = pages[2] as Page;
    await showSwitcher(serviceWorker);
    await expect(pictures(page)).toHaveCount(3);
    const kept = await serviceWorker.evaluate(async () => ({
      session: Object.keys(await chrome.storage.session.get(null)).filter((key) => key.startsWith('preview-')),
      local: Object.keys(await chrome.storage.local.get(null)).filter((key) => key.startsWith('preview-')),
    }));
    expect(kept.session).toHaveLength(3);
    expect(kept.local).toHaveLength(0);
  });

  test("keeps the new picture when the session's memory is full, the oldest going first", async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const [alpha] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    // Old pictures of tabs closed long ago fill the memory to its last byte: big ones, then small ones.
    const filled = await serviceWorker.evaluate(async () => {
      let next = 0;
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
    });
    await useEach(serviceWorker, [alpha]);
    const kept = await savedPictures(serviceWorker);
    expect(kept).not.toContain('preview-100000');
    expect(kept).toContain(`preview-${100000 + filled - 1}`);
  });

  test('forgets the pictures when the grid shows icons', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    await useEach(serviceWorker, pages);
    const page = pages[2] as Page;
    await useSettings(serviceWorker, { view: 'grid', gridShow: 'icons' });
    await expect.poll(() => savedPictures(serviceWorker)).toHaveLength(0);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(pictures(page)).toHaveCount(0);
  });

  test("switches to the grid from the switcher's toolbar, and keeps it", async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const panel = switcher(page);
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
