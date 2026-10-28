import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Settings } from './settings/settings';
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
}

/** A tab's new preview. */
export interface Preview {
  tabId: number;
  picture: string;
}

/** The messages between the background and the switcher, in the page it is shown in. */
interface Messages {
  /** Background → switcher: show these tabs. */
  showSwitcher(snapshot: SwitcherSnapshot): void;
  /** Background → switcher: the shortcut was pressed again while it is open. */
  moveSwitcher(direction: Direction): void;
  /** Background → switcher: close, a new switcher opens in another tab. */
  closeSwitcher(): void;
  /** Switcher → background: open this tab (the switcher has already closed). */
  openTab(tab: { id: number; windowId: number }): void;
  /** Switcher → background: close this tab; the switcher stays open. */
  closeTab(tabId: number): void;
  /** Switcher → background: it closed without opening a tab. */
  switcherClosed(): void;
  /** Switcher → background: open the settings page. */
  openSettings(): void;
  /** Switcher → background: the previews there are of these tabs, by tab id. */
  getPreviews(tabIds: number[]): Record<number, string>;
  /** Background → switcher: a tab's new preview, while the switcher is open. */
  previewReady(preview: Preview): void;
  /** Background → switcher: the page's picture is taken, the switcher can show. */
  pictureTaken(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
