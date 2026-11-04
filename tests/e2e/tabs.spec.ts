import type { BrowserContext, Page, Worker } from '@playwright/test';
import { contextOf, expect, test } from './fixtures';
import {
  activeTitle,
  boxOf,
  closeItsOwnTab,
  colorsAt,
  mouseOn,
  named,
  openPages,
  openTabs,
  openWindow,
  rowNames,
  rows,
  selected,
  showSwitcher,
  switcher,
  switcherFrame,
  useSettings,
} from './helpers';

function tabIdOf(worker: Worker, title: string): Promise<number> {
  return worker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.id as number, title);
}

const openTitles = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.tabs.query({})).map((tab) => tab.title).sort());

/** The tabs open for the list longer than the switcher: more than fit in it, so it scrolls. */
const TABS = 30;

test.describe('which tabs the switcher lists @tabs', () => {
  test("lists only the current window's tabs by default, and stays open when the other window changes or closes", async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    const delta = await openWindow(context, serviceWorker, 'delta');
    await openWindowTab(delta, serviceWorker, 'epsilon');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect.poll(() => rowNames(delta)).toEqual([named('delta'), named('epsilon')]);
    await expect(selected(delta)).toHaveAccessibleName(named('epsilon'));
    // Another tab comes to the front of the other window (the user isn't there: a site, another extension).
    const [alpha, beta] = await Promise.all([tabIdOf(serviceWorker, 'alpha'), tabIdOf(serviceWorker, 'beta')]);
    await serviceWorker.evaluate((id) => chrome.tabs.update(id, { active: true }), alpha);
    await expect.poll(() => serviceWorker.evaluate(async (id) => (await chrome.tabs.get(id)).active, alpha)).toBe(true);
    // The other window closes.
    const other = await serviceWorker.evaluate(async (id) => (await chrome.tabs.get(id)).windowId, beta);
    await serviceWorker.evaluate((id) => chrome.windows.remove(id), other);
    await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.windows.getAll()).length)).toBe(1);
    // Still the same switcher: the shortcut moves its selection on, where a new one would select epsilon again.
    await expect(rows(delta)).toHaveCount(2);
    await showSwitcher(serviceWorker);
    await expect(selected(delta)).toHaveAccessibleName(named('delta'));
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
    site,
  }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    // The site answers only at the end: until then the tab has no page of its own, only the address it is loading.
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    site.serve('slow.test', async () => {
      await answered;
      return { body: '<title>slow</title>' };
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
    await test.info().attach('rows', {
      body: JSON.stringify({
        rows: await rowNames(page),
        // As the extension reads it (tabs.query), and as tabs.get gives it.
        query: await serviceWorker.evaluate(async (id) => {
          const pick = (tab?: { url?: string; pendingUrl?: string; status?: string; title?: string }) =>
            tab && { url: tab.url, pendingUrl: tab.pendingUrl, status: tab.status, title: tab.title };
          return {
            query: pick((await chrome.tabs.query({})).find((tab) => tab.id === id)),
            get: pick(await chrome.tabs.get(id)),
          };
        }, slow),
      }),
      contentType: 'application/json',
    });
    // Its title is the browser's while it loads (the address in Chrome, the site in Microsoft Edge); its address is the
    // one it is loading.
    await expect(rows(page).filter({ hasText: 'slow.test' })).toHaveAccessibleName(/, slow\.test\/page$/);
    answer();
  });

  test('shows a tab whose page changes its title while the switcher is open with its new title, in its place', async ({
    context,
    serviceWorker,
  }) => {
    const [alpha, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect.poll(() => rowNames(page)).toEqual([named('gamma'), named('beta'), named('alpha')]);
    // The rows on screen now: a change of one tab updates its own row, and every row stays in the list as it was.
    const before = await rows(page).elementHandles();
    await alpha?.evaluate(() => {
      document.title = 'alpha (2 new messages)';
    });
    await expect
      .poll(() => rowNames(page))
      .toEqual([named('gamma'), named('beta'), 'alpha (2 new messages), bts.test/alpha']);
    for (const row of before) expect(await row.evaluate((element) => element.isConnected)).toBe(true);
  });

  test('leaves out the tabs closed or moved to another window while it is open, and lists the ones opened', async ({
    context,
    serviceWorker,
  }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(selected(page)).toHaveAccessibleName(named('gamma'));
    // Not from the switcher: a site closing itself, the user in another window, another extension.
    const [alpha, beta] = await Promise.all([tabIdOf(serviceWorker, 'alpha'), tabIdOf(serviceWorker, 'beta')]);
    await serviceWorker.evaluate(
      async ({ alpha, beta }) => {
        await chrome.tabs.remove(alpha);
        await chrome.windows.create({ tabId: beta, focused: false });
        await chrome.tabs.create({ url: 'https://bts.test/epsilon', active: false });
      },
      { alpha, beta },
    );
    // By their addresses: the new tab is still loading (its title the browser's until then).
    await expect
      .poll(async () => (await rowNames(page)).map((name) => name?.split(', ').pop()).sort())
      .toEqual(['bts.test/delta', 'bts.test/epsilon', 'bts.test/gamma']);
    // The selection stays on its tab, which opens.
    await expect(selected(page)).toHaveAccessibleName(named('gamma'));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('gamma');
  });

  test('lists more tabs than fit, the selection scrolled into sight', async ({ context, serviceWorker }) => {
    // The page the switcher opens in, and more tabs in the background, unloaded (as the performance tests open them):
    // more loaded pages only kept the machine and Playwright busy (on GitHub's Windows machines Playwright lost the
    // browser while it took a screenshot of each of 60 pages).
    const [page] = (await openPages(context, ['current'])) as [Page];
    await openTabs(serviceWorker, TABS - 1);
    await page.bringToFront();
    // Going back: the least recently used tab, the last row.
    await showSwitcher(serviceWorker, 'previous', 'icon');
    await expect(rows(page)).toHaveCount(TABS);
    const last = (await rows(page).last().getAttribute('aria-label')) as string;
    const first = (await rows(page).first().getAttribute('aria-label')) as string;
    await expect(selected(page)).toHaveAccessibleName(last);
    const list = switcher(page).locator('[role="listbox"]');
    expect(await list.evaluate((l) => l.scrollHeight > l.clientHeight)).toBe(true);
    await expect(selected(page)).toBeInViewport();
    await expect(rows(page).first()).not.toBeInViewport();
    // On past the last row, to the first.
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(first);
    await expect(selected(page)).toBeInViewport();
    await page.keyboard.press('ArrowUp');
    await expect(selected(page)).toHaveAccessibleName(last);
    // Enter opens it: the tab used longest ago, as Chrome says, the current one apart (the switcher lists it first).
    // Known by its id: unloaded, its title can be its address until it has loaded again (macOS Microsoft Edge).
    const leastUsed = await serviceWorker.evaluate(
      async () =>
        (await chrome.tabs.query({ currentWindow: true, active: false })).sort(
          (a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0),
        )[0]?.id,
    );
    await page.keyboard.press('Enter');
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id),
      )
      .toBe(leastUsed);
  });
});

test.describe('the details of each tab @tabs', () => {
  test("shows the tab group's color before the title, and none with Tab group color off", async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    const beta = await tabIdOf(serviceWorker, 'beta');
    await serviceWorker.evaluate(async (id) => {
      const group = await chrome.tabs.group({ tabIds: id });
      await chrome.tabGroups.update(group, { color: 'red' });
    }, beta);
    await showSwitcher(serviceWorker, 'next', 'icon');
    const dot = rows(page).filter({ hasText: 'beta' }).locator('[style*="--bts-group-"]');
    const box = await boxOf(dot);
    // Chrome's red for tab groups, in the light theme (styles/theme.css).
    await expect
      .poll(() => colorsAt(page, serviceWorker, [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]))
      .toEqual(['rgb(217, 48, 37)']);
    await expect(rows(page).filter({ hasText: 'alpha' }).locator('[style*="--bts-group-"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await useSettings(serviceWorker, { details: { groupColor: false } as never });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).locator('[style*="--bts-group-"]')).toHaveCount(0);
  });

  test('shows only the site with Full address off', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { details: { fullAddress: false } as never });
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect.poll(() => rowNames(page)).toEqual(['beta, bts.test', 'alpha, bts.test']);
  });

  test('cuts a long address short with “…” with Cut short, never moving it', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { details: { longAddress: 'cut' } as never });
    const long = `alpha-${'x'.repeat(150)}`;
    const [, current] = await openPages(context, [long, 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(selected(page)).toContainText('alpha-');
    await rows(page).filter({ hasText: 'alpha-' }).hover();
    const address = await selected(page).evaluate((row) => {
      const place = row.querySelector('[dir="ltr"]') as HTMLElement;
      return {
        longer: place.scrollWidth > place.clientWidth,
        cut: getComputedStyle(place).textOverflow,
        moving: (place.firstElementChild as HTMLElement).getAnimations().length,
      };
    });
    expect(address).toEqual({ longer: true, cut: 'ellipsis', moving: 0 });
  });

  test('shows how long ago each tab was used, and nothing of it with Last used off', async ({
    context,
    serviceWorker,
  }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page).filter({ hasText: 'alpha' })).toContainText('now');
    await page.keyboard.press('Escape');
    await useSettings(serviceWorker, { details: { lastUsed: false } as never });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).filter({ hasText: 'alpha' })).not.toContainText('now');
  });

  test('greys the tabs the browser unloaded, and none with Inactive tabs off', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await serviceWorker.evaluate(async (id) => chrome.tabs.discard(id), await tabIdOf(serviceWorker, 'alpha'));
    await showSwitcher(serviceWorker, 'next', 'icon');
    // Waited for, never read once: the switcher draws its rows again as the browser tells it of the tab it unloaded, and
    // a row read the moment it is replaced has no style (macOS Microsoft Edge read "").
    const row = (title: string) => rows(page).filter({ hasText: title });
    await expect(row('alpha')).toHaveCSS('opacity', '0.55');
    await expect(row('beta')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Escape');
    await useSettings(serviceWorker, { details: { sleeping: false } as never });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    await expect(row('alpha')).toHaveCSS('opacity', '1');
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
    // The user is in the popup: it has the system's focus.
    await popup.bringToFront();
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () =>
          (await chrome.windows.getAll()).some((window) => window.type === 'popup' && window.focused),
        ),
      )
      .toBe(true);
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(popup)).toHaveText([/^login/, /^beta/, /^alpha/]);
    // What reaches the row, for the report of a failed run (on GitHub's Linux the click was once not taken).
    await switcherFrame(popup)?.evaluate(() => {
      const seen: string[] = [];
      Object.assign(globalThis, { pointerSeen: seen });
      for (const type of ['pointerdown', 'pointerup', 'click'])
        addEventListener(
          type,
          (event) =>
            seen.push(
              `${type} ${(event.target as Element).closest('[role="option"]')?.getAttribute('aria-label') ?? (event.target as Element).localName}`,
            ),
          true,
        );
    });
    const alpha = rows(popup).filter({ hasText: 'alpha' });
    await mouseOn(alpha);
    await alpha.click();
    await test.info().attach('pointer-seen', {
      body: JSON.stringify(
        await switcherFrame(popup)?.evaluate(() => (globalThis as unknown as { pointerSeen: string[] }).pointerSeen),
      ),
      contentType: 'application/json',
    });
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

  test('lists a window opened by no tab, like an installed web app, first, then the tabs of the normal window used last', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await openWindow(context, serviceWorker, 'delta');
    // Back to the first window: the normal window used last, not the newest.
    const home = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'alpha' }))[0]?.windowId);
    await serviceWorker.evaluate((id) => chrome.windows.update(id as number, { focused: true }), home);
    await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.windows.getLastFocused()).id)).toBe(home);
    // An app's window: opened by the browser, not by a tab (no opener). Blank first, then the site: the test holds its
    // page from the start.
    const opened = context.waitForEvent('page');
    await serviceWorker.evaluate(() => chrome.windows.create({ type: 'popup', url: 'about:blank', focused: true }));
    const app = await opened;
    await app.goto('https://bts.test/app');
    await app.bringToFront();
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () =>
          (await chrome.windows.getAll()).some((window) => window.type === 'popup' && window.focused),
        ),
      )
      .toBe(true);
    expect(
      await serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'app' }))[0]?.openerTabId),
    ).toBeUndefined();
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect.poll(() => rowNames(app)).toEqual([named('app'), named('beta'), named('alpha')]);
  });
});

test.describe('tabs that move to another window @tabs', () => {
  // The system's focus, real: the browser's window on screen.
  test.use({ headed: true });

  test('opens a tab moved to another window while the switcher was open, in the window it is in now, which gets the focus', async ({
    context,
    serviceWorker,
  }) => {
    await useSettings(serviceWorker, { scope: 'all' });
    await openPages(context, ['alpha', 'beta']);
    await openWindow(context, serviceWorker, 'gamma');
    const delta = await openWindow(context, serviceWorker, 'delta');
    await delta.bringToFront();
    const windowOf = (title: string) =>
      serviceWorker.evaluate(async (t) => (await chrome.tabs.query({ title: t }))[0]?.windowId as number, title);
    const [first, gammaWindow, deltaWindow] = await Promise.all([
      windowOf('alpha'),
      windowOf('gamma'),
      windowOf('delta'),
    ]);
    const focusedWindows = () =>
      serviceWorker.evaluate(async () => (await chrome.windows.getAll()).filter((w) => w.focused).map((w) => w.id));
    await expect.poll(focusedWindows).toEqual([deltaWindow]);
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(delta)).toHaveCount(4);
    // While the switcher is open, alpha goes to gamma's window, behind gamma (the user drags it, or another extension).
    const alpha = await tabIdOf(serviceWorker, 'alpha');
    await serviceWorker.evaluate(({ id, to }) => chrome.tabs.move(id, { windowId: to, index: -1 }), {
      id: alpha,
      to: gammaWindow,
    });
    await expect.poll(() => windowOf('alpha')).toBe(gammaWindow);
    expect(first).not.toBe(gammaWindow);
    const row = rows(delta).filter({ hasText: 'alpha' });
    await mouseOn(row);
    await row.click();
    // Shown in the window it is in now, which comes to the front with the system's focus.
    await expect
      .poll(() =>
        serviceWorker.evaluate(
          async (id) => (await chrome.tabs.query({ active: true, windowId: id }))[0]?.title,
          gammaWindow,
        ),
      )
      .toBe('alpha');
    await expect.poll(focusedWindows).toEqual([gammaWindow]);
    await expect
      .poll(() => serviceWorker.evaluate(async () => (await chrome.windows.getLastFocused()).id))
      .toBe(gammaWindow);
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
    await closeItsOwnTab(page, delta);
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
    await closeItsOwnTab(page, delta);
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
    await closeItsOwnTab(page, delta);
    const instead = await shownInstead(serviceWorker, 'delta');
    await expect(selected(instead.page)).toHaveAccessibleName(named('beta'));
    // The key held since the switcher opened, let go in the page the switcher is in now.
    await instead.page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });
});

/**
 * The tab the browser shows instead of the one just closed (it chooses it itself), with its page, once the switcher
 * shows there. Its page is found by its address, which Playwright knows without asking the page: a tab behind, asked
 * its title, answered 8.5 s later on GitHub's macOS machines (Chrome runs the pages of tabs out of sight slower).
 */
async function shownInstead(worker: Worker, closed: string): Promise<{ title: string; page: Page }> {
  await expect.poll(() => openTitles(worker)).not.toContain(closed);
  const active = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return { title: tab?.title ?? '', url: tab?.url ?? '' };
  });
  const context = contextOf.get(worker) as BrowserContext;
  let page: Page | undefined;
  await expect
    .poll(async () => {
      page = context.pages().find((open) => open.url() === active.url);
      return page !== undefined && (await rows(page).count()) > 0;
    })
    .toBe(true);
  return { title: active.title, page: page as Page };
}

/** Opens one more tab of the test site in the window of `page`, behind it. */
async function openWindowTab(page: Page, worker: Worker, title: string): Promise<void> {
  const context = page.context();
  const windowId = await worker.evaluate(
    async (t) => (await chrome.tabs.query({ title: t }))[0]?.windowId as number,
    await page.title(),
  );
  // A blank tab first, then the site: the test holds its page from the start. About:blank, not the New Tab page
  // Microsoft Edge prepares in advance (openWindow).
  const opened = context.waitForEvent('page');
  await worker.evaluate((id) => chrome.tabs.create({ windowId: id, active: false, url: 'about:blank' }), windowId);
  await (await opened).goto(`https://bts.test/${title}`);
}
