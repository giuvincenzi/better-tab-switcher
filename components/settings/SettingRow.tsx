import { createContext, createUniqueId, type JSX, Show, useContext } from 'solid-js';
import styles from './SettingRow.module.css';
import { Marked, useSearchRow } from './search';

/** What a row gives its control: the ids that name and describe it, and whether it can be used now. */
export interface RowIds {
  label: string;
  /** None when the row has no note. */
  note?: string;
  /** It depends on a setting that is off (SettingGroup): shown faded, its control disabled. */
  disabled: boolean;
}

interface SettingRowProps {
  label: string;
  note?: string;
  /** Other texts the search finds the setting by: its choices. */
  search?: string[];
  /** It depends on the main setting of its group (SettingGroup): indented under it. */
  child?: boolean;
  /** Before its texts. */
  icon?: JSX.Element;
  /** Under its note: something the setting says now (the result of a check). */
  status?: JSX.Element;
  control: (ids: RowIds) => JSX.Element;
}

/** A group of linked settings: whether its main setting is on. */
const GroupContext = createContext<{ on: () => boolean }>({ on: () => true });

export const GroupProvider = GroupContext.Provider;

/** A row of a settings section: what the setting is, a note under it, and its control. */
export function SettingRow(props: SettingRowProps): JSX.Element {
  const label = createUniqueId();
  const note = createUniqueId();
  const group = useContext(GroupContext);
  const row = useSearchRow(() => [props.label, props.note, ...(props.search ?? [])]);
  const disabled = () => props.child === true && !group.on();
  // A setting under one that is off shows only to a search that finds it, faded.
  const shown = () => row.shown() && (!disabled() || row.searching());
  return (
    <div
      class={styles.row}
      classList={{
        [styles.item as string]: !props.child,
        [styles.child as string]: props.child,
        [styles.dim as string]: disabled(),
        [styles.hidden as string]: !shown(),
      }}
    >
      {props.icon}
      <div class={styles.text}>
        <div id={label} class={styles.label}>
          <Marked text={props.label} />
        </div>
        <Show when={props.note}>
          {(text) => (
            <div id={note} class={styles.note}>
              <Marked text={text()} />
            </div>
          )}
        </Show>
        {props.status}
      </div>
      {props.control({
        label,
        note: props.note ? note : undefined,
        // Read by the control where it uses it: the control is made once, and follows it.
        get disabled() {
          return disabled();
        },
      })}
    </div>
  );
}
