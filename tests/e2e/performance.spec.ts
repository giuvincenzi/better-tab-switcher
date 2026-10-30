import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Frame, Page, Worker } from '@playwright/test';
import { expect, extensionDir, test } from './fixtures';
import { openPages, rows, showSwitcher, switcherFrame, useSettings } from './helpers';

// How fast the switcher opens and how much code it loads. The sizes are the same on every machine: their limits are
// tight. The times change with the machine, and a busy machine makes any opening slower, never quicker: what is
// checked is the quickest of several openings, against a limit far above it on GitHub's machines (each test notes its
// times in the report). So it catches a switcher that became slow, never a machine busier than usual.

/** The most the code put into a page may weigh (the frame's holder), and the switcher's page with all it loads. */
const SIZE_LIMITS = { holder: 32 * 1024, frame: 128 * 1024 };

/**
 * The tabs open while the switcher is measured. At most 50 in every test: hundreds of tabs kept GitHub's Windows
 * machines busy for minutes, so the pages and the next tests' browsers answered late.
 */
const TABS = 50;

/**
 * The most the quickest opening may take, in milliseconds. About 4 times the slowest of the quickest openings on
 * GitHub's machines (Linux, Windows and macOS, Chromium and Microsoft Edge): 134 ms with 50 tabs, in the list.
 */
const TIME_LIMIT = 500;

/** The openings measured, after a first one (the first in a page also loads the frame). */
const OPENINGS = 5;

test.describe('performance @performance', () => {
  test("keeps the switcher's code small", () => {
    const size = (path: string) => statSync(join(extensionDir, path)).size;
    const holder = size('content-scripts/switcher.js');
    // The switcher's page and every script and style it loads.
    const page = readFileSync(join(extensionDir, 'switcher-frame.html'), 'utf8');
    const loaded = [...page.matchAll(/(?:src|href)="\/([^"]+)"/g)].map((found) => found[1] as string);
    const frame = size('switcher-frame.html') + loaded.reduce((sum, path) => sum + size(path), 0);
    test.info().annotations.push({ type: 'sizes', description: `holder ${holder} B, frame ${frame} B` });
    expect(loaded.length).toBeGreaterThan(0);
    expect(holder).toBeLessThanOrEqual(SIZE_LIMITS.holder);
    expect(frame).toBeLessThanOrEqual(SIZE_LIMITS.frame);
  });

  for (const view of ['list', 'grid'] as const) {
    test(`opens quickly with ${TABS} tabs, in the ${view}`, async ({ context, serviceWorker }) => {
      await useSettings(serviceWorker, { view, gridShow: 'icons' });
      const [current] = (await openPages(context, ['current'])) as [Page];
      await openTabs(serviceWorker, 1, TABS);
      await current.bringToFront();
      const times: number[] = [];
      for (let run = 0; run <= OPENINGS; run++) {
        const started = performance.now();
        await showSwitcher(serviceWorker, 'next', 'icon');
        await expect(rows(current).first()).toBeVisible();
        times.push(Math.round(performance.now() - started));
        await current.keyboard.press('Escape');
        await expect(rows(current)).toHaveCount(0);
      }
      const quickest = Math.min(...times.slice(1));
      test.info().annotations.push({ type: `${TABS} tabs`, description: `${times.join(', ')} ms` });
      expect(quickest, `${TABS} tabs: ${times.join(', ')} ms`).toBeLessThanOrEqual(TIME_LIMIT);
    });
  }
});

test.describe('a slow machine @performance', () => {
  test(`shows the switcher in the page with ${TABS} tabs even when drawing them takes longer than a page has to answer`, async ({
    context,
    serviceWorker,
  }) => {
    test.setTimeout(60_000);
    const [current] = (await openPages(context, ['current'])) as [Page];
    await openTabs(serviceWorker, 1, TABS);
    await current.bringToFront();
    // A first opening makes the switcher's frame; then its process runs 100 times slower, as on a slow machine
    // (Chrome's CPU throttling, DevTools' own): drawing the tabs takes longer than the second a page has to answer
    // (without the frame answering at once, the switcher goes to its own window).
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(current).first()).toBeVisible();
    await current.keyboard.press('Escape');
    await expect(rows(current)).toHaveCount(0);
    const session = await context.newCDPSession(switcherFrame(current) as Frame);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 100 });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(current).first()).toBeVisible({ timeout: 30_000 });
    // In the page, never its own window.
    expect(context.pages().some((page) => page.url().endsWith('/switcher-window.html'))).toBe(false);
  });
});

/**
 * More tabs of the test site, from `from` to `to`, in the background and unloaded: they take no memory. Chrome unloads
 * no tab still loading: once none is, those left loaded are unloaded, so the switcher is measured with the tabs open,
 * not while the machine loads hundreds of pages (the page it opens in would answer late).
 */
function openTabs(worker: Worker, from: number, to: number) {
  return worker.evaluate(
    async ({ from, to }) => {
      for (let i = from; i < to; i++) {
        const tab = await chrome.tabs.create({ url: `https://bts.test/tab-${i}`, active: false });
        await chrome.tabs.discard(tab.id as number).catch(() => undefined);
      }
      while ((await chrome.tabs.query({ status: 'loading' })).length > 0)
        await new Promise((resolve) => setTimeout(resolve, 100));
      for (const tab of await chrome.tabs.query({ active: false, discarded: false }))
        await chrome.tabs.discard(tab.id as number).catch(() => undefined);
    },
    { from, to },
  );
}
