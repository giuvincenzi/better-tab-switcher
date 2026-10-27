import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, openPages, rows, selected, showSwitcher, useSettings } from './helpers';

const pictures = (page: Page) => rows(page).locator('img[src^="data:image/webp"]');

const savedPictures = (worker: Worker) =>
  worker.evaluate(async () =>
    Object.keys(await chrome.storage.session.get(null)).filter((k) => k.startsWith('preview-')),
  );

/** Uses each page in turn, as a person would: each one stays in front until its picture is taken. */
async function useEach(worker: Worker, pages: Page[]) {
  for (const page of pages) {
    await page.bringToFront();
    const title = await page.title();
    const tabId = await worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id, title);
    await expect.poll(() => savedPictures(worker)).toContain(`preview-${tabId}`);
  }
}

test.describe('grid @grid', () => {
  test('shows the tabs as tiles and moves with the arrows', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid', gridColumns: 2 });
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(4);
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

  test('forgets the pictures when Previews is turned off', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid' });
    const pages = await openPages(context, ['alpha', 'beta', 'gamma']);
    await useEach(serviceWorker, pages);
    const page = pages[2] as Page;
    await useSettings(serviceWorker, { view: 'grid', previews: false });
    await expect.poll(() => savedPictures(serviceWorker)).toHaveLength(0);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(pictures(page)).toHaveCount(0);
  });
});
