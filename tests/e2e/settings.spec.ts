import type { BrowserContext, Page } from '@playwright/test';
import { shortcutsPageUrl } from '../../lib/browser';
import { expect, test } from './fixtures';
import { defaultShortcuts, openPages, rows, shortcutText, showSwitcher, testBrowser } from './helpers';

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
});
