import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { Settings } from '../../lib/settings/settings';

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

export function showSwitcher(worker: Worker, direction: 'next' | 'previous' = 'next') {
  return worker.evaluate((d) => globalThis.betterTabSwitcherTest.showSwitcher(d, false), direction);
}

export function activeTitle(worker: Worker) {
  return worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.title);
}

export const rows = (page: Page) => page.locator('better-tab-switcher [role="option"]');
export const selected = (page: Page) => page.locator('better-tab-switcher [role="option"][aria-selected="true"]');

/** Saves these settings as the settings page would, before the switcher opens. */
export function useSettings(worker: Worker, settings: Partial<Settings>) {
  return worker.evaluate((saved) => chrome.storage.local.set({ settings: saved }), settings);
}
