import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Key } from './keys/keys';
import type { Rect } from './presenter/placement';
import type { Settings } from './settings/settings';
import type { SettingsChange } from './settings/store';
import type { SwitcherTab } from './tabs/tabs';

export type Direction = 'next' | 'previous';

/** Everything an opening switcher needs, sent by the background so that it shows at once. */
export interface SwitcherSnapshot {
  tabs: SwitcherTab[];
  settings: Settings;
  direction: Direction;
  /** Opened from the toolbar icon: no key is held, so it stays open until a tab is chosen. */
  fromIcon: boolean;
  /** The page's picture is being taken: the switcher stays hidden until pictureTaken, so it isn't in the picture. */
  waitForPicture: boolean;
  /**
   * In a page: the page had the focus as the switcher opened, so the switcher sees the keys let go, in its frame or
   * passed on by the page (keyInPage). Not set in its own window, which knows it itself.
   */
  canSeeRelease?: boolean;
  /**
   * Shown in a window of its own (on Chrome's pages): the Chrome window it is in the middle of, in the screen's pixels.
   * The switcher takes its sizes from that window, as it would from its page, and its own window fits it.
   */
  centeredOn?: Rect;
  /** Opened again as the user left it, after closing the tab it was in (Resume). */
  resume?: Resume;
}

/**
 * The switcher as the user left it when they closed, from it, the tab it was shown in: it opens again so in the tab the
 * browser shows instead, the list without that tab.
 */
export interface Resume {
  /** The tab selected after the closed one went; none when the search field was. */
  selectedTabId?: number;
  /** The text searched for. */
  query: string;
  /** Opened from the toolbar icon: it stays open until a tab is chosen. */
  fromIcon: boolean;
}

/** The switcher's frame is shown in the page (showFrame). */
export interface FrameShown {
  /** The page had the focus: the switcher sees the keys let go (SwitcherSnapshot.canSeeRelease). */
  canSeeRelease: boolean;
  /** The keys the page got while the frame was loading, for the switcher once it is there (pressKey). */
  keys: Key[];
  /** The frame was made for this showing: the switcher shows in it for the first time, which takes longer. */
  madeNow: boolean;
}

/** What a tab shows now: its title and its address, as the switcher shows them (lib/tabs/chrome-tabs.ts). */
export interface TabText {
  tabId: number;
  title: string;
  url: string;
}

/** A tab's new preview. */
export interface Preview {
  tabId: number;
  picture: string;
}

/**
 * The messages between the background and the switcher, in a page's frame or in its own window, and the frame's holder
 * in the page (entrypoints/switcher.content.ts).
 *
 * The background sends to one tab, never to every page of the extension: each page keeps its switcher's frame, hidden,
 * and every frame would get the message. In that tab the holder and the frame both get it, and each answers only its
 * own messages. The switcher, the holder and the extension's pages send to the background with runtime.sendMessage,
 * which every frame gets too: no frame listens to those messages.
 */
interface Messages {
  /** Switcher's window → background: the tabs to show, once (null when the window was not opened for a switcher). */
  getSnapshot(): SwitcherSnapshot | null;
  /**
   * Background → holder: show the switcher's frame over the page and give it the focus, making it the first time; it
   * answers once the frame is loaded.
   * None on a sandboxed page (its origin opaque, "null"): it keeps scripts out of its frames, the switcher's too.
   */
  showFrame(): FrameShown | null;
  /** Background → holder: hide the switcher's frame; it stays in the page, ready for the next time. */
  hideFrame(): void;
  /** Holder → background: a key the page got while the switcher's frame was shown without the focus. */
  keyInPage(key: Key): void;
  /** Background → switcher: a key the page got for it (keyInPage). */
  pressKey(key: Key): void;
  /** Background → switcher: show these tabs. */
  showSwitcher(snapshot: SwitcherSnapshot): void;
  /** Background → switcher: the shortcut was pressed again while it is open. */
  moveSwitcher(direction: Direction): void;
  /** Background → switcher: close, a new switcher opens in another tab. */
  closeSwitcher(): void;
  /** Switcher → background: open this tab (the switcher has already closed). */
  openTab(tabId: number): void;
  /**
   * Switcher → background: close this tab; the switcher stays open. When it is the tab the switcher is in, the switcher
   * opens again in the tab shown instead, as it was (resume).
   */
  closeTab(close: { tabId: number; resume: Resume }): void;
  /** Switcher → background: it closed without opening a tab (Esc, a click outside): the user is back where they were. */
  switcherClosed(): void;
  /** Switcher's window → background: another window took the focus: it closes, the focus stays where the user went. */
  switcherLeft(): void;
  /**
   * Switcher in a page, or its frame's holder → background: the switcher's frame, or the page, lost the focus while the
   * switcher is shown (its frame's blur, the page's blur). The background asks the browser whether its window still has
   * the focus.
   */
  focusLeft(): void;
  /** Switcher → background: open the settings page. */
  openSettings(): void;
  /** Settings page or switcher → background: save this change (lib/settings/service.ts); gives the settings saved. */
  saveSettings(change: SettingsChange): Settings;
  /** Settings page → background: back to the default settings. */
  restoreDefaultSettings(): void;
  /** Switcher → background: the previews there are of these tabs, by tab id. */
  getPreviews(tabIds: number[]): Record<number, string>;
  /** Background → switcher: a tab's new preview, while the switcher is open. */
  previewReady(preview: Preview): void;
  /** Background → switcher: a tab's title or address changed, while the switcher is open. */
  tabChanged(text: TabText): void;
  /** Background → switcher: the page's picture is taken, the switcher can show. */
  pictureTaken(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
