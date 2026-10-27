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
  fromClick: boolean;
  /** The shortcuts as Chrome writes them, "" when one has none. */
  shortcuts: { next: string; previous: string };
}

/** The messages between the background and the switcher (in a page, or in its own window). */
interface Messages {
  /** Background → switcher: show these tabs. */
  showSwitcher(snapshot: SwitcherSnapshot): void;
  /** Background → switcher: the shortcut was pressed again while it is open. */
  moveSwitcher(direction: Direction): void;
  /** Switcher's window → background: the snapshot to show, once its page has loaded. */
  getSnapshot(): SwitcherSnapshot | null;
  /** Switcher → background: open this tab (the switcher has already closed). */
  openTab(tab: { id: number; windowId: number }): void;
  /** Switcher → background: close this tab; the switcher stays open. */
  closeTab(tabId: number): void;
  /** Switcher → background: it closed without opening a tab. */
  switcherClosed(): void;
  /** Switcher → background: open the settings page. */
  openSettings(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
