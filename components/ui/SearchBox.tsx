import { type JSX, Show } from 'solid-js';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import styles from './SearchBox.module.css';

interface SearchBoxProps {
  value: string;
  /** Its placeholder and accessible name. */
  label: string;
  /** The name of the button that empties it, shown while it has a text. */
  clearLabel: string;
  onInput: (value: string) => void;
}

/** A search field in a page's header, as Chrome's settings have it: a button empties it, and Esc. */
export function SearchBox(props: SearchBoxProps): JSX.Element {
  let input: HTMLInputElement | undefined;
  return (
    <label class={styles.box}>
      <Icon name="search" size={1.125} />
      <input
        ref={input}
        class={styles.input}
        type="search"
        placeholder={props.label}
        aria-label={props.label}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && props.value !== '') {
            event.preventDefault();
            props.onInput('');
          }
        }}
      />
      <Show when={props.value !== ''}>
        <IconButton
          icon="close"
          label={props.clearLabel}
          onClick={() => {
            props.onInput('');
            input?.focus();
          }}
        />
      </Show>
    </label>
  );
}
