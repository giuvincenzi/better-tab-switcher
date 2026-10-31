/** A title cut around the part that matches the search, to highlight it. */
export interface TitleParts {
  before: string;
  match: string;
  after: string;
}

/**
 * Whether a tab matches what was typed, in its title or its address, ignoring case and the spaces around it; with the
 * parts of the title to show (no `match` when it matched only in the address, or nothing was typed).
 * Null when it doesn't match.
 */
export function matchTab(typed: string, title: string, url: string): TitleParts | null {
  const query = fold(typed.trim()).folded;
  if (query === '') return { before: title, match: '', after: '' };
  const inTitle = fold(title);
  const at = inTitle.folded.indexOf(query);
  if (at >= 0) {
    const start = inTitle.starts[at] as number;
    const end = inTitle.ends[at + query.length - 1] as number;
    return { before: title.slice(0, start), match: title.slice(start, end), after: title.slice(end) };
  }
  return fold(url).folded.includes(query) ? { before: title, match: '', after: '' } : null;
}

/**
 * A text with case taken away, one letter at a time: each letter on its own, never changed by the letters around it
 * (a Greek Σ is always σ, never the ς that ends a word), and as its upper case's lower case, so the letters that have
 * several lower cases meet (ς and σ, ß and ss). A letter can become more than one (İ, ß): for each character of the
 * folded text, where its letter starts and ends in the text, to cut the text there.
 */
function fold(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  for (const letter of text) {
    const caseless = letter.toUpperCase().toLowerCase();
    folded += caseless;
    for (let i = 0; i < caseless.length; i++) {
      starts.push(at);
      ends.push(at + letter.length);
    }
    at += letter.length;
  }
  return { folded, starts, ends };
}
