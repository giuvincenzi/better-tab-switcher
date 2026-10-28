import { defineExtensionMessaging } from '@webext-core/messaging';
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
   * Shown in a window of its own (on Chrome's pages): the Chrome window it is in the middle of. The switcher takes its
   * sizes from that window, as it would from its page, and its own window fits it.
   */
  centeredOn?: Rect;
}

/** A tab's new preview. */
export interface Preview {
  tabId: number;
  picture: string;
}

/** The messages between the background and the switcher, in the page or the window it is shown in. */
interface Messages {
  /** Switcher's window → background: the tabs to show, once (null when the window was not opened for a switcher). */
  getSnapshot(): SwitcherSnapshot | null;
  /** Background → switcher: show these tabs. */
  showSwitcher(snapshot: SwitcherSnapshot): void;
  /** Background → switcher: the shortcut was pressed again while it is open. */
  moveSwitcher(direction: Direction): void;
  /** Background → switcher: close, a new switcher opens in another tab. */
  closeSwitcher(): void;
  /** Switcher → background: open this tab (the switcher has already closed). */
  openTab(tabId: number): void;
  /** Switcher → background: close this tab; the switcher stays open. */
  closeTab(tabId: number): void;
  /** Switcher → background: it closed without opening a tab (Esc, a click outside): the user is back where they were. */
  switcherClosed(): void;
  /** Switcher's window → background: another window took the focus: it closes, the focus stays where the user went. */
  switcherLeft(): void;
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
  /** Background → switcher: the page's picture is taken, the switcher can show. */
  pictureTaken(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
