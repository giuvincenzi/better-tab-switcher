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
  testBrowser,
} from './helpers';

async function openSettings(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  return page;
}

test.describe('settings page @settings', () => {
  test("opens from the switcher's toolbar", async ({ context, serviceWorker }) => {
    const [, current] = await openPages(context, ['alpha', 'beta']);
    const page = current as Page;
    await showSwitcher(serviceWorker);
    const opened = context.waitForEvent('page', (tab) => tab.url().endsWith('/options.html'));
    const switcher = page.locator('better-tab-switcher');
    await switcher.getByRole('button', { name: 'All settings' }).click();
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
    await expect(page.locator('better-tab-switcher [role="listbox"]')).toHaveCSS('display', 'grid');
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
    const switcher = page.locator('better-tab-switcher');
    await expect(switcher.getByRole('toolbar')).toHaveCount(0);
    await expect(switcher.getByRole('searchbox')).toHaveCount(0);
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
    const address = page.locator('better-tab-switcher').getByRole('button', { name: 'Website address' });
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
