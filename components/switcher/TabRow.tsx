import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import { faviconUrl } from '../../lib/favicon';
import { timeAgo } from '../../lib/i18n/time';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
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
  onChoose: () => void;
  onClose: () => void;
  onAutoSelect: () => void;
}

/** One tab in the switcher's list. */
export function TabRow(props: TabRowProps): JSX.Element {
  const address = () => hostOf(props.tab.url);
  const showSleeping = () => props.details.sleeping && props.tab.sleeping;
  const accessibleName = () =>
    new Intl.ListFormat(props.language, { type: 'unit', style: 'short' }).format(
      [
        props.tab.title,
        props.details.address ? address() : '',
        props.details.pinnedIcon && props.tab.pinned ? i18n.t('Switcher_Pinned') : '',
        props.details.audioIcon && props.tab.audible ? i18n.t('Switcher_PlayingAudio') : '',
        showSleeping() ? i18n.t('Switcher_Sleeping') : '',
        props.tab.windowLabel ? i18n.t('Switcher_Window', [props.tab.windowLabel]) : '',
      ].filter(Boolean),
    );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys that open a tab (Enter, the arrows, Alt's release) belong to the list, which points to the selected row with aria-activedescendant (WAI-ARIA listbox pattern).
    <div
      id={tabRowId(props.tab.id)}
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-label={accessibleName()}
      class={styles.row}
      classList={{
        [styles.compact as string]: props.compact,
        [styles.selected as string]: props.selected,
        [styles.sleeping as string]: showSleeping(),
      }}
      onClick={() => props.onChoose()}
    >
      <img class={styles.favicon} src={faviconUrl(props.tab.url, props.compact ? 16 : 20)} alt="" />
      <div class={styles.text}>
        <div class={styles.titleLine}>
          <Show when={props.details.groupColor && props.tab.groupColor}>
            {(color) => <span class={styles.group} style={{ background: `var(--bts-group-${color()})` }} />}
          </Show>
          <span class={styles.title}>
            {props.title.before}
            <Show when={props.title.match}>
              <mark class={styles.match}>{props.title.match}</mark>
            </Show>
            {props.title.after}
          </span>
        </div>
        <Show when={props.details.address && !props.compact}>
          <Address host={address()} scrolls={props.details.longAddress === 'scroll' && props.selected} />
        </Show>
      </div>
      <Show when={props.details.address && props.compact}>
        <Address host={address()} scrolls={props.details.longAddress === 'scroll' && props.selected} side />
      </Show>
      <Show when={props.details.pinnedIcon && props.tab.pinned}>
        <span class={styles.icon} title={i18n.t('Switcher_Pinned')}>
          <Icon name="pin" size={14} />
        </span>
      </Show>
      <Show when={props.details.audioIcon && props.tab.audible}>
        <span class={styles.icon} title={i18n.t('Switcher_PlayingAudio')}>
          <Icon name="audio" size={14} />
        </span>
      </Show>
      <Show when={showSleeping()}>
        <span class={styles.icon} title={i18n.t('Switcher_Sleeping')}>
          <Icon name="sleep" size={14} />
        </span>
      </Show>
      <Show when={props.tab.windowLabel}>
        {(label) => (
          <span class={styles.window} title={i18n.t('Switcher_Window', [label()])}>
            <Icon name="window" size={12} />
            {label()}
          </span>
        )}
      </Show>
      <Show when={props.details.lastUsed}>
        <span class={styles.age}>{timeAgo(props.tab.lastAccessed, props.now, props.language)}</span>
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
        {(seconds) => (
          <span
            class={styles.autoSelect}
            style={{ 'animation-duration': `${seconds()}s` }}
            onAnimationEnd={() => props.onAutoSelect()}
          />
        )}
      </Show>
    </div>
  );
}

/** The id of a tab's row, for the list's aria-activedescendant. */
export function tabRowId(tabId: number): string {
  return `better-tab-switcher-tab-${tabId}`;
}

function Address(props: { host: string; scrolls: boolean; side?: boolean }): JSX.Element {
  return (
    <span
      class={styles.address}
      classList={{ [styles.side as string]: props.side, [styles.scrolls as string]: props.scrolls }}
    >
      <span>{props.host}</span>
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
