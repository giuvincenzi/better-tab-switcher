// What the site (scripts/site.mjs) and the stores' descriptions (scripts/store-listing.mjs) share: the site's address,
// the home page's languages and the texts each language takes from the extension.
import { parseMessagesFile } from '@wxt-dev/i18n/build';

/** Where GitHub Pages publishes the site: canonical links, link previews, sitemap.xml and the stores need its address. */
export const SITE_URL = 'https://bettertabswitcher.gviam.app/';

/**
 * A home language as written below.
 * @typedef {{ code: string, locale: string, folder: string, flag?: string, letter?: string, rtl?: boolean }} HomeLanguageDefinition
 */

/**
 * The home page's languages: the extension's languages, each with its file of texts in locales/, its folder on the site,
 * its flag in assets/flags (Arabic, spoken in many countries, shows a letter instead) and its writing direction.
 * @type {HomeLanguageDefinition[]}
 */
export const HOME_LANGUAGES = [
  { code: 'en', locale: 'en', folder: '', flag: 'gb' },
  { code: 'it', locale: 'it', folder: 'it', flag: 'it' },
  { code: 'fr', locale: 'fr', folder: 'fr', flag: 'fr' },
  { code: 'es', locale: 'es', folder: 'es', flag: 'es' },
  { code: 'de', locale: 'de', folder: 'de', flag: 'de' },
  { code: 'pt-BR', locale: 'pt_BR', folder: 'pt-br', flag: 'br' },
  { code: 'ro', locale: 'ro', folder: 'ro', flag: 'ro' },
  { code: 'ru', locale: 'ru', folder: 'ru', flag: 'ru' },
  { code: 'ar', locale: 'ar', folder: 'ar', letter: 'ع', rtl: true },
  { code: 'ja', locale: 'ja', folder: 'ja', flag: 'jp' },
  { code: 'ko', locale: 'ko', folder: 'ko', flag: 'kr' },
  { code: 'zh-Hans', locale: 'zh_CN', folder: 'zh-hans', flag: 'cn' },
];

/**
 * The texts the home shares with the extension, from its locales/<file>.yml (one place for both): its description and
 * the stores' names. A text a language leaves out (a global one) is the English one.
 * @param {string} locale
 */
export async function readExtensionTexts(locale) {
  const texts = new Map();
  for (const file of ['en', locale]) {
    for (const message of await parseMessagesFile(`locales/${file}.yml`)) {
      if ('message' in message) texts.set(message.key.join('_'), String(message.message));
    }
  }
  return {
    description: texts.get('Extension_Description'),
    chromeStore: texts.get('Browser_ChromeStore'),
    edgeStore: texts.get('Browser_EdgeStore'),
  };
}
