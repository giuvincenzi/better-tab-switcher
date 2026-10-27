import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, openPages, rows, selected, showSwitcher, useSettings } from './helpers';

test.describe('switcher in a page @switcher', () => {
  test('lists the tabs most recently used first, the previous one selected', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    await showSwitcher(serviceWorker);
    const page = current as Page;
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).locator('img + div')).toHaveText(['gamma', 'beta', 'alpha']);
    await expect(selected(page)).toContainText('beta');
  });

  test('opens the selected tab when Alt is released', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect(rows(page)).toHaveCount(0);
  });

  test('goes further when the shortcut is pressed again', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('alpha');
    await showSwitcher(serviceWorker, 'previous');
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });

  test('moves with the arrows and opens with Enter', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toContainText('alpha');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test('opens a tab with a click', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await rows(page).filter({ hasText: 'alpha' }).click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test('closes with Esc and stays on the same tab', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('gamma');
  });

  test('closes a tab from its close button and stays open', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const alpha = rows(page).filter({ hasText: 'alpha' });
    await alpha.hover();
    await alpha.getByRole('button', { name: 'Close tab' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect
      .poll(() => serviceWorker.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.title)))
      .not.toContain('alpha');
  });
});

test.describe('switcher theme @switcher', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows in the ${theme} theme when it is chosen in the settings`, async ({ context, serviceWorker }) => {
      await useSettings(serviceWorker, { theme });
      const [, current] = await openPages(context, ['alpha', 'beta']);
      const page = current as Page;
      await showSwitcher(serviceWorker);
      const list = page.getByRole('listbox', { name: 'Open tabs, most recent first' });
      await expect(list).toHaveCSS('color-scheme', theme);
    });
  }
});

test.describe('switcher in its own window @switcher', () => {
  test('opens in a window of its own over a Chrome page, and switches from there', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    const chromePage = await context.newPage();
    await chromePage.goto('chrome://version');
    await chromePage.bringToFront();
    const opened = context.waitForEvent('page', (page) => page.url().endsWith('/switcher-window.html'));
    await showSwitcher(serviceWorker);
    const window = await opened;
    const listed = window.locator('[role="option"]');
    await expect(listed.first()).toContainText('About Version');
    await expect(window.locator('[role="option"][aria-selected="true"]')).toContainText('beta');
    await window.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect.poll(() => window.isClosed()).toBe(true);
  });
});
