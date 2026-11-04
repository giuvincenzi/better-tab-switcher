import { createEffect, createSignal, type JSX, on, onCleanup, Show } from 'solid-js';
import { i18n } from '#i18n';
import { copyText } from '../../lib/clipboard';
import { timeAgo } from '../../lib/i18n/time';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import styles from './TabParts.module.css';

// The parts of a tab that the list's rows and the grid's tiles both show. Their colors come from the row or tile
// around them (--tab-muted, --tab-match, --tab-chip-border), which changes them on the selected tab.

/** A tab's accessible name: what its row or tile shows, joined with the language's list format. */
export function tabName(tab: SwitcherTab, details: TabDetails, language: string): string {
  return new Intl.ListFormat(language, { type: 'unit', style: 'short' }).format(
    [
      tab.title,
      details.address ? addressOf(tab.url, details.fullAddress) : '',
      details.pinnedIcon && tab.pinned ? i18n.t('Switcher_Pinned') : '',
      details.audioIcon && tab.audible ? i18n.t('Switcher_PlayingAudio') : '',
      details.sleeping && tab.sleeping ? i18n.t('Switcher_Sleeping') : '',
      details.notOpened && tab.notOpened ? i18n.t('Switcher_NotOpened') : '',
      tab.windowLabel ? i18n.t('Switcher_Window', [tab.windowLabel]) : '',
    ].filter(Boolean),
  );
}

/**
 * The address the switcher shows: the whole page's address without its http(s)://, or only its host (the site, or
 * the browser page's name, like settings). An address with no host (a file, about:blank) stays whole.
 */
export function addressOf(url: string, full: boolean): string {
  try {
    const address = new URL(url);
    if (!address.host) return url;
    if (!full) return address.host;
    return /^https?:$/.test(address.protocol) ? url.slice(address.protocol.length + 2) : url;
  } catch {
    return url;
  }
}

/**
 * The tab group's color, then the title with the searched text highlighted. With Copy address and no website address
 * shown, the copy button sits at the end of the title's place instead (CopyAddressButton).
 */
export function TabTitle(props: {
  tab: SwitcherTab;
  title: TitleParts;
  details: TabDetails;
  copy?: CopyAddress;
  copyShown?: boolean;
}): JSX.Element {
  const copyHere = () => props.details.copyAddress && !props.details.address && props.copy;
  return (
    <span class={styles.titleLine} classList={{ [styles.copyShown as string]: !!copyHere() && props.copyShown }}>
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
      <Show when={copyHere()}>{(copy) => <CopyAddressButton copy={copy()} shown={!!props.copyShown} />}</Show>
    </span>
  );
}

/**
 * Whether a tab's long address scrolls, in its row or tile: with Scroll chosen, on the selected tab and on the one under
 * the mouse. `enter` and `leave` follow the mouse.
 */
export function createAddressScroll(props: { details: TabDetails; selected: boolean }) {
  const [hovered, setHovered] = createSignal(false);
  return {
    scrolls: () => props.details.longAddress === 'scroll' && (props.selected || hovered()),
    /** The mouse is on the tab: its Copy address button shows. */
    hovered,
    enter: () => setHovered(true),
    leave: () => setHovered(false),
  };
}

/**
 * The website's address: cut with "…", or scrolling back and forth (createAddressScroll). It takes the width its place
 * gives it, never its text's (it measures that width to scroll): `class` gives it its place. Its place follows the
 * page's direction; the address itself always reads left to right (.claude/rules/i18n.md), so a long one shows its start.
 */
export function Address(props: {
  url: string;
  full: boolean;
  scrolls: boolean;
  side?: boolean;
  class?: string;
  /** With Copy address: its button at the end of the address's place, and what it says for a moment once pressed. */
  copy?: CopyAddress;
  /** The copy button shows (the mouse on the tab): the address makes room for it, never wider than its place. */
  copyShown?: boolean;
}): JSX.Element {
  const message = () => props.copy?.message();
  return (
    <span
      class={`${styles.address} ${props.class ?? ''}`}
      classList={{
        [styles.side as string]: props.side,
        [styles.scrolls as string]: props.scrolls && !message(),
        [styles.copyShown as string]: !!props.copy && props.copyShown,
      }}
    >
      <Show
        when={message()}
        fallback={
          <span class={styles.addressText} dir="ltr">
            <span>{addressOf(props.url, props.full)}</span>
          </span>
        }
      >
        {(text) => <span class={styles.copyMessage}>{text()}</span>}
      </Show>
      <Show when={props.copy}>{(copy) => <CopyAddressButton copy={copy()} shown={!!props.copyShown} />}</Show>
    </span>
  );
}

/** How long "Address copied" (or that it couldn't be) shows in place of the address, in milliseconds. */
export const COPY_MESSAGE_MS = 1000;

/** A tab's Copy address: copies its whole address, then says so for a moment (COPY_MESSAGE_MS). */
export interface CopyAddress {
  copy: () => Promise<void>;
  /** What shows in place of the address for a moment once pressed; none the rest of the time. */
  message: () => string | undefined;
  copied: () => boolean;
}

export function createCopyAddress(url: () => string): CopyAddress {
  const [result, setResult] = createSignal<'copied' | 'failed' | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  return {
    async copy() {
      const copied = await copyText(url());
      // Never in silence (.claude/rules/architecture.md): not an error of the extension, the page or the browser refused.
      if (!copied) console.info("Better Tab Switcher couldn't copy the address: the browser refused both ways.");
      clearTimeout(timer);
      setResult(copied ? 'copied' : 'failed');
      timer = setTimeout(() => setResult(undefined), COPY_MESSAGE_MS);
    },
    message: () =>
      result() === 'copied'
        ? i18n.t('Switcher_AddressCopied')
        : result() === 'failed'
          ? i18n.t('Switcher_CopyFailed')
          : undefined,
    copied: () => result() === 'copied',
  };
}

/**
 * The Copy address button, over the end of the address's place (or the title's): it takes no room of its own, so no
 * row or tile gets narrower. Shown under the mouse, as Close tab. A click on it leaves the keyboard on the tabs.
 * What it did is said to screen readers (a live region), and shown in place of the address (Address).
 */
function CopyAddressButton(props: { copy: CopyAddress; shown: boolean }): JSX.Element {
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only keeps the focus where it is on a mouse press; the button inside is what the user presses. */}
      <span
        class={styles.copy}
        classList={{ [styles.copyVisible as string]: props.shown }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <IconButton
          icon={props.copy.copied() ? 'check' : 'copy'}
          label={i18n.t('Switcher_CopyAddress')}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            void props.copy.copy();
          }}
        />
      </span>
      <span class={styles.visuallyHidden} aria-live="polite">
        {props.copy.message() ?? ''}
      </span>
    </>
  );
}

/** "New": a tab opened in the background and not opened since (Tabs not opened yet), in place of when it was used. */
export function NewLabel(): JSX.Element {
  return <span class={styles.newLabel}>{i18n.t('Switcher_New')}</span>;
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
