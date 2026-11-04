import { describe, expect, it } from 'vitest';
import { matchParts, searchTerm, textMatches } from '../../lib/settings/search';

// The search on the settings page, which settings it shows and marks: tests/unit/settings-page-search.test.tsx.
describe('the search of the settings', () => {
  it('looks for what was typed without case and without the spaces around it', () => {
    expect(searchTerm('  Auto-Select ', 'en')).toBe('auto-select');
    expect(textMatches('Auto-select time', searchTerm('SELECT', 'en'), 'en')).toBe(true);
    expect(textMatches('Auto-select time', searchTerm('grid', 'en'), 'en')).toBe(false);
  });

  it('matches nothing with nothing typed, nor a setting without the text', () => {
    expect(searchTerm('   ', 'en')).toBe('');
    expect(textMatches('Theme', '', 'en')).toBe(false);
    expect(textMatches(undefined, 'theme', 'en')).toBe(false);
  });

  it("uses the language's own lower case", () => {
    // In Turkish, "I" is the capital of "ı", not of "i".
    expect(searchTerm('I', 'tr')).toBe('ı');
    expect(textMatches('KAPALI', searchTerm('kapalı', 'tr'), 'tr')).toBe(true);
  });

  it('marks every place the term is found, keeping the text as written', () => {
    expect(matchParts('Show tabs from all windows', 'w', 'en')).toEqual([
      { text: 'Sho', match: false },
      { text: 'w', match: true },
      { text: ' tabs from all ', match: false },
      { text: 'w', match: true },
      { text: 'indo', match: false },
      { text: 'w', match: true },
      { text: 's', match: false },
    ]);
    expect(matchParts('Theme', 'theme', 'en')).toEqual([{ text: 'Theme', match: true }]);
  });

  it('marks nothing without the term, or where lower case changes the length of the text', () => {
    expect(matchParts('Theme', 'grid', 'en')).toEqual([{ text: 'Theme', match: false }]);
    expect(matchParts('Theme', '', 'en')).toEqual([{ text: 'Theme', match: false }]);
    // "İ" is two characters in lower case outside Turkish: the places can't be found in the text as written.
    expect(matchParts('İstanbul', 'stan', 'en')).toEqual([{ text: 'İstanbul', match: false }]);
  });
});
