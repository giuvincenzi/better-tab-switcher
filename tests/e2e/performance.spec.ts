import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Worker } from '@playwright/test';
import { expect, extensionDir, test } from './fixtures';
import { openPages, rows, showSwitcher, useSettings } from './helpers';

// How fast the switcher opens and how much code it loads. The sizes are the same on every machine: their limits are
// tight. The times change with the machine: their limits are far above the times measured on GitHub's machines (each
// test notes its times in the report), so they catch a switcher that became slow, never a machine slower than usual.

/** The most the code put into a page may weigh (the frame's holder), and the switcher's page with all it loads. */
const SIZE_LIMITS = { holder: 32 * 1024, frame: 128 * 1024 };

/**
 * The most an opening may take, by number of tabs, in milliseconds: the median of several openings. About 4 times the
 * slowest median on GitHub's machines (Linux, Windows and macOS, Chromium and Microsoft Edge): 70 ms with 50 tabs,
 * 170 ms with 200 and 385 ms with 500, in the list.
 */
const TIME_LIMITS: Record<number, number> = { 50: 300, 200: 700, 500: 1500 };

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
        for (let run = 0; run < 5; run++) {
          const started = performance.now();
          await showSwitcher(serviceWorker, 'next', 'icon');
          await expect(rows(current).first()).toBeVisible();
          times.push(Math.round(performance.now() - started));
          await current.keyboard.press('Escape');
          await expect(rows(current)).toHaveCount(0);
        }
        const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] as number;
        test.info().annotations.push({ type: `${count} tabs`, description: `${times.join(', ')} ms` });
        expect(median, `${count} tabs: ${times.join(', ')} ms`).toBeLessThanOrEqual(TIME_LIMITS[count] as number);
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
