import { type Accessor, createContext, createMemo, createSignal, For, type JSX, onCleanup, useContext } from 'solid-js';
import { matchParts, textMatches } from '../../lib/settings/search';
import styles from './search.module.css';

/**
 * The search of the settings page, given to every row: what to look for ("" while the user isn't searching), and the
 * language its texts are in (lib/settings/search.ts).
 */
export interface Search {
  term: Accessor<string>;
  language: string;
}

const SearchContext = createContext<Search>({ term: () => '', language: 'en' });

export const SearchProvider = SearchContext.Provider;

export function useSearch(): Search {
  return useContext(SearchContext);
}

/**
 * A part of the page that holds settings (the page, a section, a group of linked settings): it matches when one of the
 * settings in it does, or its own text (a section's title). Each setting tells the part it is in.
 */
interface Scope {
  add: (matches: Accessor<boolean>) => void;
  /** Every setting in it shows: its own text matched, or the part around it. */
  showAll: Accessor<boolean>;
}

const ScopeContext = createContext<Scope>();

export interface SearchScope {
  matches: Accessor<boolean>;
  /** Whether it shows: always without a search; with one, when it matches or the part around it shows all. */
  shown: Accessor<boolean>;
  Provider: (props: { children: JSX.Element }) => JSX.Element;
}

/**
 * Makes a part of the page that holds settings. `own`: whether its own text matches. `together`: its settings show
 * all together when one of them matches (linked settings: the main one with the ones that depend on it).
 */
export function createSearchScope(own: Accessor<boolean> = () => false, together = false): SearchScope {
  const parent = useContext(ScopeContext);
  const search = useSearch();
  const [members, setMembers] = createSignal<Accessor<boolean>[]>([]);
  const matches = createMemo(() => own() || members().some((member) => member()));
  parent?.add(matches);
  const scope: Scope = {
    add: (member) => {
      setMembers((all) => [...all, member]);
      // Called while the setting is made: it leaves the part when it goes away (a choice of the other view).
      onCleanup(() => setMembers((all) => all.filter((other) => other !== member)));
    },
    showAll: () => (parent?.showAll() ?? false) || own() || (together && matches()),
  };
  const shown = () => search.term() === '' || (parent?.showAll() ?? false) || matches();
  return {
    matches,
    shown,
    Provider: (props) => <ScopeContext.Provider value={scope}>{props.children}</ScopeContext.Provider>,
  };
}

/**
 * A setting, for the search: whether one of its texts matches, and whether it shows (always without a search; with
 * one, when it matches or the part around it shows all).
 */
export function useSearchRow(texts: Accessor<(string | undefined)[]>): {
  shown: Accessor<boolean>;
  searching: Accessor<boolean>;
} {
  const search = useSearch();
  const scope = useContext(ScopeContext);
  const matches = createMemo(() => texts().some((text) => textMatches(text, search.term(), search.language)));
  scope?.add(matches);
  const searching = () => search.term() !== '';
  return { shown: () => !searching() || (scope?.showAll() ?? false) || matches(), searching };
}

/** A text with the places the search found in it marked. */
export function Marked(props: { text: string }): JSX.Element {
  const search = useSearch();
  return (
    <For each={matchParts(props.text, search.term(), search.language)}>
      {(part) => (part.match ? <mark class={styles.mark}>{part.text}</mark> : part.text)}
    </For>
  );
}
