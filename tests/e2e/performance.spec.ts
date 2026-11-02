import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, extensionDir, test } from './fixtures';
import { openPages, openTabs, rows, showSwitcher, useSettings } from './helpers';

// How fast the switcher opens and how much code it loads. The sizes are the same on every machine: their limits are
// tight. The times change with the machine, and a busy machine makes any opening slower, never quicker: what is
// checked is the quickest of several openings, against a limit far above it on GitHub's machines (each test notes its
// times in the report). So it catches a switcher that became slow, never a machine busier than usual.

/** The most the code put into a page may weigh (the frame's holder), and the switcher's page with all it loads. */
const SIZE_LIMITS = { holder: 32 * 1024, frame: 128 * 1024 };

/**
 * The tabs open while the switcher is measured (the user's decision): more kept GitHub's machines busy opening them, so
 * the pages and the next tests' browsers answered late.
 */
const TABS = 30;

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
      await openTabs(serviceWorker, TABS - 1);
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
