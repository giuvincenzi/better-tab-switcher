import { expect, test } from './fixtures';

// Chrome in a language the extension has no texts for: its texts are in English, and so is everything that follows the
// language (the pages' lang and direction, numbers and dates), even when Chrome's language is written right to left.
for (const chromeLanguage of ['it', 'he']) {
  test.describe(`Chrome in ${chromeLanguage}, a language the extension has no texts for @language`, () => {
    test.use({ chromeLanguage });

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
