import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { applyLanguage } from '../../lib/i18n/direction';

/** Chrome in a language: its code and the direction Chrome's i18n gives for it ("@@bidi_dir"). */
function chromeIn(language: string, direction: string) {
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue(language);
  vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation((name: string) =>
    name === '@@bidi_dir' ? direction : '',
  );
}

function element() {
  return { lang: '', dir: '' } as HTMLElement;
}

describe('applyLanguage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the element the language in use, right to left in Arabic', () => {
    chromeIn('ar', 'rtl');
    const arabic = element();
    applyLanguage(arabic);
    expect(arabic).toMatchObject({ lang: 'ar', dir: 'rtl' });
  });

  it('runs left to right in the other languages', () => {
    chromeIn('it', 'ltr');
    const italian = element();
    applyLanguage(italian);
    expect(italian).toMatchObject({ lang: 'it', dir: 'ltr' });
  });

  it('runs left to right when Chrome gives no direction', () => {
    chromeIn('en', '');
    const english = element();
    applyLanguage(english);
    expect(english.dir).toBe('ltr');
  });
});
