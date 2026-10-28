import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { applyLanguage, directionOf, languageInUse } from '../../lib/i18n/language';

/**
 * Chrome in a language (`chrome`), showing the extension's texts of a language file (`texts`): the one Chrome chose,
 * English when the extension has none for Chrome's language.
 */
function chromeIn(chrome: string, texts: string) {
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue(chrome);
  vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation((name: string) => {
    if (name === 'Language_Tag') return texts;
    if (name === '@@bidi_dir') return directionOf(chrome);
    return '';
  });
}

function element() {
  return { lang: '', dir: '' } as HTMLElement;
}

describe('the language in use', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the language of the texts shown, not Chrome's when the extension has no texts for it", () => {
    chromeIn('he', 'en');
    expect(languageInUse()).toBe('en');
    const page = element();
    applyLanguage(page);
    expect(page).toMatchObject({ lang: 'en', dir: 'ltr' });
  });

  it('runs right to left when the texts are in a language written so', () => {
    chromeIn('ar', 'ar');
    const page = element();
    applyLanguage(page);
    expect(page).toMatchObject({ lang: 'ar', dir: 'rtl' });
  });

  it('knows the direction of every language from the browser, with no list of its own', () => {
    for (const language of ['ar', 'he', 'fa', 'ur']) expect(directionOf(language), language).toBe('rtl');
    for (const language of ['en', 'it', 'pt-BR', 'zh-Hans', 'ja', 'ru'])
      expect(directionOf(language), language).toBe('ltr');
  });
});
