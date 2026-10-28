import { expect, test } from './fixtures';

// Chrome in a language the extension has no texts for: its texts are in English, and so is everything that follows the
// language (the pages' lang and direction, numbers and dates), even when Chrome's language is written right to left.
for (const chromeLanguage of ['it', 'he']) {
  test.describe(`Chrome in ${chromeLanguage}, a language the extension has no texts for @language`, () => {
    test.use({ chromeLanguage });
    // Chrome on macOS takes its language only from the system's settings, which a test must never change (on a
    // developer's Mac they are their own browsers'): Linux and Windows run it, and tests/unit/language.test.ts everywhere.
    test.skip(process.platform === 'darwin', "Chrome's language can't be chosen on macOS without changing the system");

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
