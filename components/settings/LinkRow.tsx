import { type JSX, Show } from 'solid-js';
import { Icon } from '../ui/Icon';
import styles from './SettingRow.module.css';
import { Marked, useSearchRow } from './search';

interface LinkRowProps {
  label: string;
  note?: string;
  href: string;
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
