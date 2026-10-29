import type { BrowserContext, Page } from '@playwright/test';
import { shortcutsPageUrl } from '../../lib/browser';
import { expect, test } from './fixtures';
import {
  activeTitle,
  defaultShortcuts,
  openPages,
  rows,
  selected,
  shortcutText,
  showSwitcher,
  switcher,
  testBrowser,
} from './helpers';

async function openSettings(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
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

  test('follows the theme chosen in it', async ({ context, extensionId }) => {
    const settings = await openSettings(context, extensionId);
    await settings.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Dark' });
    await expect(settings.locator('html')).toHaveCSS('color-scheme', 'dark');
    await settings.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Light' });
    await expect(settings.locator('html')).toHaveCSS('color-scheme', 'light');
  });

  test("opens the browser's shortcuts page to change a shortcut", async ({ context, extensionId, serviceWorker }) => {
    const settings = await openSettings(context, extensionId);
    const defaults = await defaultShortcuts(serviceWorker);
    await expect(settings.locator('kbd')).toHaveText([shortcutText(defaults.next), shortcutText(defaults.previous)]);
    const opened = context.waitForEvent('page', (tab) => tab.url() === shortcutsPageUrl(testBrowser));
    await settings.getByRole('button', { name: 'Change shortcut' }).first().click();
    await opened;
  });

  test('restores the default settings', async ({ context, extensionId }) => {
    const settings = await openSettings(context, extensionId);
    const compact = settings.getByRole('switch', { name: 'Compact' });
    await compact.click();
    await expect(compact).not.toBeChecked();
    await settings.getByRole('button', { name: 'Restore' }).click();
    await expect(compact).toBeChecked();
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
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    const address = switcher(page).getByRole('button', { name: 'Website address' });
    await expect(address).toHaveAttribute('aria-pressed', 'false');
    await expect(selected(page)).toHaveAccessibleName('alpha');
    await address.click();
    await expect(address).toHaveAttribute('aria-pressed', 'true');
    await expect(selected(page)).toHaveAccessibleName('alpha, bts.test');
    await expect(rows(page).getByText('bts.test')).toHaveCount(2);
    // The click left the keyboard on the tabs: Esc closes without opening one.
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('beta');
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(selected(page)).toHaveAccessibleName('alpha, bts.test');
    await expect(address).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('settings changed in two pages at once @settings', () => {
  test('keeps both changes, every time', async ({ context, extensionId, serviceWorker }) => {
    const first = await openSettings(context, extensionId);
    const second = await openSettings(context, extensionId);
    const saved = () =>
      serviceWorker.evaluate(async () => {
        const { settings } = (await chrome.storage.local.get('settings')) as {
          settings?: { toolbar?: boolean; compact?: boolean };
        };
        return [settings?.toolbar, settings?.compact];
      });
    for (const on of [false, true, false, true, false, true, false, true, false, true]) {
      // The same moment in both pages: each one changes its own setting.
      await Promise.all([
        first.getByRole('switch', { name: 'Show toolbar' }).click(),
        second.getByRole('switch', { name: 'Compact' }).click(),
      ]);
      await expect.poll(saved).toEqual([on, on]);
    }
  });
});
