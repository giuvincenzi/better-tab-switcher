import { readdirSync, readFileSync } from 'node:fs';
import { parseMessagesFile } from '@wxt-dev/i18n/build';
import { describe, expect, it } from 'vitest';

// The extension's texts in every language (.claude/rules/i18n.md): locales/en.yml holds the English ones, each
// locales/<code>.yml a translation, named with the codes Chrome knows (_locales).

/** The languages the extension is translated into, by file, and the language each file says it is (Language_Tag). */
const LANGUAGES: Record<string, string> = {
  it: 'it',
  fr: 'fr',
  es: 'es',
  de: 'de',
  pt_BR: 'pt-BR',
  ro: 'ro',
  ru: 'ru',
  ar: 'ar',
  zh_CN: 'zh-Hans',
  ja: 'ja',
  ko: 'ko',
};

/** The texts that are only a global word: the same in every language, so only in English (i18n.md). */
const GLOBAL_KEYS = ['Extension_Name', 'Browser_Chrome', 'Browser_Edge'];

/**
 * The texts that are a name the browser gives in each language, which some languages keep as in English (Chrome Web
 * Store in Italian, French, Spanish, German, Portuguese) while others translate it: never taken for an English text.
 */
const NAME_KEYS = ['Browser_ChromeStore', 'Browser_EdgeStore'];

/** A file's texts by key; Chrome's own messages (@@…) left out. */
async function texts(file: string): Promise<Map<string, string>> {
  const messages = await parseMessagesFile(`locales/${file}.yml`);
  return new Map(
    messages
      .map((message) => [message.key.join('_'), 'message' in message ? String(message.message) : ''] as const)
      .filter(([key]) => !key.startsWith('@@')),
  );
}

/** The placeholders of a text ($1, $2…), sorted. */
const placeholders = (text: string) => [...text.matchAll(/\$\d+/g)].map((found) => found[0]).sort();

const english = await texts('en');

describe('translations', () => {
  it('are a file for each language, and nothing else', () => {
    const files = readdirSync('locales')
      .filter((name) => name.endsWith('.yml'))
      .map((name) => name.replace(/\.yml$/, ''));
    expect(files.sort()).toEqual(['en', ...Object.keys(LANGUAGES)].sort());
  });

  it('mark as GLOBAL in English exactly the global keys', () => {
    const source = readFileSync('locales/en.yml', 'utf8');
    const marked = [...source.matchAll(/^# GLOBAL:[^\n]*\n(?:#[^\n]*\n)*([A-Za-z_]+):/gm)].map((found) => found[1]);
    expect(marked).toEqual(GLOBAL_KEYS);
  });

  describe.each(Object.entries(LANGUAGES))('%s', (file, tag) => {
    it('has every English text but the global ones, in the same order, and none else', async () => {
      const translated = await texts(file);
      expect([...translated.keys()]).toEqual([...english.keys()].filter((key) => !GLOBAL_KEYS.includes(key)));
    });

    it('keeps the placeholders of each text', async () => {
      for (const [key, text] of await texts(file))
        expect(placeholders(text), key).toEqual(placeholders(english.get(key) ?? ''));
    });

    it('says which language it is, as the browser knows it', async () => {
      const said = (await texts(file)).get('Language_Tag');
      expect(said).toBe(tag);
      expect(Intl.getCanonicalLocales(said)).toEqual([tag]);
    });

    it('leaves no text empty, nor in English where the language has its own words', async () => {
      for (const [key, text] of await texts(file)) {
        expect(text.trim(), key).not.toBe('');
        if (key !== 'Language_Tag' && !NAME_KEYS.includes(key) && text.length > 12)
          expect(text, key).not.toBe(english.get(key));
      }
    });
  });
});
