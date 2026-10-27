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
  const query = typed.trim().toLocaleLowerCase();
  if (query === '') return { before: title, match: '', after: '' };
  const at = title.toLocaleLowerCase().indexOf(query);
  if (at >= 0) {
    return {
      before: title.slice(0, at),
      match: title.slice(at, at + query.length),
      after: title.slice(at + query.length),
    };
  }
  return url.toLocaleLowerCase().includes(query) ? { before: title, match: '', after: '' } : null;
}
