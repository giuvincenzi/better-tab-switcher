import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  activeTitle,
  focusedWindows,
  openPages,
  openWindow,
  recordFocusedWindows,
  rows,
  selected,
  showSwitcher,
  switcher,
  useSettings,
} from './helpers';

const titles = (page: Page) => rows(page).locator('img + div');

function tabIdOf(worker: Worker, title: string): Promise<number> {
  return worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id as number, title);
}

const openTitles = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.tabs.query({})).map((tab) => tab.title).sort());

test.describe('which tabs the switcher lists @tabs', () => {
  test("lists only the current window's tabs by default", async ({ context, serviceWorker }) => {
    await openPages(context, ['alpha', 'beta']);
    const delta = await openWindow(context, serviceWorker, 'delta');
    await openWindowTab(delta, 'epsilon');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(titles(delta)).toHaveText(['delta', 'epsilon']);
  });

  test("lists every window's tabs with All windows, each other window's with its number", async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { scope: 'all' });
    await openPages(context, ['alpha', 'beta']);
    const delta = await openWindow(context, serviceWorker, 'delta');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(delta)).toHaveCount(3);
    await expect(rows(delta).first()).toHaveAccessibleName('delta');
    await expect(rows(delta).filter({ hasText: 'alpha' })).toHaveAccessibleName('alpha, Window 2');
    await expect(rows(delta).filter({ hasText: 'beta' })).toHaveAccessibleName('beta, Window 2');
  });

  test('hides the pinned tabs, but the current one, with Show pinned tabs off', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { showPinned: false });
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    const ids = await Promise.all(['beta', 'delta'].map((t) => tabIdOf(serviceWorker, t)));
    await serviceWorker.evaluate(
      (pinned) => Promise.all(pinned.map((id) => chrome.tabs.update(id, { pinned: true }))),
      ids,
    );
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(titles(page)).toHaveText(['delta', 'gamma', 'alpha']);
  });

  test('marks pinned and inactive tabs', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    const [alpha, beta] = await Promise.all(['alpha', 'beta'].map((t) => tabIdOf(serviceWorker, t)));
    await serviceWorker.evaluate(
      async ([pin, sleep]) => {
        await chrome.tabs.update(pin as number, { pinned: true });
        await chrome.tabs.discard(sleep as number);
      },
      [alpha, beta],
    );
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).filter({ hasText: 'alpha' })).toHaveAccessibleName('alpha, Pinned');
    await expect(rows(page).filter({ hasText: 'beta' })).toHaveAccessibleName('beta, Inactive');
    await expect(rows(page).filter({ hasText: 'gamma' })).toHaveAccessibleName('gamma');
  });

  test('lists 60 tabs, the selection scrolled into sight', async ({ context, serviceWorker }) => {
    // Opening 60 pages takes most of a test's time on a slow machine (macOS on GitHub).
    test.slow();
    const names = Array.from({ length: 60 }, (_, i) => `tab${String(i + 1).padStart(2, '0')}`);
    const pages = await openPages(context, names);
    const page = pages[59] as Page;
    // Going back: the least recently used tab, at the bottom of the list.
    await showSwitcher(serviceWorker, 'previous', 'icon');
    await expect(rows(page)).toHaveCount(60);
    await expect(selected(page)).toHaveAccessibleName('tab01');
    const list = switcher(page).locator('[role="listbox"]');
    expect(await list.evaluate((l) => l.scrollHeight > l.clientHeight)).toBe(true);
    await expect(selected(page)).toBeInViewport();
    await expect(rows(page).first()).not.toBeInViewport();
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName('tab60');
    await expect(selected(page)).toBeInViewport();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('tab01');
  });
});

test.describe("a site's popup window @tabs", () => {
  test('lists the popup first, then the tabs of the window it was opened from, and opens the one chosen', async ({
    context,
    serviceWorker,
  }) => {
    const [, beta] = (await openPages(context, ['alpha', 'beta'])) as [Page, Page];
    // A sign-in window, as a site opens one.
    const opened = context.waitForEvent('page');
    await beta.evaluate(() => window.open('https://bts.test/login', 'login', 'popup,width=600,height=500'));
    const popup = await opened;
    await expect(popup).toHaveTitle('login');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(popup)).toHaveText([/^login/, /^beta/, /^alpha/]);
    await recordFocusedWindows(serviceWorker);
    await rows(popup).filter({ hasText: 'alpha' }).click();
    const home = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'alpha' }))[0]?.windowId);
    await expect
      .poll(() =>
        serviceWorker.evaluate(async (id) => (await chrome.tabs.query({ active: true, windowId: id }))[0]?.title, home),
      )
      .toBe('alpha');
    expect(await focusedWindows(serviceWorker)).toEqual([home]);
  });
});

test.describe('closing tabs from the switcher @tabs', () => {
  test('closes a tab with a middle click, the selection staying on its tab', async ({ context, serviceWorker }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName('beta');
    await rows(page).filter({ hasText: 'gamma' }).click({ button: 'middle' });
    await expect(titles(page)).toHaveText(['delta', 'beta', 'alpha']);
    await expect(selected(page)).toHaveAccessibleName('beta');
    await expect.poll(() => openTitles(serviceWorker)).toEqual(['alpha', 'beta', 'delta']);
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });

  test('closes the selected tab, the selection going to the next one', async ({ context, serviceWorker }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    const gamma = rows(page).filter({ hasText: 'gamma' });
    await expect(gamma).toHaveAttribute('aria-selected', 'true');
    await gamma.hover();
    await gamma.getByRole('button', { name: 'Close tab' }).click();
    await expect(titles(page)).toHaveText(['delta', 'beta', 'alpha']);
    await expect(selected(page)).toHaveAccessibleName('beta');
    await expect.poll(() => openTitles(serviceWorker)).toEqual(['alpha', 'beta', 'delta']);
  });
});

/** Opens one more tab of the test site in the window of `page`, behind it. */
async function openWindowTab(page: Page, title: string): Promise<void> {
  const context = page.context();
  const worker = context.serviceWorkers()[0] as Worker;
  const windowId = await worker.evaluate(
    async (t) => (await chrome.tabs.query({ title: t }))[0]?.windowId as number,
    await page.title(),
  );
  // A blank tab first, then the site: Playwright serves the site only to the pages it already knows.
  const opened = context.waitForEvent('page');
  await worker.evaluate((id) => chrome.tabs.create({ windowId: id, active: false }), windowId);
  await (await opened).goto(`https://bts.test/${title}`);
}
