import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  activeTitle,
  closeBy,
  colorsAt,
  named,
  openPages,
  panelPoint,
  rowNames,
  rows,
  selected,
  showSwitcher,
  switcher,
  useSettings,
} from './helpers';

test.describe('switcher in a page @switcher', () => {
  test('lists the tabs most recently used first, the previous one selected', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    await showSwitcher(serviceWorker);
    const page = current as Page;
    await expect(rows(page)).toHaveCount(3);
    await expect.poll(() => rowNames(page)).toEqual([named('gamma'), named('beta'), named('alpha')]);
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

  test('goes further when the shortcut is pressed again, also twice before it shows', async ({
    context,
    serviceWorker,
  }) => {
    const [, beta, current] = (await openPages(context, ['alpha', 'beta', 'gamma'])) as [Page, Page, Page];
    const page = current;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('beta');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toContainText('alpha');
    await showSwitcher(serviceWorker, 'previous');
    await expect(selected(page)).toContainText('beta');
    await page.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    // Twice, the second press before the first switcher is there: one switcher, two tabs back (beta, gamma, alpha).
    await beta.keyboard.down('Alt');
    await Promise.all([showSwitcher(serviceWorker), showSwitcher(serviceWorker)]);
    await expect(selected(beta)).toContainText('alpha');
    await expect(switcher(beta).locator('[role="listbox"]')).toHaveCount(1);
    await beta.keyboard.up('Alt');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
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

/** The switcher panel's background in each theme (styles/theme.css, --bts-panel). */
const PANEL = { light: 'rgb(255, 255, 255)', dark: 'rgb(43, 44, 47)' };
/** The settings page's background in each theme (styles/theme.css, --bts-settings-page). */
const SETTINGS_PAGE = { light: 'rgb(248, 249, 250)', dark: 'rgb(32, 33, 36)' };
/** The test page's own background, which must stay in sight around the switcher. */
const PAGE = 'rgb(0, 0, 255)';

/**
 * A page of its own color, saying it supports dark or not (a color-scheme meta, as Google, GitHub and Microsoft's
 * pages do), shown as the current tab after alpha.
 */
async function coloredPage(context: BrowserContext, saysDark: boolean): Promise<Page> {
  await openPages(context, ['alpha']);
  await context.route('https://colors.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<title>colors</title>${saysDark ? '<meta name="color-scheme" content="light dark">' : ''}<body style="margin:0;background:${PAGE}"></body>`,
    }),
  );
  const page = await context.newPage();
  await page.goto('https://colors.test/');
  await page.bringToFront();
  return page;
}

for (const systemDark of [false, true]) {
  test.describe(`the system in ${systemDark ? 'dark' : 'light'} mode @switcher`, () => {
    test.use({ systemDark });

    test("is what Chrome's pages see: the tests' system theme works", async ({ context }) => {
      const [page] = await openPages(context, ['alpha']);
      expect(await page?.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(systemDark);
    });

    for (const saysDark of [false, true]) {
      test(`gives the switcher the device's theme, the page around it in sight, on a page that ${saysDark ? 'says it supports dark' : 'says nothing of its colors'}`, async ({
        context,
        serviceWorker,
      }) => {
        const page = await coloredPage(context, saysDark);
        await showSwitcher(serviceWorker);
        await expect(rows(page)).toHaveCount(2);
        await expect
          .poll(async () => colorsAt(page, serviceWorker, [await panelPoint(page), { x: 4, y: 4 }]))
          .toEqual([systemDark ? PANEL.dark : PANEL.light, PAGE]);
      });
    }

    test("gives the switcher's own window the device's theme, never white around the panel", async ({
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
      // The window's edges, away from its corners (macOS rounds them, the window isn't there), and the panel's
      // padding: the whole window is the panel.
      const size = await switcherWindow.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      await expect
        .poll(() =>
          colorsAt(switcherWindow, serviceWorker, [
            { x: size.width / 2, y: 2 },
            { x: 4, y: size.height / 2 },
            { x: size.width - 3, y: size.height / 2 },
          ]),
        )
        .toEqual(Array(3).fill(systemDark ? PANEL.dark : PANEL.light));
    });

    test("gives the settings page the device's theme", async ({ context, extensionId, serviceWorker }) => {
      const settings = await context.newPage();
      await settings.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(settings.getByRole('heading', { name: 'Better Tab Switcher settings' })).toBeVisible();
      await expect
        .poll(() => colorsAt(settings, serviceWorker, [{ x: 2, y: 2 }]))
        .toEqual([systemDark ? SETTINGS_PAGE.dark : SETTINGS_PAGE.light]);
    });

    // The theme chosen in the settings, over the system's other one.
    const chosen = systemDark ? 'light' : 'dark';
    test(`shows the switcher in the ${chosen} theme when it is chosen in the settings, the page around it in sight`, async ({
      context,
      serviceWorker,
    }) => {
      await useSettings(serviceWorker, { theme: chosen });
      const page = await coloredPage(context, true);
      await showSwitcher(serviceWorker);
      await expect(rows(page)).toHaveCount(2);
      await expect
        .poll(async () => colorsAt(page, serviceWorker, [await panelPoint(page), { x: 4, y: 4 }]))
        .toEqual([PANEL[chosen], PAGE]);
    });
  });
}

for (const reducedMotion of [false, true]) {
  test.describe(`switcher motion, the system ${reducedMotion ? 'asking' : 'not asking'} for less motion @switcher`, () => {
    test.use({ systemReducedMotion: reducedMotion });

    test("is what Chrome's pages see: the tests' system setting works", async ({ context }) => {
      const [page] = await openPages(context, ['alpha']);
      expect(await page?.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reducedMotion);
    });

    test(`${reducedMotion ? 'never scrolls a long address' : 'scrolls a long address to its end on the selected tab and on the one under the mouse, no other'}`, async ({
      context,
      serviceWorker,
    }) => {
      await useSettings(serviceWorker, { details: { address: true, longAddress: 'scroll' } as never });
      // Addresses far longer than their place in the switcher.
      const long = (name: string) => `${name}-${'x'.repeat(150)}`;
      const pages = await openPages(context, ['alpha', 'beta', 'gamma', 'delta'].map(long));
      const page = pages[3] as Page;
      await showSwitcher(serviceWorker);
      const row = (name: string) => rows(page).filter({ hasText: `${name}-` });
      await expect(selected(page)).toContainText('gamma-');
      // Where the address is: still at its start, or scrolling; then, put at the far end of its scroll, whether its
      // last letter is at the end of its place, as far as it goes and no further.
      const address = (name: string) =>
        row(name).evaluate((option) => {
          const place = option.querySelector('[dir="ltr"]') as HTMLElement;
          const text = place.firstElementChild as HTMLElement;
          if (text.offsetWidth <= place.clientWidth) return 'not long';
          const scroll = text.getAnimations()[0];
          if (!scroll) return 'still';
          const timing = scroll.effect?.getComputedTiming();
          scroll.pause();
          scroll.currentTime = Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0);
          const gap = place.getBoundingClientRect().right - text.getBoundingClientRect().right;
          scroll.play();
          return Math.abs(gap) <= 1 ? 'scrolls to its end' : `stops ${gap} px from its end`;
        });
      await row('beta').hover();
      const moving = reducedMotion ? 'still' : 'scrolls to its end';
      await expect.poll(() => address('gamma')).toBe(moving);
      await expect.poll(() => address('beta')).toBe(moving);
      expect(await address('alpha')).toBe('still');
      // The mouse goes on: the address it left goes back to its start.
      await row('alpha').hover();
      await expect.poll(() => address('alpha')).toBe(moving);
      await expect.poll(() => address('beta')).toBe('still');
    });
  });
}

test.describe("Chrome's own pages @switcher", () => {
  test("does nothing on a page Chrome keeps extensions out of, with Open the switcher in a window on Chrome's pages off", async ({
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

  test("opens in a window of its own there, with Open the switcher in a window on Chrome's pages (the default)", async ({
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
    // A click on a tab closes the window: the mouse's click, which waits for nothing in the window after it.
    const alpha = await switcherWindow.getByRole('option', { name: /^alpha/ }).boundingBox();
    if (!alpha) throw new Error('No alpha in the switcher.');
    await closeBy(switcherWindow, () =>
      switcherWindow.mouse.click(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2),
    );
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
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
    // The release closes the window at once: it may close before the release is acknowledged.
    await closeBy(switcherWindow, () => switcherWindow.keyboard.up('Alt'));
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
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

test.describe('pages that isolate themselves @switcher', () => {
  test('shows in a page that takes only frames allowed to it (Cross-Origin-Embedder-Policy: require-corp)', async ({
    context,
    serviceWorker,
  }) => {
    await openPages(context, ['alpha']);
    await context.route('https://isolated.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' },
        body: '<title>isolated</title><h1>isolated</h1>',
      }),
    );
    const page = await context.newPage();
    await page.goto('https://isolated.test/');
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    await page.bringToFront();
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(2);
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
        text: document.body.textContent,
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
