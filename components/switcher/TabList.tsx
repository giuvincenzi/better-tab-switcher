import { createEffect, createMemo, For, type JSX, Match, Show, Switch } from 'solid-js';
import { i18n } from '#i18n';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { TabIcon } from './TabIcon';
import styles from './TabList.module.css';
import { TabRow, tabOptionId } from './TabRow';
import { TabTile } from './TabTile';

export interface ShownTab {
  tab: SwitcherTab;
  title: TitleParts;
}

/** How the tabs are shown: a list of rows, a grid of tiles with previews, or a grid of icons. */
export type Layout = 'list' | 'previews' | 'icons';

interface TabListProps {
  layout: Layout;
  tabs: ShownTab[];
  /** The selected tab's index; none while the search field is selected. */
  selected: number;
  /** The list has the keyboard focus (the search field doesn't). */
  focused: boolean;
  compact: boolean;
  /** The grid's columns. */
  columns: number;
  /** The list's rows shown before it scrolls; none: as many as fit the page (and always in the grids). */
  rows?: number;
  details: TabDetails;
  /** The tabs' pictures by tab id. */
  previews: Record<number, string>;
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
 * The switcher's tabs, as a list of rows, a grid of tiles or a grid of icons: never taller than the page leaves room
 * for, then it scrolls. It keeps the keyboard focus and points screen readers to the selected tab
 * (aria-activedescendant).
 */
export function TabList(props: TabListProps): JSX.Element {
  let list: HTMLDivElement | undefined;
  const selectedTab = () => props.tabs[props.selected]?.tab;
  // Only when the selection goes to another tab: a tab closed from the list changes the list, not the selection, and
  // the list stays where the user scrolled it.
  const selectedId = createMemo(() => selectedTab()?.id);
  createEffect(() => {
    const id = selectedId();
    if (id !== undefined) list?.querySelector(`#${tabOptionId(id)}`)?.scrollIntoView({ block: 'nearest' });
  });
  // Only when the list is to have the focus and didn't: a change in the switcher (a toolbar button pressed with Enter)
  // leaves the focus where the user is.
  const focused = createMemo(() => props.focused);
  createEffect(() => {
    if (focused()) list?.focus({ preventScroll: true });
  });
  return (
    <>
      <div
        ref={list}
        role="listbox"
        tabIndex={-1}
        aria-label={i18n.t('Switcher_Tabs')}
        aria-activedescendant={selectedTab() ? tabOptionId((selectedTab() as SwitcherTab).id) : undefined}
        class={styles[props.layout]}
        style={{
          '--columns': String(props.columns),
          'max-height': props.rows ? `calc(${props.rows} * (var(--row) + var(--gap)))` : undefined,
        }}
      >
        <For each={props.tabs}>
          {(shown, index) => {
            // A getter, so a row follows the details changed in the toolbar while it is shown.
            const common = {
              tab: shown.tab,
              get details() {
                return props.details;
              },
              language: props.language,
              onChoose: () => props.onChoose(index()),
              onClose: () => props.onClose(index()),
              onAutoSelect: props.onAutoSelect,
              onHover: () => props.onHover(index()),
            };
            const selected = () => index() === props.selected;
            const autoSelectSeconds = () => (selected() ? props.autoSelectSeconds : undefined);
            return (
              <Switch>
                <Match when={props.layout === 'list'}>
                  <TabRow
                    {...common}
                    title={shown.title}
                    now={props.now}
                    selected={selected()}
                    autoSelectSeconds={autoSelectSeconds()}
                    autoSelectRound={props.autoSelectRound}
                    compact={props.compact}
                  />
                </Match>
                <Match when={props.layout === 'previews'}>
                  <TabTile
                    {...common}
                    title={shown.title}
                    now={props.now}
                    selected={selected()}
                    autoSelectSeconds={autoSelectSeconds()}
                    autoSelectRound={props.autoSelectRound}
                    picture={props.previews[shown.tab.id]}
                  />
                </Match>
                <Match when={props.layout === 'icons'}>
                  <TabIcon
                    {...common}
                    selected={selected()}
                    autoSelectSeconds={autoSelectSeconds()}
                    autoSelectRound={props.autoSelectRound}
                  />
                </Match>
              </Switch>
            );
          }}
        </For>
      </div>
      <Show when={props.layout === 'icons' && selectedTab()}>
        {(tab) => (
          // Screen readers have it already: the selected tab's name, through aria-activedescendant.
          <div class={styles.selectedName} aria-hidden="true">
            {tab().title}
          </div>
        )}
      </Show>
    </>
  );
}
