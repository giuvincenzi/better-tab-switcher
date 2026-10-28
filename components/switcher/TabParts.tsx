import { createEffect, type JSX, on, Show } from 'solid-js';
import { i18n } from '#i18n';
import { timeAgo } from '../../lib/i18n/time';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { Icon } from '../ui/Icon';
import styles from './TabParts.module.css';

// The parts of a tab that the list's rows and the grid's tiles both show. Their colors come from the row or tile
// around them (--tab-muted, --tab-match, --tab-chip-border), which changes them on the selected tab.

/** A tab's accessible name: what its row or tile shows, joined with the language's list format. */
export function tabName(tab: SwitcherTab, details: TabDetails, language: string): string {
  return new Intl.ListFormat(language, { type: 'unit', style: 'short' }).format(
    [
      tab.title,
      details.address ? hostOf(tab.url) : '',
      details.pinnedIcon && tab.pinned ? i18n.t('Switcher_Pinned') : '',
      details.audioIcon && tab.audible ? i18n.t('Switcher_PlayingAudio') : '',
      details.sleeping && tab.sleeping ? i18n.t('Switcher_Sleeping') : '',
      tab.windowLabel ? i18n.t('Switcher_Window', [tab.windowLabel]) : '',
    ].filter(Boolean),
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** The tab group's color, then the title with the searched text highlighted. */
export function TabTitle(props: { tab: SwitcherTab; title: TitleParts; details: TabDetails }): JSX.Element {
  return (
    <span class={styles.titleLine}>
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
    </span>
  );
}

/**
 * The website's address: cut with "…", or scrolling back and forth on the selected tab. It takes the width its place
 * gives it, never its text's (it measures that width to scroll): `class` gives it its place. Its place follows the
 * page's direction; the address itself always reads left to right (.claude/rules/i18n.md), so a long one shows its start.
 */
export function Address(props: { url: string; scrolls: boolean; side?: boolean; class?: string }): JSX.Element {
  return (
    <span
      class={`${styles.address} ${props.class ?? ''}`}
      classList={{ [styles.side as string]: props.side, [styles.scrolls as string]: props.scrolls }}
    >
      <span class={styles.addressText} dir="ltr">
        <span>{hostOf(props.url)}</span>
      </span>
    </span>
  );
}

/** Pinned, playing audio, sleeping (each when its detail is on), then the tab's window when it is another one. */
export function TabIcons(props: { tab: SwitcherTab; details: TabDetails }): JSX.Element {
  return (
    <>
      <Show when={props.details.pinnedIcon && props.tab.pinned}>
        <span class={styles.icon}>
          <Icon name="pin" size={0.875} />
        </span>
      </Show>
      <Show when={props.details.audioIcon && props.tab.audible}>
        <span class={styles.icon}>
          <Icon name="audio" size={0.875} />
        </span>
      </Show>
      <Show when={props.details.sleeping && props.tab.sleeping}>
        <span class={styles.icon}>
          <Icon name="sleep" size={0.875} />
        </span>
      </Show>
      <Show when={props.tab.windowLabel}>
        {(label) => (
          <span class={styles.window}>
            <Icon name="window" size={0.75} />
            {label()}
          </span>
        )}
      </Show>
    </>
  );
}

/** When the tab was last used ("5 min ago"). */
export function LastUsed(props: { tab: SwitcherTab; now: number; language: string }): JSX.Element {
  return <span class={styles.age}>{timeAgo(props.tab.lastAccessed, props.now, props.language)}</span>;
}

/**
 * Auto-select: a line at the bottom of the selected tab, full when it is selected and shrinking to nothing. It starts
 * again, full, when `round` changes.
 */
export function AutoSelectLine(props: { seconds: number; round: number; onEnd: () => void }): JSX.Element {
  let line: HTMLSpanElement | undefined;
  createEffect(
    on(
      () => props.round,
      () => {
        for (const animation of line?.getAnimations() ?? []) animation.currentTime = 0;
      },
      { defer: true },
    ),
  );
  return (
    <span
      ref={line}
      class={styles.autoSelect}
      style={{ 'animation-duration': `${props.seconds}s` }}
      onAnimationEnd={() => props.onEnd()}
    />
  );
}

/** A click with the mouse's middle button closes a tab. */
export const MIDDLE_BUTTON = 1;

/** The middle button's press would start the browser's auto-scroll: on a tab, it only closes it. */
export function preventMiddleClickScroll(event: MouseEvent): void {
  if (event.button === MIDDLE_BUTTON) event.preventDefault();
}
