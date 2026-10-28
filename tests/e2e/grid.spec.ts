import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, openPages, rows, selected, showSwitcher, useSettings } from './helpers';

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
    const grid = page.locator('better-tab-switcher [role="listbox"]');
    expect(await grid.evaluate((list) => list.scrollHeight - list.clientHeight)).toBe(0);
    await expect(selected(page)).toHaveAccessibleName('gamma');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName('alpha');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await expect(selected(page)).toHaveAccessibleName('delta');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('delta');
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
    const switcher = page.locator('better-tab-switcher');
    await switcher.locator('label', { has: page.getByRole('radio', { name: 'Grid' }) }).click();
    await expect(switcher.getByRole('listbox')).toHaveCSS('display', 'grid');
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
