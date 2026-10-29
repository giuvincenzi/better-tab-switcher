import type { BrowserContext, Frame, Locator, Page, Worker } from '@playwright/test';
import type { BrowserName } from '../../lib/browser';
import type { Settings } from '../../lib/settings/settings';
import { contextOf, expect } from './fixtures';

/**
 * Pages of a site that exists only in the tests (Playwright serves them, nothing goes to the network), as the only
 * tabs: the blank tab Chromium starts with is closed.
 */
export async function openPages(context: BrowserContext, titles: string[]): Promise<Page[]> {
  await context.route('https://bts.test/**', (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    return route.fulfill({ contentType: 'text/html', body: `<title>${name}</title><h1>${name}</h1>` });
  });
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
  if (page) await expect.poll(() => switcherFrame(page) !== null).toBe(true);
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

/** A new browser window, the last focused one, with one page of the test site in it. */
export async function openWindow(context: BrowserContext, worker: Worker, title: string): Promise<Page> {
  const opened = context.waitForEvent('page');
  await worker.evaluate(() => chrome.windows.create({}));
  const page = await opened;
  await page.goto(`https://bts.test/${title}`);
  return page;
}

/**
 * From now on, records the windows the extension brings to the front (windows.update with focused): headless Chromium
 * moves no focus between windows by itself, so a test checks what the extension asked. focusedWindows reads them.
 */
export function recordFocusedWindows(worker: Worker) {
  return worker.evaluate(() => {
    const focused: number[] = [];
    const update = chrome.windows.update.bind(chrome.windows);
    Object.assign(globalThis, { focusedByTheExtension: focused });
    chrome.windows.update = ((windowId: number, info: { focused?: boolean }) => {
      if (info.focused) focused.push(windowId);
      return update(windowId, info);
    }) as never;
  });
}

/** The windows the extension brought to the front since recordFocusedWindows. */
export function focusedWindows(worker: Worker): Promise<number[]> {
  return worker.evaluate(() => (globalThis as unknown as { focusedByTheExtension: number[] }).focusedByTheExtension);
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
