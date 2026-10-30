import type { BrowserContext, Page } from '@playwright/test';
import { shortcutsPageUrl } from '../../lib/browser';
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
    const opened = context.waitForEvent('page', (tab) => tab.url() === shortcutsPageUrl(testBrowser));
    await settings.getByRole('button', { name: 'Change shortcut' }).first().click();
    await opened;
  });

  test('restores the default settings', async ({ context, extensionId }) => {
    const settings = await openSettings(context, extensionId);
    const compact = settings.getByRole('switch', { name: 'Compact' });
    await compact.click();
    await expect(compact).toBeChecked();
    await settings.getByRole('button', { name: 'Restore' }).click();
    // Nothing yet: the user confirms it first.
    const confirmation = settings.getByRole('alertdialog', { name: 'Restore default settings?' });
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
  test('keeps both changes, every time', async ({ context, extensionId, serviceWorker }) => {
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
    }
  });
});
