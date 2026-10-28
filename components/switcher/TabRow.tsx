import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import { faviconUrl } from '../../lib/favicon';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { IconButton } from '../ui/IconButton';
import {
  Address,
  AutoSelectLine,
  LastUsed,
  MIDDLE_BUTTON,
  preventMiddleClickScroll,
  TabIcons,
  TabTitle,
  tabName,
} from './TabParts';
import styles from './TabRow.module.css';

export interface TabRowProps {
  tab: SwitcherTab;
  title: TitleParts;
  selected: boolean;
  compact: boolean;
  details: TabDetails;
  /** Now, for "last used", in milliseconds since 1970. */
  now: number;
  language: string;
  /** Seconds before the selected tab opens by itself; none without Auto-select. */
  autoSelectSeconds?: number;
  /** Changes when the auto-select line starts again. */
  autoSelectRound: number;
  onChoose: () => void;
  onClose: () => void;
  onAutoSelect: () => void;
  /** The mouse moved onto the tab. */
  onHover: () => void;
}

/** One tab in the switcher's list. */
export function TabRow(props: TabRowProps): JSX.Element {
  const scrolls = () => props.details.longAddress === 'scroll' && props.selected;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys that open a tab (Enter, the arrows, Alt's release) belong to the list, which points to the selected row with aria-activedescendant (WAI-ARIA listbox pattern).
    <div
      id={tabOptionId(props.tab.id)}
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-label={tabName(props.tab, props.details, props.language)}
      class={styles.row}
      classList={{
        [styles.compact as string]: props.compact,
        [styles.selected as string]: props.selected,
        [styles.sleeping as string]: props.details.sleeping && props.tab.sleeping,
      }}
      onClick={() => props.onChoose()}
      onPointerEnter={() => props.onHover()}
      onMouseDown={preventMiddleClickScroll}
      onAuxClick={(event) => {
        if (event.button === MIDDLE_BUTTON) props.onClose();
      }}
    >
      <img class={styles.favicon} src={faviconUrl(props.tab.url, props.compact ? 1 : 1.25)} alt="" />
      <div class={styles.text}>
        <TabTitle tab={props.tab} title={props.title} details={props.details} />
        <Show when={props.details.address && !props.compact}>
          <Address url={props.tab.url} scrolls={scrolls()} />
        </Show>
      </div>
      <Show when={props.details.address && props.compact}>
        <Address url={props.tab.url} scrolls={scrolls()} side />
      </Show>
      <TabIcons tab={props.tab} details={props.details} />
      <Show when={props.details.lastUsed}>
        <LastUsed tab={props.tab} now={props.now} language={props.language} />
      </Show>
      <IconButton
        icon="close"
        label={i18n.t('Switcher_CloseTab')}
        class={styles.close}
        onClick={(event) => {
          event.stopPropagation();
          props.onClose();
        }}
      />
      <Show when={props.selected && props.autoSelectSeconds}>
        {(seconds) => <AutoSelectLine seconds={seconds()} round={props.autoSelectRound} onEnd={props.onAutoSelect} />}
      </Show>
    </div>
  );
}

/** The id of a tab's row or tile, for aria-activedescendant. */
export function tabOptionId(tabId: number): string {
  return `better-tab-switcher-tab-${tabId}`;
}
