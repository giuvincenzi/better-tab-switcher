import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rows, selected, switcherFrame } from './helpers';
import { focusBrowser, hold, press, release } from './system';

// The extension's own shortcuts, pressed on the system's keyboard: Chrome runs them (commands.onCommand), which
// Playwright's keys, sent to the page, never do. The browser's window on screen, with the system's focus.
test.use({ headed: true });

/** The key held with S: Alt, Control on the Mac (wxt.config.ts). */
const MODIFIER = process.platform === 'darwin' ? 'Control' : 'Alt';

/** Waits until the switcher's frame is in the page: the keyboard opened the switcher, not the test. */
const frameIn = (page: Page) => expect.poll(() => switcherFrame(page) !== null).toBe(true);

/** The browser's window the test pages are in, on the screen (for the system's click that brings it forward). */
const windowOf = (worker: Worker) =>
  worker.evaluate(async () => {
    const window = await chrome.windows.getLastFocused();
    return { left: window.left ?? 0, top: window.top ?? 0, width: window.width ?? 0, height: window.height ?? 0 };
  });

test.describe('the shortcuts on the keyboard @shortcut', () => {
  test('the next tab shortcut opens the switcher on the previous tab, again moves on, letting go opens it', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await focusBrowser(context, await windowOf(serviceWorker));
    hold(MODIFIER);
    try {
      press('S');
      await frameIn(page);
      await expect(rows(page)).toHaveCount(3);
      await expect(selected(page)).toHaveAccessibleName(named('beta'));
      press('S');
      await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    } finally {
      release(MODIFIER);
    }
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
    await expect(rows(page)).toHaveCount(0);
  });

  test('the previous tab shortcut opens the switcher on the oldest tab', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await focusBrowser(context, await windowOf(serviceWorker));
    hold(MODIFIER);
    hold('Shift');
    try {
      press('S');
      await frameIn(page);
      await expect(rows(page)).toHaveCount(3);
      await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    } finally {
      release('Shift');
      release(MODIFIER);
    }
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });
});
