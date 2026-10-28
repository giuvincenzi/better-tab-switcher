import { createEffect, type JSX } from 'solid-js';
import { i18n } from '#i18n';
import { Icon } from '../ui/Icon';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  /** The field is the selected item: it has the keyboard focus. */
  selected: boolean;
  compact: boolean;
  /** The field got the focus: a click on it starts the search. */
  onFocus: () => void;
  onInput: (value: string) => void;
}

/** The switcher's search field, above the tabs: a click on it starts the search. */
export function SearchField(props: SearchFieldProps): JSX.Element {
  let input: HTMLInputElement | undefined;
  createEffect(() => {
    if (props.selected) input?.focus();
  });
  return (
    <label
      class={styles.field}
      classList={{ [styles.compact as string]: props.compact, [styles.selected as string]: props.selected }}
    >
      <Icon name="search" size={16} />
      <input
        ref={input}
        class={styles.input}
        type="search"
        placeholder={i18n.t('Switcher_Search')}
        aria-label={i18n.t('Switcher_Search')}
        value={props.value}
        onFocus={() => props.onFocus()}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </label>
  );
}
