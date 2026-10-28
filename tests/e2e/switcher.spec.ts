import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, openPages, rows, selected, showSwitcher, switcher, useSettings } from './helpers';

test.describe('switcher in a page @switcher', () => {
  test('lists the tabs most recently used first, the previous one selected', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    await showSwitcher(serviceWorker);
    const page = current as Page;
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).locator('img + div')).toHaveText(['gamma', 'beta', 'alpha']);
    await expect(selected(page)).toContainText('beta');
  });

  test('opens the selected tab when Alt is released', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect(rows(page)).toHaveCount(0);
  });

  test('goes further when the shortcut is pressed again', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('alpha');
    await showSwitcher(serviceWorker, 'previous');
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });

  test('moves with the arrows and opens with Enter', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toContainText('alpha');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test('opens a tab with a click', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await rows(page).filter({ hasText: 'alpha' }).click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test('closes with Esc and stays on the same tab', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('gamma');
  });

  test('closes a tab from its close button and stays open', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const alpha = rows(page).filter({ hasText: 'alpha' });
    await alpha.hover();
    await alpha.getByRole('button', { name: 'Close tab' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect
      .poll(() => serviceWorker.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.title)))
      .not.toContain('alpha');
  });
});

test.describe('switcher theme @switcher', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows in the ${theme} theme when it is chosen in the settings`, async ({ context, serviceWorker }) => {
      await useSettings(serviceWorker, { theme });
      const [, current] = await openPages(context, ['alpha', 'beta']);
      const page = current as Page;
      await showSwitcher(serviceWorker);
      const list = switcher(page).getByRole('listbox', { name: 'Open tabs, most recent first' });
      await expect(list).toHaveCSS('color-scheme', theme);
    });
  }
});

test.describe('switcher motion @switcher', () => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`scrolls the selected tab's address ${reducedMotion === 'reduce' ? 'never when the system asks for less motion' : 'when it is set to scroll'}`, async ({
      context,
      serviceWorker,
    }) => {
      await useSettings(serviceWorker, { details: { address: true, longAddress: 'scroll' } as never });
      const [, current] = await openPages(context, ['alpha', 'beta']);
      const page = current as Page;
      await page.emulateMedia({ reducedMotion });
      await showSwitcher(serviceWorker);
      await expect(selected(page)).toContainText('alpha');
      const scrolling = () =>
        selected(page).evaluate(
          (row) => row.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
        );
      if (reducedMotion === 'reduce') expect(await scrolling()).toBe(0);
      else await expect.poll(scrolling).toBeGreaterThan(0);
    });
  }
});

test.describe("Chrome's own pages @switcher", () => {
  test("does nothing on a page Chrome keeps extensions out of, with Use a window on Chrome's pages off", async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    await useSettings(serviceWorker, { chromePagesWindow: false });
    const chromePage = await context.newPage();
    await chromePage.goto('chrome://version');
    await chromePage.bringToFront();
    // The page stays the current tab, whatever the browser calls it.
    const title = await activeTitle(serviceWorker);
    await showSwitcher(serviceWorker);
    expect(await activeTitle(serviceWorker)).toBe(title);
    expect(context.pages().map((page) => page.url())).not.toContainEqual(
      expect.stringContaining('chrome-extension://'),
    );
  });

  test("opens in a window of its own there, with Use a window on Chrome's pages (the default)", async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    const chromePage = await context.newPage();
    await chromePage.goto('chrome://version');
    await chromePage.bringToFront();
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    // In the middle of the Chrome window it was asked from, as large as the switcher.
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => {
          const windows = await chrome.windows.getAll();
          const middle = (type: string) => {
            const w = windows.find((window) => window.type === type);
            return [(w?.left ?? 0) + (w?.width ?? 0) / 2, (w?.top ?? 0) + (w?.height ?? 0) / 2];
          };
          const [fromX, fromY] = middle('normal') as [number, number];
          const [ownX, ownY] = middle('popup') as [number, number];
          return Math.abs(fromX - ownX) <= 1 && Math.abs(fromY - ownY) <= 1;
        }),
      )
      .toBe(true);
    await expect
      .poll(() =>
        switcherWindow.evaluate(() => {
          const panel = (document.querySelector('[style*="--panel-width"]') as HTMLElement).getBoundingClientRect();
          return Math.abs(panel.width - window.innerWidth) <= 1 && Math.abs(panel.height - window.innerHeight) <= 1;
        }),
      )
      .toBe(true);
    // Never a white window: the page has the panel's color, in the theme in use.
    expect(
      await switcherWindow.evaluate(() => {
        const page = getComputedStyle(document.documentElement).backgroundColor;
        const panel = getComputedStyle(document.querySelector('[style*="--panel-width"]') as HTMLElement);
        return page === panel.backgroundColor;
      }),
    ).toBe(true);
    await switcherWindow.getByRole('option', { name: /^alpha/ }).click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
  });

  test('switches to the previous tab with a quick tap there, as in a page: the window closes at once', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha', 'beta']);
    // A delay long enough that the release comes before it, whatever the machine.
    await useSettings(serviceWorker, { delayMs: 1000 });
    const chromePage = await context.newPage();
    await chromePage.goto('chrome://version');
    await chromePage.bringToFront();
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker);
    const switcherWindow = await opened;
    await switcherWindow.waitForFunction(() => document.querySelector('[role="listbox"]') !== null);
    await switcherWindow.keyboard.down('Alt');
    await switcherWindow.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect.poll(() => switcherWindow.isClosed()).toBe(true);
  });
});

test.describe('one switcher at a time @switcher', () => {
  test('closes when another tab comes to the front, and opens again where the user is', async ({
    context,
    serviceWorker,
  }) => {
    const [alpha, beta, gamma] = (await openPages(context, ['alpha', 'beta', 'gamma'])) as [Page, Page, Page];
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(gamma)).toHaveCount(3);
    await beta.bringToFront();
    await expect(rows(gamma)).toHaveCount(0);
    await showSwitcher(serviceWorker);
    await expect(rows(beta)).toHaveCount(3);
    await expect(rows(alpha)).toHaveCount(0);
  });

  test('opens again from the toolbar icon, never stays lost', async ({ context, serviceWorker }) => {
    const [, , gamma] = (await openPages(context, ['alpha', 'beta', 'gamma'])) as [Page, Page, Page];
    await showSwitcher(serviceWorker, 'next', 'icon');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(gamma)).toHaveCount(3);
    await expect(switcher(gamma)).toHaveCount(1);
  });
});

test.describe('switcher over the page @switcher', () => {
  test("stays above the site's dialogs, popovers and overlays", async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:white';
      document.body.append(overlay);
      const popover = document.createElement('div');
      popover.popover = 'manual';
      popover.style.cssText = 'inset:0;width:100vw;height:100vh';
      document.body.append(popover);
      popover.showPopover();
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'width:100vw;height:100vh;max-width:none;max-height:none';
      document.body.append(dialog);
      dialog.showModal();
    });
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(2);
    const onTop = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.localName);
    expect(onTop).toBe('better-tab-switcher');
  });
});

test.describe('what the page sees of the switcher @switcher', () => {
  test("keeps the tabs from the page: it can't reach the switcher, read its text, nor find a tab's title", async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'mybank', 'gamma']);
    const page = current as Page;
    // window.find searches what is drawn and can be selected: it finds the page's own text, before the switcher opens.
    const find = (text: string) =>
      page.evaluate((text) => (window as unknown as { find: (text: string) => boolean }).find(text), text);
    expect(await find('gamma')).toBe(true);
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).filter({ hasText: 'mybank' })).toBeVisible();
    const seen = await page.evaluate(() => {
      const holder = document.querySelector('better-tab-switcher');
      return {
        holder: holder !== null,
        shadowRoot: holder?.shadowRoot ?? null,
        frames: document.querySelectorAll('iframe').length,
        text: document.body.innerText,
      };
    });
    expect(seen).toEqual({ holder: true, shadowRoot: null, frames: 0, text: 'gamma' });
    expect(await find('mybank')).toBe(false);
  });

  test('opens in its own window on a page that keeps scripts out of its frames', async ({ context, serviceWorker }) => {
    await openPages(context, ['alpha', 'beta']);
    // The rule raw.githubusercontent.com sends: the page's frames run no script, the switcher's frame neither.
    await context.route('https://sandboxed.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: { 'content-security-policy': "default-src 'none'; sandbox" },
        body: '<title>sandboxed</title><h1>sandboxed</h1>',
      }),
    );
    const page = await context.newPage();
    await page.goto('https://sandboxed.test/file');
    await page.bringToFront();
    const opened = context.waitForEvent('page');
    await showSwitcher(serviceWorker, 'next', 'icon');
    const switcherWindow = await opened;
    await expect(switcherWindow.getByRole('option')).toHaveCount(3);
    // Nothing is left over the page: it takes the clicks and keys again.
    await expect(page.locator('better-tab-switcher')).toBeHidden();
  });
});

test.describe('pages that get in the way @switcher', () => {
  test('a page that takes the switcher out while it is open gets its keys back, and the shortcut opens a new one', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.evaluate(() => {
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Page field');
      document.body.append(field);
    });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    // A site that rebuilds its page without reloading it.
    await page.evaluate(() => document.querySelector('better-tab-switcher')?.remove());
    const field = page.getByRole('textbox', { name: 'Page field' });
    await field.click();
    await page.keyboard.type('typed');
    await expect(field).toHaveValue('typed');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
  });

  test("a page's CSS zoom leaves the switcher as large as on any page, whole", async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    const normal = await switcher(page).getByRole('listbox').boundingBox();
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(3);
    const zoomed = await switcher(page).getByRole('listbox').boundingBox();
    expect(zoomed).toEqual(normal);
  });

  test('a page that stops clicks and keys at its window still lets the switcher work', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.evaluate(() => {
      for (const type of ['pointerdown', 'mousedown', 'click', 'keydown', 'keyup', 'beforeinput', 'input'])
        window.addEventListener(type, (event) => event.stopImmediatePropagation(), true);
    });
    await showSwitcher(serviceWorker, 'next', 'icon');
    await switcher(page).getByRole('searchbox', { name: 'Search tabs' }).click();
    await page.keyboard.type('alp');
    await expect(rows(page)).toHaveCount(1);
    await rows(page).filter({ hasText: 'alpha' }).click();
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });
});

test.describe('tabs of other windows @switcher', () => {
  test('opens a tab of another window', async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { scope: 'all' });
    await openPages(context, ['alpha', 'beta']);
    // A new window, the last focused one, with a blank tab; then its page goes to the site (Playwright serves the
    // site's pages it knows).
    const opened = context.waitForEvent('page');
    await serviceWorker.evaluate(() => chrome.windows.create({}));
    const delta = await opened;
    await delta.goto('https://bts.test/delta');
    const firstWindow = await serviceWorker.evaluate(
      async () => (await chrome.tabs.query({ title: 'alpha' }))[0]?.windowId,
    );
    await showSwitcher(serviceWorker);
    await rows(delta).filter({ hasText: 'alpha' }).click();
    await expect
      .poll(() =>
        serviceWorker.evaluate(
          async (id) => (await chrome.tabs.query({ active: true, windowId: id }))[0]?.title,
          firstWindow,
        ),
      )
      .toBe('alpha');
    await expect(rows(delta)).toHaveCount(0);
  });
});
