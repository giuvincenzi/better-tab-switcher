import type { Page, TestInfo, Worker } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rows, selected, switcherFrame } from './helpers';
import { clickToolbarButton, focusAddressBar, focusBrowser, hold, press, release, screenPicture } from './system';

// The extension's own shortcuts, pressed on the system's keyboard: Chrome runs them (commands.onCommand), which
// Playwright's keys, sent to the page, never do. The browser's window on screen, with the system's focus.
test.use({ headed: true });

/** The key held with S: Alt, Control on the Mac (wxt.config.ts). */
const MODIFIER = process.platform === 'darwin' ? 'Control' : 'Alt';

/**
 * Records the keys the page and the switcher's frame get, and the commands the extension gets, for the test's report:
 * which of the system's keys reached them.
 */
async function recordKeys(page: Page, worker: Worker): Promise<(info: TestInfo) => Promise<void>> {
  // And the commands Chrome gives the extension: whether a key pressed reached it as its shortcut.
  await worker.evaluate(() => {
    const commands: string[] = [];
    Object.assign(globalThis, { commandsSeen: commands });
    chrome.commands.onCommand.addListener((command) => commands.push(`${command} ${Date.now()}`));
  });
  const listen = () => {
    const seen: string[] = [];
    Object.assign(globalThis, { keysSeen: seen });
    for (const type of ['keydown', 'keyup'])
      addEventListener(type, (event) => seen.push(`${type} ${(event as KeyboardEvent).key}`), true);
  };
  await page.evaluate(listen);
  return async (info) => {
    const read = () => (globalThis as unknown as { keysSeen?: string[] }).keysSeen ?? [];
    const frame = switcherFrame(page);
    const keys = {
      page: await page.evaluate(read).catch(() => []),
      frame: (await frame?.evaluate(read).catch(() => [])) ?? [],
      commands: await worker
        .evaluate(() => (globalThis as unknown as { commandsSeen?: string[] }).commandsSeen ?? [])
        .catch(() => []),
    };
    await info.attach('keys-seen', { body: JSON.stringify(keys, null, 2), contentType: 'application/json' });
    const screen = screenPicture();
    if (screen) await info.attach('screen', { body: screen, contentType: 'image/png' });
  };
}

/** In the switcher's frame too, once it is there: the keys it gets. */
async function recordFrameKeys(page: Page) {
  await switcherFrame(page)?.evaluate(() => {
    const seen: string[] = [];
    Object.assign(globalThis, { keysSeen: seen });
    for (const type of ['keydown', 'keyup'])
      addEventListener(type, (event) => seen.push(`${type} ${(event as KeyboardEvent).key}`), true);
  });
}

/** Waits until the switcher's frame is in the page: the keyboard opened the switcher, not the test. */
const frameIn = (page: Page) => expect.poll(() => switcherFrame(page) !== null).toBe(true);

/** A click in the page, as the user does: the keyboard's focus is in it, not in the address bar. */
async function focusPage(page: Page) {
  await page.mouse.click(10, 10);
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}

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
    await focusPage(page);
    const report = await recordKeys(page, serviceWorker);
    try {
      hold(MODIFIER);
      try {
        press('S');
        await frameIn(page);
        await recordFrameKeys(page);
        await expect(rows(page)).toHaveCount(3);
        await expect(selected(page)).toHaveAccessibleName(named('beta'));
        press('S');
        await expect(selected(page)).toHaveAccessibleName(named('alpha'));
      } finally {
        release(MODIFIER);
      }
      await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
    } finally {
      await report(test.info());
    }
    await expect(rows(page)).toHaveCount(0);
  });

  test('the previous tab shortcut opens the switcher on the oldest tab', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await focusBrowser(context, await windowOf(serviceWorker));
    await focusPage(page);
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

  test('stays open when the shortcut is let go in the address bar, which the page never hears, until a tab is chosen', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await focusBrowser(context, await windowOf(serviceWorker));
    focusAddressBar();
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);
    hold(MODIFIER);
    try {
      press('S');
      await frameIn(page);
      await expect(selected(page)).toHaveAccessibleName(named('beta'));
    } finally {
      release(MODIFIER);
    }
    // Still open: had it opened the selected tab on letting go, beta would be in front and alpha out of reach.
    await rows(page).filter({ hasText: 'alpha' }).click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });
});

test.describe("the extension's toolbar button @shortcut", () => {
  test('opens the switcher on the previous tab, open until a tab is chosen', async ({
    context,
    serviceWorker,
    extensionId,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await clickToolbarButton(context, extensionId, page.url());
    await frameIn(page);
    await expect(rows(page)).toHaveCount(3);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });
});
