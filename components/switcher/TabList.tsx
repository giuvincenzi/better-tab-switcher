import { createEffect, For, type JSX } from 'solid-js';
import { i18n } from '#i18n';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails, View } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import styles from './TabList.module.css';
import { TabRow, tabOptionId } from './TabRow';
import { TabTile } from './TabTile';

export interface ShownTab {
  tab: SwitcherTab;
  title: TitleParts;
}

interface TabListProps {
  view: View;
  tabs: ShownTab[];
  /** The selected tab's index; none while the search field is selected. */
  selected: number;
  /** The list has the keyboard focus (the search field doesn't). */
  focused: boolean;
  compact: boolean;
  /** The grid's columns. */
  columns: number;
  /** The rows shown before it scrolls. */
  rows: number;
  details: TabDetails;
  /** The tabs' pictures by tab id; none with Previews off (the grid shows the sites' icons). */
  previews?: Record<number, string>;
  now: number;
  language: string;
  autoSelectSeconds?: number;
  /** Changes when the auto-select line starts again. */
  autoSelectRound: number;
  onChoose: (index: number) => void;
  onClose: (index: number) => void;
  onAutoSelect: () => void;
  /** The mouse moved onto a tab. */
  onHover: (index: number) => void;
}

/**
 * The switcher's tabs, as a list of rows or a grid of tiles: as many rows as the settings say, then it scrolls. It keeps
 * the keyboard focus and points screen readers to the selected tab (aria-activedescendant).
 */
export function TabList(props: TabListProps): JSX.Element {
  let list: HTMLDivElement | undefined;
  const selectedTab = () => props.tabs[props.selected]?.tab;
  createEffect(() => {
    const tab = selectedTab();
    if (tab) list?.querySelector(`#${tabOptionId(tab.id)}`)?.scrollIntoView({ block: 'nearest' });
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
      aria-activedescendant={selectedTab() ? tabOptionId((selectedTab() as SwitcherTab).id) : undefined}
      class={props.view === 'grid' ? styles.grid : styles.list}
      style={{ '--rows': String(props.rows), '--columns': String(props.columns) }}
    >
      <For each={props.tabs}>
        {(shown, index) => {
          const common = {
            tab: shown.tab,
            title: shown.title,
            details: props.details,
            now: props.now,
            language: props.language,
            onChoose: () => props.onChoose(index()),
            onClose: () => props.onClose(index()),
            onAutoSelect: props.onAutoSelect,
            onHover: () => props.onHover(index()),
          };
          const selected = () => index() === props.selected;
          const autoSelectSeconds = () => (selected() ? props.autoSelectSeconds : undefined);
          return props.view === 'grid' ? (
            <TabTile
              {...common}
              selected={selected()}
              autoSelectSeconds={autoSelectSeconds()}
              autoSelectRound={props.autoSelectRound}
              picture={props.previews?.[shown.tab.id]}
              iconOnly={props.previews === undefined}
            />
          ) : (
            <TabRow
              {...common}
              selected={selected()}
              autoSelectSeconds={autoSelectSeconds()}
              autoSelectRound={props.autoSelectRound}
              compact={props.compact}
            />
          );
        }}
      </For>
    </div>
  );
}
