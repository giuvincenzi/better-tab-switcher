import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rows, showSwitcher, switcher, useSettings } from './helpers';

/** The rows whole in sight in the list: those its scrolling shows entirely. */
const rowsInSight = (page: Page) =>
  switcher(page)
    .getByRole('listbox')
    .evaluate((list) => {
      const box = list.getBoundingClientRect();
      return [...list.querySelectorAll('[role="option"]')].filter((row) => {
        const r = row.getBoundingClientRect();
        return r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
      }).length;
    });

/** The height of a row on screen, in pixels. */
const rowHeight = async (page: Page) => (await rows(page).first().boundingBox())?.height ?? 0;

test.describe("the list's look @views", () => {
  test('makes the rows shorter with Compact', async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    const normal = await rowHeight(page);
    await page.keyboard.press('Escape');
    await useSettings(serviceWorker, { compact: true });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    expect(await rowHeight(page)).toBeLessThan(normal * 0.8);
  });

  /** Twenty tabs, the switcher open on them. */
  async function twentyTabs(context: BrowserContext, worker: Worker) {
    const names = Array.from({ length: 20 }, (_, i) => `tab${String(i + 1).padStart(2, '0')}`);
    const page = (await openPages(context, names))[19] as Page;
    await showSwitcher(worker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(20);
    return page;
  }

  test('shows 6 tabs before scrolling with Tabs shown before scrolling at 6', async ({ context, serviceWorker }) => {
    test.slow();
    await useSettings(serviceWorker, { listRows: 6 });
    const page = await twentyTabs(context, serviceWorker);
    await expect.poll(() => rowsInSight(page)).toBe(6);
  });

  test('shows only as many tabs as the window has room for, the switcher whole in it, when more are asked', async ({
    context,
    serviceWorker,
  }) => {
    test.slow();
    await useSettings(serviceWorker, { listRows: 15 });
    const page = await twentyTabs(context, serviceWorker);
    const panel = await switcher(page).locator('[style*="--panel-width"]').boundingBox();
    const height = await page.evaluate(() => innerHeight);
    expect((panel?.y ?? -1) >= 0 && (panel?.y ?? 0) + (panel?.height ?? Infinity) <= height).toBe(true);
    const inSight = await rowsInSight(page);
    expect(inSight).toBeGreaterThan(6);
    expect(inSight).toBeLessThan(15);
  });
});

test.describe('the mouse in the switcher @views', () => {
  test('closes on a click outside the panel, staying on the same tab', async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    // The mouse reaches the switcher first, as the user's does: right after it shows, the browser may not route the
    // mouse to its frame yet. A tab's close button shows under the mouse.
    const alpha = rows(page).filter({ hasText: 'alpha' });
    await expect(async () => {
      await alpha.hover();
      await expect(alpha.getByRole('button', { name: 'Close tab' })).toBeVisible({ timeout: 500 });
    }).toPass();
    await page.mouse.click(5, 5);
    await expect(rows(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('beta');
  });

  test('scrolls the list with the wheel, the page behind it staying where it is', async ({
    context,
    serviceWorker,
  }) => {
    test.slow();
    const names = Array.from({ length: 30 }, (_, i) => `tab${String(i + 1).padStart(2, '0')}`);
    const pages = await openPages(context, names);
    const page = pages[29] as Page;
    await page.evaluate(() => {
      document.body.style.height = '5000px';
    });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(30);
    const list = switcher(page).getByRole('listbox');
    await list.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('opens the tab of an icon clicked in the grid of icons', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view: 'grid', gridShow: 'icons' });
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await switcher(page)
      .getByRole('option', { name: named('alpha') })
      .click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });
});
