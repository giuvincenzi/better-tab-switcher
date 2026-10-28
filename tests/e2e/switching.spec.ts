import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, openPages, openWindow, rows, selected, showSwitcher, useSettings } from './helpers';

/** A Chrome page (Chrome keeps extensions out of it) as the current tab: the switcher opens in its own window there. */
async function openChromePage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('chrome://version');
  await page.bringToFront();
  return page;
}

test.describe('how the switcher switches @switching', () => {
  test("stays open when the shortcut's key is released, with Stay open until you choose a tab", async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { stayOpen: true });
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toHaveAccessibleName('beta');
    await page.keyboard.up('Alt');
    // Still open: the arrows move the selection, Enter opens the tab.
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName('alpha');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test('opens the selected tab by itself after the Auto-select time', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { autoSelect: true, autoSelectSeconds: 1 });
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    // From the toolbar icon: no key is held, nothing but Auto-select opens a tab.
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(selected(page)).toHaveAccessibleName('beta');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect(rows(page)).toHaveCount(0);
  });

  test('switches to the previous tab with a tap quicker than the delay, never showing the switcher', async ({
    context,
    serviceWorker,
  }) => {
    // A delay long enough that the release comes before it, whatever the machine.
    await useSettings(serviceWorker, { delayMs: 1000 });
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByRole('listbox', { name: 'Open tabs, most recent first' })).toBeHidden();
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect(rows(page)).toHaveCount(0);
  });

  test('opens again with the shortcut after its page reloaded', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await page.reload();
    await expect(rows(page)).toHaveCount(0);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(selected(page)).toHaveAccessibleName('beta');
  });

  test('closes in the window it was open in when it opens in another window', async ({ context, serviceWorker }) => {
    const [, first] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(first)).toHaveCount(2);
    const second = await openWindow(context, serviceWorker, 'delta');
    await showSwitcher(serviceWorker);
    await expect(rows(second)).toHaveCount(1);
    await expect(rows(first)).toHaveCount(0);
  });
});

test.describe("the switcher's own window @switching", () => {
  test('closes its window with Esc, and the shortcut then opens a new one on the same page', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    const chromePage = await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    // The last focused window, the one the shortcut acts on: the switcher's window while it is open, the browser window
    // once it closed (headless Chromium gives the focus back by itself: this does not prove the extension does).
    const lastFocusedType = () => serviceWorker.evaluate(async () => (await chrome.windows.getLastFocused()).type);
    await expect.poll(lastFocusedType).toBe('popup');
    await switcherWindow.keyboard.press('Escape');
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
    await expect.poll(lastFocusedType).toBe('normal');
    // The Chrome page is still the current tab, and the shortcut opens a new switcher on it.
    expect(await activeTitle(serviceWorker)).toBe(await chromePage.title());
    const again = context.waitForEvent('page');
    await showSwitcher(serviceWorker);
    await expect((await again).getByRole('option')).toHaveCount(3);
  });

  test('moves its selection when the shortcut is pressed again', async ({ context, serviceWorker }) => {
    await openPages(context, ['alpha', 'beta', 'gamma']);
    await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker);
    const switcherWindow = await opened;
    const chosen = switcherWindow.locator('[role="option"][aria-selected="true"]');
    await expect(chosen).toHaveAccessibleName('gamma');
    await showSwitcher(serviceWorker);
    await expect(chosen).toHaveAccessibleName('beta');
    await showSwitcher(serviceWorker, 'previous');
    await expect(chosen).toHaveAccessibleName('gamma');
    // Still the one window.
    expect(context.pages().filter((page) => page.url().startsWith('chrome-extension://'))).toHaveLength(1);
    await switcherWindow.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('gamma');
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
  });
});
