import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { closeWithEscape, named, openPages, rows, selected, showSwitcher } from './helpers';
import { focusAnotherProgram } from './system';

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
  test('closes its window when another program comes to the front, and leaves the focus there', async ({
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
  });

  test('gives the focus back to the window it came from when closed with Esc', async ({ context, serviceWorker }) => {
    await openPages(context, ['alpha', 'beta']);
    await openChromePage(context);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['popup']);
    await closeWithEscape(switcherWindow);
    await expect.poll(() => focusedTypes(serviceWorker)).toEqual(['normal']);
  });
});
