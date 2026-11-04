/**
 * The search of the settings page: which settings match what the user typed, and where in their texts. Without case,
 * in the language in use (its own lower case: Turkish "I" is "ı").
 */

/** What the search looks for, ready to compare: in lower case, without the spaces around it; "" when nothing. */
export function searchTerm(query: string, language: string): string {
  return query.trim().toLocaleLowerCase(language);
}

/** Whether a text has the term in it. Never with no term: an empty search matches nothing (and shows everything). */
export function textMatches(text: string | undefined, term: string, language: string): boolean {
  return term !== '' && text !== undefined && text.toLocaleLowerCase(language).includes(term);
}

/** A piece of a text, marked when it is the term found. */
export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * The text in pieces, each place where the term is found marked, for showing it. The whole text unmarked when the
 * term isn't in it, or when lower case changes the text's length (a few letters do, in some languages): then the
 * places can't be found in the text as written, and the setting is shown without marks.
 */
export function matchParts(text: string, term: string, language: string): TextPart[] {
  const lower = text.toLocaleLowerCase(language);
  if (term === '' || lower.length !== text.length || !lower.includes(term)) return [{ text, match: false }];
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + term.length), match: true });
    from = at + term.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
