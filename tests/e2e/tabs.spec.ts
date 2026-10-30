import type { BrowserContext, Page, Worker } from '@playwright/test';
import { contextOf, expect, test } from './fixtures';
import {
  activeTitle,
  named,
  openPages,
  openWindow,
  rowNames,
  rows,
  selected,
  showSwitcher,
  switcher,
  useSettings,
} from './helpers';

function tabIdOf(worker: Worker, title: string): Promise<number> {
  return worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id as number, title);
}

const openTitles = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.tabs.query({})).map((tab) => tab.title).sort());

test.describe('which tabs the switcher lists @tabs', () => {
  test("lists only the current window's tabs by default", async ({ context, serviceWorker }) => {
    await openPages(context, ['alpha', 'beta']);
    const delta = await openWindow(context, serviceWorker, 'delta');
    await openWindowTab(delta, serviceWorker, 'epsilon');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect.poll(() => rowNames(delta)).toEqual([named('delta'), named('epsilon')]);
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
    await expect(rows(delta).first()).toHaveAccessibleName(named('delta'));
    await expect(rows(delta).filter({ hasText: 'alpha' })).toHaveAccessibleName('alpha, bts.test/alpha, Window 2');
    await expect(rows(delta).filter({ hasText: 'beta' })).toHaveAccessibleName('beta, bts.test/beta, Window 2');
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
    await expect.poll(() => rowNames(page)).toEqual(['delta, bts.test/delta, Pinned', named('gamma'), named('alpha')]);
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
    await expect(rows(page).filter({ hasText: 'alpha' })).toHaveAccessibleName('alpha, bts.test/alpha, Pinned');
    await expect(rows(page).filter({ hasText: 'beta' })).toHaveAccessibleName('beta, bts.test/beta, Inactive');
    await expect(rows(page).filter({ hasText: 'gamma' })).toHaveAccessibleName(named('gamma'));
  });

  test('names a tab still loading its first page by the address it is loading, and asks for no icon of nothing', async ({
    context,
    serviceWorker,
  }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    // The site answers only at the end: until then the tab has no page of its own, only the address it is loading.
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await context.route('https://slow.test/**', async (route) => {
      await answered;
      await route.fulfill({ contentType: 'text/html', body: '<title>slow</title>' }).catch(() => {});
    });
    const slow = await serviceWorker.evaluate(
      async () => (await chrome.tabs.create({ url: 'https://slow.test/page', active: false })).id as number,
    );
    // No page of its own yet. Chrome gives such a tab an empty url and the address in pendingUrl (on macOS, a tab in the
    // background it hasn't started loading: the address as its url); Microsoft Edge, the address as its url.
    await expect
      .poll(() =>
        serviceWorker.evaluate(
          async (id) => (({ url, pendingUrl }) => url || pendingUrl)(await chrome.tabs.get(id)),
          slow,
        ),
      )
      .toBe('https://slow.test/page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    // Its title is the browser's while it loads (the address in Chrome, the site in Microsoft Edge); its address is the
    // one it is loading.
    await expect(rows(page).filter({ hasText: 'slow.test' })).toHaveAccessibleName(/, slow\.test\/page$/);
    answer();
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
    await expect(selected(page)).toHaveAccessibleName(named('tab01'));
    const list = switcher(page).locator('[role="listbox"]');
    expect(await list.evaluate((l) => l.scrollHeight > l.clientHeight)).toBe(true);
    await expect(selected(page)).toBeInViewport();
    await expect(rows(page).first()).not.toBeInViewport();
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('tab60'));
    await expect(selected(page)).toBeInViewport();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('tab01');
  });
});

test.describe("a site's popup window @tabs", () => {
  // The system's focus, real: the browser's window on screen.
  test.use({ headed: true });

  test('lists the popup first, then the tabs of the window it was opened from, and opens the one chosen there', async ({
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
    await rows(popup).filter({ hasText: 'alpha' }).click();
    const home = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'alpha' }))[0]?.windowId);
    await expect
      .poll(() =>
        serviceWorker.evaluate(async (id) => (await chrome.tabs.query({ active: true, windowId: id }))[0]?.title, home),
      )
      .toBe('alpha');
    // Its window comes to the front, with the system's focus.
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => (await chrome.windows.getAll()).filter((w) => w.focused).map((w) => w.id)),
      )
      .toEqual([home]);
  });
});

test.describe('closing tabs from the switcher @tabs', () => {
  test('closes a tab with a middle click, the selection staying on its tab', async ({ context, serviceWorker }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await rows(page).filter({ hasText: 'gamma' }).click({ button: 'middle' });
    await expect.poll(() => rowNames(page)).toEqual([named('delta'), named('beta'), named('alpha')]);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await expect.poll(() => openTitles(serviceWorker)).toEqual(['alpha', 'beta', 'delta']);
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });

  test('closes a tab far from the selection with a middle click, the list staying where it was scrolled', async ({
    context,
    serviceWorker,
  }) => {
    test.slow();
    const names = Array.from({ length: 25 }, (_, i) => `tab${String(i + 1).padStart(2, '0')}`);
    const pages = await openPages(context, names);
    const page = pages[24] as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(25);
    await expect(selected(page)).toHaveAccessibleName(named('tab24'));
    // The user scrolls down to the oldest tabs, away from the selected one at the top.
    await switcher(page)
      .locator('[role="listbox"]')
      .evaluate((list) => {
        list.scrollTop = list.scrollHeight;
      });
    await expect(selected(page)).not.toBeInViewport();
    await rows(page).filter({ hasText: 'tab02' }).click({ button: 'middle' });
    await expect(rows(page)).toHaveCount(24);
    await expect(rows(page).filter({ hasText: 'tab01' })).toBeInViewport();
    await expect(selected(page)).not.toBeInViewport();
  });

  test('closes the selected tab, the selection going to the next one', async ({ context, serviceWorker }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    const gamma = rows(page).filter({ hasText: 'gamma' });
    await expect(gamma).toHaveAttribute('aria-selected', 'true');
    await gamma.hover();
    await gamma.getByRole('button', { name: 'Close tab' }).click();
    await expect.poll(() => rowNames(page)).toEqual([named('delta'), named('beta'), named('alpha')]);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await expect.poll(() => openTitles(serviceWorker)).toEqual(['alpha', 'beta', 'delta']);
  });

  test('closes the tab it is shown in, and opens again in the tab the browser shows instead, the same tab selected', async ({
    context,
    serviceWorker,
  }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    const delta = rows(page).filter({ hasText: 'delta' });
    await delta.hover();
    await delta.getByRole('button', { name: 'Close tab' }).click();
    // The browser chose the tab to show instead of delta; the switcher opened there and changed nothing else.
    const instead = await shownInstead(serviceWorker, 'delta');
    await expect.poll(() => rowNames(instead.page)).toHaveLength(3);
    expect((await rowNames(instead.page))[0]).toBe(named(instead.title));
    await expect(selected(instead.page)).toHaveAccessibleName(named('beta'));
    expect(await activeTitle(serviceWorker)).toBe(instead.title);
    expect(await openTitles(serviceWorker)).toEqual(['alpha', 'beta', 'gamma']);
    expect(await serviceWorker.evaluate(async () => (await chrome.windows.getAll()).length)).toBe(1);
    // Still open until a tab is chosen, as from the toolbar icon.
    await instead.page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });

  test('closes the tab it is shown in from the search results, and opens again with the same search', async ({
    context,
    serviceWorker,
  }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await switcher(page).getByRole('searchbox').fill('l');
    await expect.poll(() => rowNames(page)).toEqual([named('delta'), named('alpha')]);
    const delta = rows(page).filter({ hasText: 'delta' });
    await delta.hover();
    await delta.getByRole('button', { name: 'Close tab' }).click();
    const instead = await shownInstead(serviceWorker, 'delta');
    await expect(switcher(instead.page).getByRole('searchbox')).toHaveValue('l');
    await expect.poll(() => rowNames(instead.page)).toEqual([named('alpha')]);
    await expect(selected(instead.page)).toHaveAccessibleName(named('alpha'));
  });

  test('closes the tab it is shown in while the shortcut is held: letting go opens the selected tab there', async ({
    context,
    serviceWorker,
  }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    const delta = rows(page).filter({ hasText: 'delta' });
    await delta.hover();
    await delta.getByRole('button', { name: 'Close tab' }).click();
    const instead = await shownInstead(serviceWorker, 'delta');
    await expect(selected(instead.page)).toHaveAccessibleName(named('beta'));
    // The key held since the switcher opened, let go in the page the switcher is in now.
    await instead.page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });
});

/**
 * The tab the browser shows instead of the one just closed (it chooses it itself), with its page, once the switcher
 * shows there.
 */
async function shownInstead(worker: Worker, closed: string): Promise<{ title: string; page: Page }> {
  await expect.poll(() => openTitles(worker)).not.toContain(closed);
  const title = (await activeTitle(worker)) as string;
  const context = contextOf.get(worker) as BrowserContext;
  let page: Page | undefined;
  await expect
    .poll(async () => {
      for (const open of context.pages()) if ((await open.title().catch(() => '')) === title) page = open;
      return page !== undefined && (await rows(page).count()) > 0;
    })
    .toBe(true);
  return { title, page: page as Page };
}

/** Opens one more tab of the test site in the window of `page`, behind it. */
async function openWindowTab(page: Page, worker: Worker, title: string): Promise<void> {
  const context = page.context();
  const windowId = await worker.evaluate(
    async (t) => (await chrome.tabs.query({ title: t }))[0]?.windowId as number,
    await page.title(),
  );
  // A blank tab first, then the site: Playwright serves the site only to the pages it already knows.
  const opened = context.waitForEvent('page');
  await worker.evaluate((id) => chrome.tabs.create({ windowId: id, active: false }), windowId);
  await (await opened).goto(`https://bts.test/${title}`);
}
