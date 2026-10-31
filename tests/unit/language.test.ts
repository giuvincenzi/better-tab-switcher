import { describe, expect, it } from 'vitest';
import { directionOf } from '../../lib/i18n/language';

// The language in use and its direction on the real browser: tests/e2e/language.spec.ts.
describe('the language in use', () => {
  it('knows the direction of every language from the browser, with no list of its own', () => {
    for (const language of ['ar', 'he', 'fa', 'ur']) expect(directionOf(language), language).toBe('rtl');
    for (const language of ['en', 'it', 'pt-BR', 'zh-Hans', 'ja', 'ru'])
      expect(directionOf(language), language).toBe('ltr');
  });
});
