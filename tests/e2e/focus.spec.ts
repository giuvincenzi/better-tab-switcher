import type { BrowserContext, Page, Worker } from '@playwright/test';
import { browserPipe, expect, test } from './fixtures';
import { closeWithEscape, named, openPages, openWindow, rows, selected, showSwitcher } from './helpers';
import { focusAnotherProgram, focusBrowser } from './system';

// The system's focus, real: the browser's window on screen, the other program brought to the front by the system.
test.use({ headed: true });

test.describe('the focus leaving the switcher in a page @focus', () => {
  test('closes the switcher when another program comes to the front', async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    const closeOther = await focusAnotherProgram();
    try {
      await expect(rows(page)).toHaveCount(0);
      // The browser's window lost the system's focus, as Chrome knows it.
      expect(
        await serviceWorker.evaluate(async () => (await chrome.windows.getAll()).some((window) => window.focused)),
      ).toBe(false);
    } finally {
      await closeOther();
    }
  });

  test('closes the switcher when another window of the browser comes to the front', async ({
    context,
    serviceWorker,
  }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    await serviceWorker.evaluate(() => chrome.windows.create({ focused: true }));
    await expect(rows(page)).toHaveCount(0);
  });

  test('keeps the switcher open when the page takes the focus as it loads, the keys still moving it', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await context.route('https://form.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>form</title><input aria-label="Search the site">' }),
    );
    const page = await context.newPage();
    await page.goto('https://form.test/');
    await page.bringToFront();
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    // As a site does once loaded: its search field takes the focus from the switcher's frame.
    await page.evaluate(() => (document.querySelector('input') as HTMLInputElement).focus());
    // The page passes the keys on to the switcher, which is still there.
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    await expect(rows(page)).toHaveCount(3);
  });
});

/** A page of Chrome's own, as the current tab: the switcher opens in its own window there. */
async function openChromePage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('chrome://version');
  await page.bringToFront();
  return page;
}

/** The browser's windows that have the system's focus, as Chrome knows it: their types. */
const focusedTypes = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.windows.getAll()).filter((w) => w.focused).map((w) => w.type));

test.describe("the focus leaving the switcher's own window @focus", () => {
  test('closes its window when another program comes to the front, leaves the focus there, and opens again with the shortcut', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['popup']);
    const closeOther = await focusAnotherProgram();
    try {
      await expect.poll(() => switcherWindow.isClosed()).toBe(true);
      // The other program keeps the focus: the browser brought none of its windows forward.
      expect(await focusedTypes(serviceWorker)).toEqual([]);
    } finally {
      await closeOther();
    }
    // Back in the browser, the switcher closed is forgotten: the shortcut opens a new window.
    const browserWindow = await serviceWorker.evaluate(async () => {
      const [window] = await chrome.windows.getAll({ windowTypes: ['normal'] });
      return { left: window?.left ?? 0, top: window?.top ?? 0, width: window?.width ?? 0, height: window?.height ?? 0 };
    });
    await focusBrowser(context, browserWindow);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['normal']);
    const again = context.waitForEvent('page');
    await showSwitcher(serviceWorker);
    const newWindow = await again;
    await expect(newWindow.getByRole('option')).toHaveCount(3);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['popup']);
  });

  test('gives the focus back to the window it came from when closed with Esc, even after the browser stopped the background', async ({
    context,
    serviceWorker,
    extensionId,
  }) => {
    // It proves the extension's part on Windows and macOS: on GitHub's Linux desktop (no window manager) the system
    // gives the focus back to the last window by itself, whatever the extension does.
    await openPages(context, ['alpha', 'beta']);
    await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['popup']);
    // Stopped as Chrome stops a background left unused for 30 seconds (Target.closeTarget, Chrome's guide for
    // extensions, "Test service worker termination"): the new one the browser starts on Esc still knows the window the
    // switcher came from.
    const send = browserPipe.get(context) as (method: string, params?: object) => Promise<unknown>;
    const backgrounds = async () =>
      (
        (await send('Target.getTargets')) as { targetInfos: { targetId: string; type: string; url: string }[] }
      ).targetInfos.filter(
        (target) => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${extensionId}/`),
      );
    const [stopped] = await backgrounds();
    await send('Target.closeTarget', { targetId: stopped?.targetId });
    await expect
      .poll(async () => (await backgrounds()).some((target) => target.targetId === stopped?.targetId))
      .toBe(false);
    await closeWithEscape(switcherWindow);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['normal']);
  });

  test('closes its window and opens one switcher in the page when the shortcut is pressed in another window', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await openWindow(context, serviceWorker, 'delta');
    const chromePage = await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).not.toHaveCount(0);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['popup']);
    // The user goes to the other browser window and presses the shortcut there at once.
    const otherUrl = await serviceWorker.evaluate(async (chromeUrl) => {
      const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
      const other = windows.find((window) => !window.tabs?.some((tab) => tab.url === chromeUrl));
      await chrome.windows.update(other?.id as number, { focused: true });
      return other?.tabs?.find((tab) => tab.active)?.url;
    }, chromePage.url());
    await showSwitcher(serviceWorker);
    const other = context.pages().find((page) => page.url() === otherUrl) as Page;
    await expect(rows(other)).not.toHaveCount(0);
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
    // One switcher: no window of its own, and none in another page.
    expect(context.pages().filter((page) => page.url().endsWith('/switcher-window.html'))).toHaveLength(0);
    for (const page of context.pages()) if (page !== other) await expect(rows(page)).toHaveCount(0);
  });
});
