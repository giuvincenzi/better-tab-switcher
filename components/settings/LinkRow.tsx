import { type JSX, Show } from 'solid-js';
import { Icon } from '../ui/Icon';
import styles from './SettingRow.module.css';
import { Marked, useSearchRow } from './search';

interface LinkRowProps {
  label: string;
  note?: string;
  href: string;
  /**
   * Opens it in place of the link: for a browser's own page (chrome://), which a page can't open as a link, only the
   * browser can (tabs.create). The row stays a link, with its address.
   */
  onOpen?: () => void;
}

/** A row of a settings section that opens a page in a new tab: the whole row is the link. */
export function LinkRow(props: LinkRowProps): JSX.Element {
  const row = useSearchRow(() => [props.label, props.note]);
  return (
    <a
      class={`${styles.row} ${styles.item} ${styles.link}`}
      classList={{ [styles.hidden as string]: !row.shown() }}
      href={props.href}
      target="_blank"
      rel="noopener"
      onClick={(event) => {
        if (!props.onOpen) return;
        event.preventDefault();
        props.onOpen();
      }}
    >
      <span class={styles.text}>
        <span class={styles.label}>
          <Marked text={props.label} />
        </span>
        <Show when={props.note}>
          {(text) => (
            <span class={styles.note}>
              <Marked text={text()} />
            </span>
          )}
        </Show>
      </span>
      <span class={styles.opens}>
        <Icon name="external" size={1.125} />
      </span>
    </a>
  );
}
