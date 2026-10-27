import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from './SettingsSection.module.css';

interface SettingsSectionProps {
  /** The id the sidebar links to. */
  id: string;
  title: string;
  /** Under the title, before the rows. */
  note?: JSX.Element;
  children: JSX.Element;
}

/** A section of the settings page: its title, then its rows in a card. */
export function SettingsSection(props: SettingsSectionProps): JSX.Element {
  const titleId = createUniqueId();
  return (
    <section id={props.id} class={styles.section} aria-labelledby={titleId}>
      <div class={styles.head}>
        <h2 id={titleId} class={styles.title}>
          {props.title}
        </h2>
        <Show when={props.note}>
          <p class={styles.note}>{props.note}</p>
        </Show>
      </div>
      <div class={styles.card}>{props.children}</div>
    </section>
  );
}
