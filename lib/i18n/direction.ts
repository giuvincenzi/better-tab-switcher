import { browser } from '#imports';

/** Gives an element of the extension's UI the language in use and its direction (Arabic: right to left). */
export function applyLanguage(element: HTMLElement): void {
  element.lang = browser.i18n.getUILanguage();
  element.dir = browser.i18n.getMessage('@@bidi_dir') === 'rtl' ? 'rtl' : 'ltr';
}
