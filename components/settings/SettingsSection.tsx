import { createUniqueId, type JSX, Show } from 'solid-js';
import { textMatches } from '../../lib/settings/search';
import styles from './SettingsSection.module.css';
import { createSearchScope, Marked, useSearch } from './search';

interface SettingsSectionProps {
  /** The id the sidebar links to. */
  id: string;
  title: string;
  /** Whether it is the section chosen in the sidebar: without a search, the page shows only that one. */
  chosen?: boolean;
  /** Under the title, before the rows. */
  note?: JSX.Element;
  /** After the note, before the rows: something the user has to do (components/ui/Notice). */
  notice?: JSX.Element;
  children: JSX.Element;
}

/**
 * A section of the settings page: its title, then its rows in a card. Shown when chosen; during a search, when its
 * title or one of its settings matches (a title that matches shows all its settings).
 */
export function SettingsSection(props: SettingsSectionProps): JSX.Element {
  const titleId = createUniqueId();
  const search = useSearch();
  const scope = createSearchScope(() => textMatches(props.title, search.term(), search.language));
  const shown = () => (search.term() === '' ? props.chosen !== false : scope.matches());
  return (
    <scope.Provider>
      <section
        id={props.id}
        class={styles.section}
        classList={{ [styles.hidden as string]: !shown() }}
        aria-labelledby={titleId}
      >
        <div class={styles.head}>
          <h2 id={titleId} class={styles.title}>
            <Marked text={props.title} />
          </h2>
          <Show when={props.note}>
            <p class={styles.note}>{props.note}</p>
          </Show>
        </div>
        {props.notice}
        <div class={styles.card}>{props.children}</div>
      </section>
    </scope.Provider>
  );
}
