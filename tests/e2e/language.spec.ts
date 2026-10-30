import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, extensionDir, test } from './fixtures';
import { openPages, showSwitcher, switcher } from './helpers';

// Chrome on macOS takes its language only from the system's settings, which a test must never change (on a developer's
// Mac they are their own browsers'): Linux and Windows run these, and tests/unit/language.test.ts everywhere.
const MAC_REASON = "Chrome's language can't be chosen on macOS without changing the system";

// Chrome in a language the extension has texts for: the settings page is in it, its lang and direction too.
for (const { chromeLanguage, title, dir } of [
  { chromeLanguage: 'it', title: 'Impostazioni di Better Tab Switcher', dir: 'ltr' },
  { chromeLanguage: 'ar', title: 'إعدادات Better Tab Switcher', dir: 'rtl' },
]) {
  test.describe(`Chrome in ${chromeLanguage}, a language the extension has texts for @language`, () => {
    test.use({ chromeLanguage });
    test.skip(process.platform === 'darwin', MAC_REASON);

    test(`shows the settings page in ${chromeLanguage}, ${dir === 'rtl' ? 'right to left' : 'left to right'}`, async ({
      context,
      extensionId,
    }) => {
      const settings = await context.newPage();
      await settings.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(settings.getByRole('heading', { level: 1 })).toHaveText(title);
      expect(
        await settings.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir })),
      ).toEqual({ lang: chromeLanguage, dir });
    });
  });
}

// Chrome in a language the extension has no texts for: its texts are in English, and so is everything that follows the
// language (the pages' lang and direction, numbers and dates), even when Chrome's language is written right to left.
for (const chromeLanguage of ['nl', 'he']) {
  test.describe(`Chrome in ${chromeLanguage}, a language the extension has no texts for @language`, () => {
    test.use({ chromeLanguage });
    test.skip(process.platform === 'darwin', MAC_REASON);

    test('shows the settings page in English, left to right, its dates in English', async ({
      context,
      serviceWorker,
      extensionId,
    }) => {
      expect(await serviceWorker.evaluate(() => chrome.i18n.getUILanguage())).toBe(chromeLanguage);
      const settings = await context.newPage();
      await settings.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(settings.getByText('For example, 15 min. ago.')).toBeVisible();
      expect(
        await settings.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir })),
      ).toEqual({ lang: 'en', dir: 'ltr' });
    });
  });
}

/** A text of the extension in a language, as the build wrote it (`_locales/<locale>/messages.json`). */
function text(locale: string, key: string): string {
  const messages = JSON.parse(readFileSync(join(extensionDir, '_locales', locale, 'messages.json'), 'utf8'));
  return messages[key].message;
}

/**
 * The texts that don't fit where they are, in `area`: an element showing text wider than its box, unless it cuts it with
 * "…" or scrolls it on purpose, or reaching past the area's sides. Tabs' titles and addresses are the tabs' own data;
 * screen readers' texts are hidden on purpose.
 */
function textsCut(area: Locator) {
  return area.evaluate((root) => {
    const box = root.getBoundingClientRect();
    const found: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      const own = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      if (!own || element.closest('[role="option"]') || element.getClientRects().length === 0) continue;
      // Text for screen readers only, hidden in a box of a pixel on purpose.
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      const style = getComputedStyle(element);
      const scrolls = style.overflowX === 'auto' || style.overflowX === 'scroll';
      const wider = element.scrollWidth > element.clientWidth + 1 && style.textOverflow !== 'ellipsis' && !scrolls;
      const out = rect.left < box.left - 1 || rect.right > box.right + 1;
      if (wider || out) found.push(`${element.localName}: ${element.textContent?.trim().slice(0, 60)}`);
    }
    return found;
  });
}

// Chrome in each of the extension's languages: the settings page and the switcher in it, in its direction, every
// text whole (German and Russian are long, Arabic runs right to left).
for (const [chromeLanguage, locale] of [
  ['en', 'en'],
  ['it', 'it'],
  ['fr', 'fr'],
  ['es', 'es'],
  ['de', 'de'],
  ['pt-BR', 'pt_BR'],
  ['ro', 'ro'],
  ['ru', 'ru'],
  ['ar', 'ar'],
  ['zh-CN', 'zh_CN'],
  ['ja', 'ja'],
  ['ko', 'ko'],
] as const) {
  test.describe(`the extension in ${chromeLanguage} @language`, () => {
    test.use({ chromeLanguage });
    test.skip(process.platform === 'darwin', MAC_REASON);
    const dir = chromeLanguage === 'ar' ? 'rtl' : 'ltr';

    test(`shows the settings page in it, ${dir}, every text whole`, async ({ context, extensionId }) => {
      const settings = await context.newPage();
      await settings.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(settings.getByRole('heading', { level: 1 })).toHaveText(text(locale, 'Settings_Title'));
      expect(
        await settings.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir })),
      ).toEqual({ lang: text(locale, 'Language_Tag'), dir });
      expect(await textsCut(settings.locator('body'))).toEqual([]);
    });

    test(`shows the switcher in it, ${dir}, every text whole, in the list and in the grid`, async ({
      context,
      serviceWorker,
    }) => {
      const [, current] = await openPages(context, ['alpha', 'beta']);
      const page = current as Page;
      for (const view of ['list', 'grid'] as const) {
        await serviceWorker.evaluate((v) => chrome.storage.local.set({ settings: { view: v } }), view);
        await showSwitcher(serviceWorker, 'next', 'icon');
        const panel = switcher(page).locator('[style*="--panel-width"]');
        await expect(switcher(page).getByRole('option')).toHaveCount(2);
        expect(await switcher(page).evaluate((dialog) => getComputedStyle(dialog).direction)).toBe(dir);
        expect(await textsCut(panel)).toEqual([]);
        await page.keyboard.press('Escape');
      }
    });
  });
}
