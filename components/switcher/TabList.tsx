import { createEffect, For, type JSX } from 'solid-js';
import { i18n } from '#i18n';
import type { TitleParts } from '../../lib/search/search';
import type { RowCount, TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import styles from './TabList.module.css';
import { TabRow, tabRowId } from './TabRow';

export interface ShownTab {
  tab: SwitcherTab;
  title: TitleParts;
}

interface TabListProps {
  tabs: ShownTab[];
  /** The selected tab's index; none while the search field is selected. */
  selected: number;
  /** The list has the keyboard focus (the search field doesn't). */
  focused: boolean;
  compact: boolean;
  rows: RowCount;
  details: TabDetails;
  now: number;
  language: string;
  autoSelectSeconds?: number;
  onChoose: (index: number) => void;
  onClose: (index: number) => void;
  onAutoSelect: () => void;
}

/**
 * The switcher's tabs as a list: as many rows as the setting says, then it scrolls. It keeps the keyboard focus and
 * points screen readers to the selected tab (aria-activedescendant).
 */
export function TabList(props: TabListProps): JSX.Element {
  let list: HTMLDivElement | undefined;
  const selectedTab = () => props.tabs[props.selected]?.tab;
  createEffect(() => {
    const tab = selectedTab();
    if (tab) list?.querySelector(`#${tabRowId(tab.id)}`)?.scrollIntoView({ block: 'nearest' });
  });
  createEffect(() => {
    if (props.focused) list?.focus({ preventScroll: true });
  });
  return (
    <div
      ref={list}
      role="listbox"
      tabIndex={-1}
      aria-label={i18n.t('Switcher_Tabs')}
      aria-activedescendant={selectedTab() ? tabRowId((selectedTab() as SwitcherTab).id) : undefined}
      class={styles.list}
      style={{ '--rows': props.rows === 'all' ? '1000' : String(props.rows) }}
      classList={{ [styles.compact as string]: props.compact }}
    >
      <For each={props.tabs}>
        {(shown, index) => (
          <TabRow
            tab={shown.tab}
            title={shown.title}
            selected={index() === props.selected}
            compact={props.compact}
            details={props.details}
            now={props.now}
            language={props.language}
            autoSelectSeconds={props.autoSelectSeconds}
            onChoose={() => props.onChoose(index())}
            onClose={() => props.onClose(index())}
            onAutoSelect={props.onAutoSelect}
          />
        )}
      </For>
    </div>
  );
}
