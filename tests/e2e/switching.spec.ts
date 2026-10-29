import type { BrowserContext, Frame, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  activeTitle,
  closeWithEscape,
  focusedWindows,
  openPages,
  openWindow,
  recordFocusedWindows,
  rows,
  selected,
  showSwitcher,
  switcher,
  switcherFrame,
  useSettings,
} from './helpers';

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

  test('takes the keys the page gets while its frame has no focus: the arrows move, letting go of Alt opens the tab', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toHaveAccessibleName('beta');
    // The focus goes back to the page, as it is while the frame loads the first time: the page gets the keys.
    await switcherFrame(page)?.evaluate(() => window.parent.focus());
    await expect.poll(() => page.evaluate(() => document.activeElement?.localName)).not.toBe('better-tab-switcher');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName('alpha');
    await page.keyboard.up('Alt');
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
    await expect(switcher(page).getByRole('listbox', { name: 'Open tabs, most recent first' })).toBeHidden();
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

test.describe('a page that hangs @switching', () => {
  test('gets the switcher in its own window, never shows one late, and the shortcut keeps working in other tabs', async ({
    context,
    serviceWorker,
  }) => {
    const [, beta] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    // A page with a script that, once started, runs for 12 seconds: the page answers nothing meanwhile, long past the
    // time the background waits for it.
    await context.route('https://hang.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<title>hang</title><script>
          window.hang = () => setTimeout(() => { const end = Date.now() + 12000; while (Date.now() < end) {} });
        </script>`,
      }),
    );
    const hanging = await context.newPage();
    await hanging.goto('https://hang.test/');
    await hanging.bringToFront();
    // The switcher has been in this page before: its script is there, and would show what it gets, even late.
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(hanging)).toHaveCount(3);
    await hanging.keyboard.press('Escape');
    await expect(rows(hanging)).toHaveCount(0);
    await hanging.evaluate(() => (window as unknown as { hang: () => void }).hang());
    // Until the page has stopped answering: a question it doesn't answer in 300 ms.
    await expect
      .poll(() =>
        Promise.race([
          hanging.evaluate(() => 'answers').catch(() => 'answers'),
          new Promise((busy) => setTimeout(() => busy('busy'), 300)),
        ]),
      )
      .toBe('busy');
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    // Once the page answers again, what it was sent meanwhile is too late: no switcher shows in it.
    await hanging.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done))));
    await expect(rows(hanging)).toHaveCount(0);
    // The user closes it and goes to another tab, where the shortcut opens the switcher at once.
    await closeWithEscape(switcherWindow);
    await beta.bringToFront();
    await showSwitcher(serviceWorker);
    await expect(rows(beta)).toHaveCount(3);
  });
});

test.describe("the switcher's own window @switching", () => {
  test('closes its window when another window takes the focus, and leaves the focus there', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await openChromePage(context);
    await recordFocusedWindows(serviceWorker);
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    // Another window took the focus (headless Chromium moves no focus between windows: the event says it).
    await switcherWindow.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
    expect(await focusedWindows(serviceWorker)).toEqual([]);
  });

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
    await closeWithEscape(switcherWindow);
    await expect.poll(lastFocusedType).toBe('normal');
    // The Chrome page is still the current tab, and the shortcut opens a new switcher on it.
    expect(await activeTitle(serviceWorker)).toBe(await chromePage.title());
    const again = context.waitForEvent('page');
    await showSwitcher(serviceWorker);
    await expect((await again).getByRole('option')).toHaveCount(3);
  });

  test("is as large as over a page and fits the switcher exactly, with Chrome's zoom", async ({
    context,
    serviceWorker,
  }) => {
    const [alpha] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    const chromePage = await openChromePage(context);
    const first = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const firstWindow = await first;
    await expect(firstWindow.getByRole('option')).toHaveCount(3);
    // Chrome keeps a zoom for each site: zoomed here, the extension's pages open zoomed from now on.
    await firstWindow.evaluate(() => chrome.tabs.setZoom(1.5));
    await closeWithEscape(firstWindow);

    await chromePage.bringToFront();
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    expect(await switcherWindow.evaluate(() => chrome.tabs.getZoom())).toBe(1.5);
    const panelSize = (where: Page | Frame) =>
      where.evaluate(() => {
        // The panel, in the backdrop that covers the page.
        const panel = document.querySelector('dialog > * > *')?.getBoundingClientRect();
        return { width: Math.ceil(panel?.width ?? 0), height: Math.ceil(panel?.height ?? 0) };
      });
    // Its window is as large as the switcher.
    await expect
      .poll(async () => {
        const panel = await panelSize(switcherWindow);
        const page = await switcherWindow.evaluate(() => ({ width: innerWidth, height: innerHeight }));
        return Math.abs(panel.width - page.width) <= 1 && Math.abs(panel.height - page.height) <= 1;
      })
      .toBe(true);
    const inWindow = await panelSize(switcherWindow);
    await closeWithEscape(switcherWindow);

    // Over a web page of the same Chrome window, with the same zoom, the switcher is as wide.
    await alpha.bringToFront();
    await serviceWorker.evaluate(async () => {
      const [current] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await chrome.tabs.setZoom(current?.id as number, 1.5);
    });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(alpha)).toHaveCount(3);
    expect((await panelSize(switcherFrame(alpha) as Frame)).width).toBe(inWindow.width);
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
    // Only the key press: the switcher opens the tab on it, and its window can be gone before a key release would arrive.
    await switcherWindow.keyboard.down('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('gamma');
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
  });
});
