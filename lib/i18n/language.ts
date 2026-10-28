import { i18n } from '#i18n';

/**
 * The language the extension's texts are shown in: the language file Chrome chose, which says its own language
 * (Language_Tag) — English when Chrome's language is not one of the extension's. Numbers, dates, the pages' lang and
 * their direction follow it, so they always match the texts (Chrome's own language may be another one).
 */
export function languageInUse(): string {
  return i18n.t('Language_Tag');
}

/** Whether a language is written left to right or right to left, as the browser knows it (Intl.Locale). */
export function directionOf(language: string): 'ltr' | 'rtl' {
  const locale = new Intl.Locale(language) as Intl.Locale & {
    getTextInfo?: () => { direction?: string };
    textInfo?: { direction?: string };
  };
  const info = locale.getTextInfo?.() ?? locale.textInfo;
  return info?.direction === 'rtl' ? 'rtl' : 'ltr';
}

/** Gives an element of the extension's UI the language its texts are in, and that language's direction. */
export function applyLanguage(element: HTMLElement): void {
  const language = languageInUse();
  element.lang = language;
  element.dir = directionOf(language);
}
