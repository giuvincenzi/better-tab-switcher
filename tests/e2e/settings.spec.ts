import type { BrowserContext, Page, Worker } from '@playwright/test';
import { shortcutsPageUrl } from '../../lib/browser';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { expect, test } from './fixtures';
import {
  activeTitle,
  colorsAt,
  defaultShortcuts,
  openPages,
  rows,
  selected,
  shortcutText,
  showSwitcher,
  switcher,
  testBrowser,
  useSettings,
} from './helpers';

async function openSettings(context: BrowserContext, extensionId: string, query = ''): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html${query}`);
  return page;
}

/** The browser's name and its extension store's, as the settings page writes them in English (lib/browser.ts). */
const BROWSER = testBrowser === 'edge' ? 'Microsoft Edge' : 'Chrome';
const STORE = testBrowser === 'edge' ? 'Microsoft Edge Add-ons' : 'Chrome Web Store';

/** The settings as saved, as the extension's storage has them. */
const savedSettings = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings as Settings | undefined);

test.describe('settings page @settings', () => {
  test('gives screen readers the whole unit of its number fields', async ({ context, extensionId }) => {
    const page = await openSettings(context, extensionId);
    await expect(
      page.getByRole('spinbutton', { name: 'Delay before the switcher appears' }),
    ).toHaveAccessibleDescription(
      'milliseconds Press and release the shortcut quicker than this to switch to the previous tab without showing the switcher.',
    );
    await expect(page.getByRole('spinbutton', { name: 'Auto-select time' })).toHaveAccessibleDescription('seconds');
  });

  test('marks in its sidebar the section chosen there, and the one at the top as the page scrolls', async ({
    context,
    extensionId,
  }) => {
    const page = await openSettings(context, extensionId);
    const sidebar = page.getByRole('navigation', { name: 'Settings sections' });
    const marked = sidebar.locator('a[aria-current="true"]');
    await expect(marked).toHaveText('Appearance');
    /** Waits until the page stops moving: a section jumped to, or scrolled to. */
    const settled = () =>
      expect
        .poll(async () => {
          const before = await page.evaluate(() => window.scrollY);
          await page.waitForTimeout(100);
          return (await page.evaluate(() => window.scrollY)) === before;
        })
        .toBe(true);
    // The last sections are too short to reach the top of the window: the one chosen stays marked.
    for (const name of ['Keyboard shortcuts', 'Reset', 'Switching']) {
      await sidebar.getByRole('link', { name }).click();
      await settled();
      await expect(marked).toHaveText(name);
    }
    await page.mouse.move(800, 400);
    await page.mouse.wheel(0, -10000);
    await settled();
    await expect(marked).toHaveText('Appearance');
    await page.mouse.wheel(0, 10000);
    await settled();
    await expect(marked).toHaveText('Reset');
  });

  test("opens from the switcher's toolbar", async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const opened = context.waitForEvent('page', (tab) => tab.url().endsWith('/options.html'));
    const panel = switcher(page);
    await panel.getByRole('button', { name: 'All settings' }).click();
    const settings = await opened;
    await expect(settings.getByRole('heading', { name: 'Better Tab Switcher settings' })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test('changes the view of the switcher', async ({ context, serviceWorker, extensionId }) => {
    const settings = await openSettings(context, extensionId);
    await settings.getByText('Grid', { exact: true }).click();
    await expect(settings.getByRole('radio', { name: 'Grid' })).toBeChecked();
    await expect(settings.getByRole('radio', { name: 'Previews' })).toBeChecked();
    await expect(settings.getByText('Tabs shown before scrolling')).toHaveCount(0);
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    await expect(rows(page)).toHaveCount(2);
    await expect(switcher(page).locator('[role="listbox"]')).toHaveCSS('display', 'grid');
  });

  test('follows the theme chosen in it at once', async ({ context, extensionId, serviceWorker }) => {
    const settings = await openSettings(context, extensionId);
    const corner = () => colorsAt(settings, serviceWorker, [{ x: 2, y: 2 }]);
    await settings.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Dark' });
    await expect.poll(corner).toEqual(['rgb(32, 33, 36)']);
    await settings.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Light' });
    await expect.poll(corner).toEqual(['rgb(248, 249, 250)']);
  });

  test("opens the browser's shortcuts page to change a shortcut", async ({ context, extensionId, serviceWorker }) => {
    const settings = await openSettings(context, extensionId);
    const defaults = await defaultShortcuts(serviceWorker);
    // The toolbar icon's, third, has no keys unless the user gives it some.
    await expect(settings.locator('kbd')).toHaveText([
      shortcutText(defaults.next),
      shortcutText(defaults.previous),
      'Not set',
    ]);
    // The browser the extension runs in, by its name.
    await expect(settings.getByText(`${BROWSER} doesn't let extensions use Ctrl+Tab.`)).toBeVisible();
    const opened = context.waitForEvent('page', (tab) => tab.url() === shortcutsPageUrl(testBrowser));
    await settings.getByRole('button', { name: 'Change shortcut' }).first().click();
    await opened;
  });

  test('restores the default settings', async ({ context, extensionId }) => {
    const settings = await openSettings(context, extensionId);
    const compact = settings.getByRole('switch', { name: 'Compact' });
    await compact.click();
    await expect(compact).toBeChecked();
    const confirmation = settings.getByRole('alertdialog', { name: 'Restore default settings?' });
    // Cancelled: nothing changes.
    await settings.getByRole('button', { name: 'Restore' }).click();
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmation).toBeHidden();
    await expect(compact).toBeChecked();
    await settings.getByRole('button', { name: 'Restore' }).click();
    // Nothing yet: the user confirms it first.
    await expect(confirmation).toBeVisible();
    await expect(compact).toBeChecked();
    await confirmation.getByRole('button', { name: 'Restore' }).click();
    await expect(confirmation).toBeHidden();
    await expect(compact).not.toBeChecked();
  });

  test('opens on the shortcuts dialog the install asks for, with the shortcuts section, closed with Done', async ({
    context,
    extensionId,
  }) => {
    const settings = await openSettings(context, extensionId, '?shortcuts');
    const dialog = settings.getByRole('dialog', { name: 'Choose your keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Keyboard shortcuts', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Change shortcut' })).toHaveCount(3);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
  });

  test("takes the switcher's toolbar away from the next switcher with Show toolbar off", async ({
    context,
    serviceWorker,
    extensionId,
  }) => {
    const settings = await openSettings(context, extensionId);
    const toolbar = settings.getByRole('switch', { name: 'Show toolbar' });
    await expect(toolbar).toBeChecked();
    await toolbar.click();
    await expect(toolbar).not.toBeChecked();
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(2);
    const panel = switcher(page);
    await expect(panel.getByRole('toolbar')).toHaveCount(0);
    await expect(panel.getByRole('searchbox')).toHaveCount(0);
  });
});

test.describe('each control of the settings page @settings', () => {
  // The switcher answering each setting is checked with the setting saved (the tests of the tabs, the views, the
  // switching); the theme, the view and Show toolbar also from this page (above). Here: each control saves its own
  // setting, and only it.
  test('saves its own setting, and only it', async ({ context, extensionId, serviceWorker }) => {
    const page = await openSettings(context, extensionId);
    let expected: Settings = structuredClone(defaultSettings) as Settings;
    const saves = async (change: (settings: Settings) => void) => {
      change(expected);
      await expect.poll(() => savedSettings(serviceWorker)).toEqual(expected);
      expected = structuredClone(expected);
    };
    const toggle = (name: string) => page.getByRole('switch', { name, exact: true }).click();
    const choose = (name: string, label: string) => page.getByRole('combobox', { name }).selectOption({ label });
    const type = async (name: string, value: number) => {
      const field = page.getByRole('spinbutton', { name });
      await field.fill(String(value));
      await field.blur();
    };

    // Appearance: the list's own settings, then the grid's.
    await toggle('Compact');
    await saves((s) => {
      s.compact = true;
    });
    await choose('Tabs shown before scrolling', '6');
    await saves((s) => {
      s.listRows = 6;
    });
    await choose('Tabs shown before scrolling', 'Fit the screen');
    await saves((s) => {
      s.listRows = 'fit';
    });
    await page.getByText('Grid', { exact: true }).click();
    await saves((s) => {
      s.view = 'grid';
    });
    await page.getByText('Icons', { exact: true }).click();
    await saves((s) => {
      s.gridShow = 'icons';
    });

    // Switching.
    await choose('Show tabs from', 'All windows');
    await saves((s) => {
      s.scope = 'all';
    });
    await toggle('Show pinned tabs');
    await saves((s) => {
      s.showPinned = false;
    });
    await type('Delay before the switcher appears', 200);
    await saves((s) => {
      s.delayMs = 200;
    });
    await toggle('Stay open until you choose a tab');
    await saves((s) => {
      s.stayOpen = true;
    });
    // Named after the browser the extension runs in, its note after its extension store too.
    const pagesWindow = page.getByRole('switch', { name: `Open the switcher in a window on ${BROWSER}'s pages` });
    await expect(pagesWindow).toHaveAccessibleDescription(
      `${BROWSER} doesn't let extensions into its own pages, like Settings, or into its extension store, ${STORE}. ` +
        'There the switcher opens in a small window of its own.',
    );
    await pagesWindow.click();
    await saves((s) => {
      s.chromePagesWindow = false;
    });
    await toggle('Auto-select');
    await saves((s) => {
      s.autoSelect = true;
    });
    await type('Auto-select time', 5);
    await saves((s) => {
      s.autoSelectSeconds = 5;
    });

    // Tab details: the address last, as it turns off the two settings after it.
    for (const [name, key] of [
      ['Pinned tab icon', 'pinnedIcon'],
      ['Playing audio icon', 'audioIcon'],
      ['Inactive tabs', 'sleeping'],
      ['Tab group color', 'groupColor'],
      ['Last used', 'lastUsed'],
      ['Full address', 'fullAddress'],
    ] as const) {
      await toggle(name);
      await saves((s) => {
        s.details[key] = false;
      });
    }
    await choose('Long website addresses', 'Cut short');
    await saves((s) => {
      s.details.longAddress = 'cut';
    });
    await toggle('Website address');
    await saves((s) => {
      s.details.address = false;
    });
  });
});

test.describe("the switcher's toolbar @settings", () => {
  test('shows the website addresses from the toolbar, and keeps them for the next opening', async ({
    context,
    serviceWorker,
  }) => {
    // On by default: off here, for the toolbar to turn it on.
    await useSettings(serviceWorker, { details: { address: false } } as never);
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    const address = switcher(page).getByRole('button', { name: 'Website address' });
    await expect(address).toHaveAttribute('aria-pressed', 'false');
    await expect(selected(page)).toHaveAccessibleName('alpha');
    await address.click();
    await expect(address).toHaveAttribute('aria-pressed', 'true');
    await expect(selected(page)).toHaveAccessibleName('alpha, bts.test/alpha');
    await expect(rows(page).getByText('bts.test')).toHaveCount(2);
    // The click left the keyboard on the tabs: Esc closes without opening one.
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('beta');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(selected(page)).toHaveAccessibleName('alpha, bts.test/alpha');
    await expect(address).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('settings changed in two pages at once @settings', () => {
  test('keeps both changes every time, each page showing the other one, and a damaged one as its default', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    // Two windows, as a user would have them: each page the one shown in its window, each clicked there.
    const first = await openSettings(context, extensionId);
    const opened = context.waitForEvent('page', (page) => page.url().endsWith('/options.html'));
    await serviceWorker.evaluate(
      (url) => chrome.windows.create({ url }),
      `chrome-extension://${extensionId}/options.html`,
    );
    const second = await opened;
    await second.waitForLoadState();
    const saved = () =>
      serviceWorker.evaluate(async () => {
        const { settings } = (await chrome.storage.local.get('settings')) as {
          settings?: { toolbar?: boolean; compact?: boolean };
        };
        return [settings?.toolbar, settings?.compact];
      });
    // Show toolbar starts on and Compact off (the defaults): each click turns both the other way.
    for (const on of [false, true, false, true, false, true, false, true, false, true]) {
      // The same moment in both pages: each one changes its own setting.
      await Promise.all([
        first.getByRole('switch', { name: 'Show toolbar' }).click(),
        second.getByRole('switch', { name: 'Compact' }).click(),
      ]);
      await expect.poll(saved).toEqual([on, !on]);
      // Each page shows the change made in the other one, as it is saved, without being reloaded.
      await expect(first.getByRole('switch', { name: 'Compact' })).toBeChecked({ checked: !on });
      await expect(second.getByRole('switch', { name: 'Show toolbar' })).toBeChecked({ checked: on });
    }
    // Damaged values saved while both pages are open (another version's, a broken write): those settings show their
    // defaults, the others what was saved.
    await first.getByRole('switch', { name: 'Show toolbar' }).click();
    await expect.poll(saved).toEqual([false, false]);
    await serviceWorker.evaluate(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(settings as object), compact: 'yes', delayMs: 'soon' } });
    });
    for (const page of [first, second]) {
      await expect(page.getByRole('spinbutton', { name: 'Delay before the switcher appears' })).toHaveValue(
        String(defaultSettings.delayMs),
      );
      await expect(page.getByRole('switch', { name: 'Compact' })).toBeChecked({ checked: defaultSettings.compact });
      await expect(page.getByRole('switch', { name: 'Show toolbar' })).not.toBeChecked();
    }
  });
});

test.describe('installed while another extension uses its keys @settings', () => {
  test.use({ installedBefore: ['tests/e2e/keys-taken'] });

  test('opens its settings by itself on the shortcuts dialog, which says the keys are missing', async ({
    context,
    extensionId,
  }) => {
    let settings: Page | undefined;
    await expect
      .poll(() => {
        settings = context
          .pages()
          .find((page) => page.url() === `chrome-extension://${extensionId}/options.html?shortcuts`);
        return settings !== undefined;
      })
      .toBe(true);
    const dialog = (settings as Page).getByRole('dialog', { name: 'Choose your keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('A shortcut has no keys');
    await expect(dialog.locator('kbd')).toHaveText(['Not set', 'Not set', 'Not set']);
  });
});
