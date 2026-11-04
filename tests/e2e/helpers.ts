import type { BrowserContext, Frame, Locator, Page, Worker } from '@playwright/test';
import type { BrowserName } from '../../lib/browser';
import type { Settings } from '../../lib/settings/settings';
import { contextOf, expect } from './fixtures';

/**
 * Pages of a site that exists only in the tests (bts.test, served on this machine: tests/e2e/site.ts), as the only
 * tabs: the blank tab Chromium starts with is closed.
 */
export async function openPages(context: BrowserContext, titles: string[]): Promise<Page[]> {
  const blank = context.pages();
  const pages: Page[] = [];
  for (const title of titles) {
    const page = await context.newPage();
    await page.goto(`https://bts.test/${title}`);
    pages.push(page);
  }
  for (const page of blank) await page.close();
  // Used one after the other: the last one is the current tab, the first the least recently used.
  for (const page of pages) {
    await page.bringToFront();
    await page.waitForTimeout(20);
  }
  return pages;
}

/**
 * Asks for the switcher as the shortcut does (`direction`), or as the toolbar icon does (`from: 'icon'`). Shown in a
 * page, the switcher is in its frame: Playwright learns of a new frame a moment after the extension made it, so this
 * waits until it knows it, for switcher() to find it.
 */
export async function showSwitcher(
  worker: Worker,
  direction: 'next' | 'previous' = 'next',
  from: 'shortcut' | 'icon' = 'shortcut',
) {
  await worker.evaluate((request) => globalThis.betterTabSwitcherTest.requestSwitcher(request), { direction, from });
  const shownIn = await worker.evaluate(async () => {
    const { openSwitcher } = (await chrome.storage.session.get('openSwitcher')) as {
      openSwitcher?: { in: string; tabId: number } | null;
    };
    return openSwitcher?.in === 'page' ? (await chrome.tabs.get(openSwitcher.tabId)).url : undefined;
  });
  const page = shownIn
    ? contextOf
        .get(worker)
        ?.pages()
        .find((open) => open.url() === shownIn)
    : undefined;
  if (!page) return;
  await expect.poll(() => switcherFrame(page) !== null).toBe(true);
  // Until the switcher is on screen, as a user sees it before clicking: its frame drawn once (two animation frames: the
  // first runs before the next drawing, the second after it). On GitHub's macOS machines Microsoft Edge drew it after
  // Playwright had found its search field visible and stable in the page, and a click then went to the page below.
  await switcherFrame(page)?.evaluate(
    () => new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn))),
  );
}

export function activeTitle(worker: Worker) {
  return worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.title);
}

/**
 * The switcher's frame in a page. Its holder is a closed shadow root that neither the page nor Playwright's locators see
 * into, so the frame is found among the page's frames. It stays in the page, hidden, once the first switcher has shown
 * there; before, there is none.
 */
export function switcherFrame(page: Page): Frame | null {
  return page.frame({ url: /\/switcher-frame\.html$/ });
}

/** The switcher open in a page: its modal dialog, in its frame. Before the first switcher there, nothing to find. */
export function switcher(page: Page): Locator {
  return switcherFrame(page)?.locator('body > dialog') ?? page.locator('no-switcher-frame-in-this-page');
}

export const rows = (page: Page) => switcher(page).locator('[role="option"]');
export const selected = (page: Page) => switcher(page).locator('[role="option"][aria-selected="true"]');

/** The accessible names of the tabs shown, in their order: for expect.poll. */
export const rowNames = (page: Page) =>
  rows(page).evaluateAll((options) => options.map((option) => option.getAttribute('aria-label')));

/**
 * A page of the test site (openPages) as the switcher names it with the default tab details: its title and its whole
 * website address, without https://.
 */
export const named = (title: string) => `${title}, bts.test/${title}`;

/**
 * The browser the tests run in (E2E_BROWSER, launched by tests/e2e/fixtures.ts), as lib/browser.ts names it: the tests
 * ask lib/browser.ts what differs in it (its values are checked by tests/unit/browser.test.ts).
 */
export const testBrowser: BrowserName = process.env.E2E_BROWSER === 'msedge' ? 'edge' : 'chrome';

/**
 * The next and previous tab shortcuts' default keys, as the extension's manifest suggests them (wxt.config.ts) for the
 * system the tests run on: the Mac has its own.
 */
export async function defaultShortcuts(worker: Worker): Promise<{ next: string; previous: string }> {
  const commands = await worker.evaluate(() => chrome.runtime.getManifest().commands);
  const keys = (name: string) => {
    const suggested = commands?.[name]?.suggested_key;
    if (typeof suggested === 'string') return suggested;
    return (process.platform === 'darwin' ? (suggested?.mac ?? suggested?.default) : suggested?.default) ?? '';
  };
  return { next: keys('next-tab'), previous: keys('previous-tab') };
}

/**
 * A shortcut as Chrome writes it on the system the tests run on: "Alt+Shift+S" on Linux and Windows, the Mac's symbols
 * on macOS ("⌃⇧S"), in the order Chrome puts them (⌃ ⌥ ⇧ ⌘).
 */
export function shortcutText(keys: string): string {
  if (process.platform !== 'darwin') return keys;
  const symbols: Record<string, string> = { Ctrl: '⌃', MacCtrl: '⌃', Alt: '⌥', Shift: '⇧', Command: '⌘' };
  const parts = keys.split('+');
  const key = parts.pop() ?? '';
  return parts.map((part) => symbols[part] ?? part).join('') + key;
}

/** Saves these settings as the settings page would, before the switcher opens. */
export function useSettings(worker: Worker, settings: Partial<Settings>) {
  return worker.evaluate((saved) => chrome.storage.local.set({ settings: saved }), settings);
}

/**
 * A new browser window, the last focused one, with one page of the test site in it. Opened on about:blank: without an
 * address it would show the New Tab page, which Microsoft Edge prepares in advance and then puts in the window as a page
 * Playwright never hears of (a target of type "other": seen on GitHub's macOS machines).
 */
export async function openWindow(context: BrowserContext, worker: Worker, title: string): Promise<Page> {
  const opened = context.waitForEvent('page');
  await worker.evaluate(() => chrome.windows.create({ url: 'about:blank' }));
  const page = await opened;
  await page.goto(`https://bts.test/${title}`);
  return page;
}

/**
 * Does what closes the switcher's own window (a key, a click) and waits until the window is closed. The window can be
 * gone before Chromium confirms the key or the click it closed on (seen on slow macOS machines), and Playwright then
 * fails the action: that error is expected only once the window is closed. Any other error fails the test, and so does
 * a window that stays open.
 */
export async function closeBy(window: Page, act: () => Promise<void>): Promise<void> {
  const closed = window.waitForEvent('close');
  await act().catch((error: unknown) => {
    if (!window.isClosed()) throw error;
  });
  await closed;
  expect(window.isClosed()).toBe(true);
}

/** Presses Esc in the switcher's own window (only the press: the switcher closes on it) and waits until it is closed. */
export const closeWithEscape = (window: Page) => closeBy(window, () => window.keyboard.down('Escape'));

/**
 * The colors on screen at these points of a page (in its CSS pixels), as the user sees them: a real screenshot of the
 * page, its frames included (the switcher's), read by the browser itself (the extension's background decodes it).
 * Read with expect.poll: a frame paints a moment after its elements are there (the switcher's rows in the DOM, its
 * panel not yet on screen).
 */
export async function colorsAt(page: Page, worker: Worker, points: { x: number; y: number }[]): Promise<string[]> {
  const shot = (await page.screenshot()).toString('base64');
  const width = await page.evaluate(() => innerWidth);
  return worker.evaluate(
    async ({ shot, points, width }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${shot}`)).blob());
      // The picture's own pixels for each of the page's: devicePixelRatio can say otherwise a moment (macOS), and a
      // point read outside the picture would be black.
      const scale = bitmap.width / width;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      context.drawImage(bitmap, 0, 0);
      return points.map(({ x, y }) => {
        const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      });
    },
    { shot, points, width },
  );
}

/** A point of the switcher's panel that shows only its background: inside its padding, halfway down its left side. */
export async function panelPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await boxOf(switcher(page).locator('[style*="--panel-width"]'));
  return { x: box.x + 4, y: box.y + box.height / 2 };
}

/**
 * Moves the mouse onto a tab of the switcher and waits until it is there: its close button shows under the mouse.
 * Right after the switcher shows, the browser may not route the mouse to its frame yet; the user's mouse is on a tab
 * before clicking it too.
 */
export async function mouseOn(row: Locator) {
  await expect(async () => {
    await row.hover();
    await expect(row.getByRole('button', { name: 'Close tab' })).toBeVisible({ timeout: 500 });
  }).toPass();
}

/**
 * Clicks a row's Close tab in the page that click closes (the tab the switcher is shown in), until the page is gone:
 * the page may close before Playwright sees the click end, which it reports as an error that is the result expected.
 */
export async function closeItsOwnTab(page: Page, row: Locator) {
  const closed = page.waitForEvent('close');
  await row
    .getByRole('button', { name: 'Close tab' })
    .click()
    .catch((error) => {
      if (!page.isClosed()) throw error;
    });
  await closed;
}

/**
 * Where an element is on the page, once it is there: the switcher draws its rows again as the tabs change, and an element
 * read the moment it is replaced has no box yet.
 */
export async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect
    .poll(async () => (box = await locator.boundingBox()), { message: `${locator} on the page` })
    .not.toBeNull();
  return box as unknown as { x: number; y: number; width: number; height: number };
}

/**
 * `count` more tabs of the test site, in the background and unloaded: they take no memory, so the switcher is measured
 * with the tabs open, not while the machine loads pages (the page it opens in would answer late). Chrome unloads no tab
 * still loading: a tab Chrome didn't unload at once is unloaded once it has loaded. One that never loads fails the
 * test, named, instead of the test running out of time.
 */
export async function openTabs(worker: Worker, count: number) {
  const ids = await worker.evaluate(async (count) => {
    const ids: number[] = [];
    for (let i = 1; i <= count; i++) {
      const tab = await chrome.tabs.create({ url: `https://bts.test/tab-${i}`, active: false });
      ids.push(tab.id as number);
      // Refused while the tab is loading: done below, once it has loaded.
      await chrome.tabs.discard(tab.id as number).catch(() => undefined);
    }
    return ids;
  }, count);
  const stillLoading = () =>
    worker.evaluate(
      async (ids) =>
        (await chrome.tabs.query({ status: 'loading' }))
          .filter((tab) => ids.includes(tab.id as number))
          .map((tab) => tab.url),
      ids,
    );
  await expect.poll(stillLoading, { message: 'tabs that never finished loading', timeout: 20_000 }).toEqual([]);
  await worker.evaluate(async (ids) => {
    for (const tab of await chrome.tabs.query({ active: false, discarded: false }))
      if (ids.includes(tab.id as number)) await chrome.tabs.discard(tab.id as number).catch(() => undefined);
  }, ids);
}
