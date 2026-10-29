import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Worker } from '@playwright/test';
import { expect, extensionDir, test } from './fixtures';
import { openPages, rows, showSwitcher, useSettings } from './helpers';

// How fast the switcher opens and how much code it loads. The sizes are the same on every machine: their limits are
// tight. The times change with the machine, and a busy machine makes any opening slower, never quicker: what is
// checked is the quickest of several openings, against a limit far above it on GitHub's machines (each test notes its
// times in the report). So it catches a switcher that became slow, never a machine busier than usual.

/** The most the code put into a page may weigh (the frame's holder), and the switcher's page with all it loads. */
const SIZE_LIMITS = { holder: 32 * 1024, frame: 128 * 1024 };

/**
 * The most the quickest opening may take, by number of tabs, in milliseconds. About 4 times the slowest of the quickest
 * openings on GitHub's machines (Linux, Windows and macOS, Chromium and Microsoft Edge): 134 ms with 50 tabs, 203 ms
 * with 200 and 452 ms with 500, in the list.
 */
const TIME_LIMITS: Record<number, number> = { 50: 500, 200: 800, 500: 1800 };

/** The openings measured for each number of tabs, after a first one (the first in a page also loads the frame). */
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
    test(`opens quickly with 50, 200 and 500 tabs, in the ${view}`, async ({ context, serviceWorker }) => {
      test.setTimeout(180_000);
      await useSettings(serviceWorker, { view, gridShow: 'icons' });
      const [current] = (await openPages(context, ['current'])) as [Page];
      let tabs = 1;
      for (const count of [50, 200, 500]) {
        await openTabs(serviceWorker, tabs, count);
        tabs = count;
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
        test.info().annotations.push({ type: `${count} tabs`, description: `${times.join(', ')} ms` });
        expect(quickest, `${count} tabs: ${times.join(', ')} ms`).toBeLessThanOrEqual(TIME_LIMITS[count] as number);
      }
    });
  }
});

/** More tabs of the test site, from `from` to `to`, in the background and unloaded: they take no memory. */
function openTabs(worker: Worker, from: number, to: number) {
  return worker.evaluate(
    async ({ from, to }) => {
      for (let i = from; i < to; i++) {
        const tab = await chrome.tabs.create({ url: `https://bts.test/tab-${i}`, active: false });
        await chrome.tabs.discard(tab.id as number).catch(() => undefined);
      }
    },
    { from, to },
  );
}
