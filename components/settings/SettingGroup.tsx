import type { JSX } from 'solid-js';
import { GroupProvider } from './SettingRow';
import styles from './SettingRow.module.css';
import { createSearchScope } from './search';

interface SettingGroupProps {
  /** Whether its main setting, the first row, is on. */
  on: boolean;
  /** The main setting's row, then the rows of the settings that depend on it (SettingRow's child). */
  children: JSX.Element;
}

/**
 * Linked settings in one block: the main one, and under it, indented, the ones that apply only while it is on, shown
 * only then. A search that finds one of them shows the whole group (those under a main setting that is off faded).
 */
export function SettingGroup(props: SettingGroupProps): JSX.Element {
  const scope = createSearchScope(() => false, true);
  return (
    <scope.Provider>
      <GroupProvider value={{ on: () => props.on }}>
        <div class={styles.item} classList={{ [styles.hidden as string]: !scope.shown() }}>
          {props.children}
        </div>
      </GroupProvider>
    </scope.Provider>
  );
}
