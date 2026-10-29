import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeTitle, named, openPages, rowNames, rows, selected, showSwitcher, switcher } from './helpers';

const searchField = (page: Page) => switcher(page).getByRole('searchbox', { name: 'Search tabs' });

test.describe('search @search', () => {
  test('shows only the tabs that match, the match highlighted, and the arrows and Enter open one', async ({
    context,
    serviceWorker,
  }) => {
    const [, , , current] = await openPages(context, ['alpha', 'beta', 'gamma', 'delta']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await expect(rows(page)).toHaveCount(4);
    await searchField(page).click();
    await page.keyboard.type('TA');
    await expect.poll(() => rowNames(page)).toEqual([named('delta'), named('beta')]);
    await expect(rows(page).locator('mark')).toHaveText(['ta', 'ta']);
    // The search field is selected while typing: down goes to the first match, then to the next one.
    await expect(selected(page)).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('delta'));
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
    await expect(rows(page)).toHaveCount(0);
  });

  test('opens the first match with Enter straight from the search field', async ({ context, serviceWorker }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await searchField(page).click();
    await page.keyboard.type('alp');
    await expect.poll(() => rowNames(page)).toEqual([named('alpha')]);
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('alpha');
  });

  test("finds a tab by its website address when its title doesn't match", async ({ context, serviceWorker }) => {
    const [alpha, , current] = (await openPages(context, ['alpha', 'beta', 'gamma'])) as [Page, Page, Page];
    await alpha.evaluate(() => {
      document.title = 'Inbox';
    });
    await expect
      .poll(() => serviceWorker.evaluate(async () => (await chrome.tabs.query({ title: 'Inbox' })).length))
      .toBe(1);
    await showSwitcher(serviceWorker, 'next', 'icon');
    await searchField(current).click();
    await current.keyboard.type('bts.test/alpha');
    await expect.poll(() => rowNames(current)).toEqual(['Inbox, bts.test/alpha']);
    // Nothing of the title is highlighted: it matched only in the address.
    await expect(rows(current).locator('mark')).toHaveCount(0);
    await current.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('Inbox');
  });

  test('says when no tab matches, shows every tab again when the field is cleared, and Esc closes', async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await showSwitcher(serviceWorker, 'next', 'icon');
    await searchField(page).click();
    await page.keyboard.type('zzz');
    await expect(rows(page)).toHaveCount(0);
    await expect(switcher(page).getByText('No tabs match your search.')).toBeVisible();
    await searchField(page).fill('');
    await expect.poll(() => rowNames(page)).toEqual([named('gamma'), named('beta'), named('alpha')]);
    await expect(switcher(page).getByText('No tabs match your search.')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(switcher(page)).toHaveCount(0);
    expect(await activeTitle(serviceWorker)).toBe('gamma');
  });

  test("keeps the switcher open when the shortcut's key is released after a search starts", async ({
    context,
    serviceWorker,
  }) => {
    const [, , current] = await openPages(context, ['alpha', 'beta', 'gamma']);
    const page = current as Page;
    await page.keyboard.down('Alt');
    await showSwitcher(serviceWorker);
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await searchField(page).click();
    // The search field is selected; down selects a tab again, as when Alt is released without a search: here the
    // release must not open it.
    await expect(selected(page)).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await page.keyboard.press('ArrowDown');
    await expect(selected(page)).toHaveAccessibleName(named('alpha'));
    await page.keyboard.up('Alt');
    // Still open, still taking keys: the selection moves back and Enter opens what it is on.
    await page.keyboard.press('ArrowUp');
    await expect(selected(page)).toHaveAccessibleName(named('beta'));
    await page.keyboard.press('Enter');
    await expect.poll(() => activeTitle(serviceWorker)).toBe('beta');
  });
});
