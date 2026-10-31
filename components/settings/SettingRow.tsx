import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from './SettingRow.module.css';

/** The ids that name and describe a row's control. */
export interface RowIds {
  label: string;
  /** None when the row has no note. */
  note?: string;
}

interface SettingRowProps {
  label: string;
  note?: string;
  /** The setting doesn't apply now (it depends on another one that is off): shown faded, its control disabled. */
  dim?: boolean;
  control: (ids: RowIds) => JSX.Element;
}

/** A row of a settings section: what the setting is, a note under it, and its control. */
export function SettingRow(props: SettingRowProps): JSX.Element {
  const label = createUniqueId();
  const note = createUniqueId();
  return (
    <div class={styles.row} classList={{ [styles.dim as string]: props.dim }}>
      <div class={styles.text}>
        <div id={label} class={styles.label}>
          {props.label}
        </div>
        <Show when={props.note}>
          <div id={note} class={styles.note}>
            {props.note}
          </div>
        </Show>
      </div>
      {props.control({ label, note: props.note ? note : undefined })}
    </div>
  );
}
