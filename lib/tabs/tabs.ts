import type { Scope } from '../settings/settings';

/** Chrome's tab group colors. */
export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

/** What the switcher needs of a tab, read from Chrome. */
export interface TabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  audible: boolean;
  /** Chrome put the tab to sleep to save memory: opening it reloads it. */
  sleeping: boolean;
  incognito: boolean;
  /** When the tab was last active in its window (Chrome's lastAccessed), in milliseconds since 1970. */
  lastAccessed: number;
  groupColor?: GroupColor;
}

/** A tab as the switcher shows it. */
export interface SwitcherTab extends TabInfo {
  /** The number of its window when it is not the current one ("2", "3"…), shown with "All windows". */
  windowLabel?: string;
}

export interface Here {
  tabId: number;
  windowId: number;
  incognito: boolean;
}

export interface TabFilter {
  scope: Scope;
  showPinned: boolean;
}

/**
 * The tabs the switcher shows, most recently used first, the current tab on top: from the current window or from all
 * windows, never mixing incognito and normal windows, pinned tabs only when shown (the current tab always is).
 * `windowIds` are every window in Chrome's order: the other windows are numbered from 2 in that order.
 */
export function switcherTabs(tabs: readonly TabInfo[], windowIds: readonly number[], here: Here, filter: TabFilter) {
  const labels = new Map<number, string>();
  let next = 2;
  for (const id of windowIds) {
    if (id !== here.windowId && !labels.has(id)) labels.set(id, String(next++));
  }
  const shown = tabs.filter(
    (tab) =>
      tab.id === here.tabId ||
      (tab.incognito === here.incognito &&
        (filter.scope === 'all' || tab.windowId === here.windowId) &&
        (filter.showPinned || !tab.pinned)),
  );
  return shown
    .sort((a, b) => rank(b, here) - rank(a, here))
    .map((tab): SwitcherTab => {
      const windowLabel = tab.windowId === here.windowId ? undefined : labels.get(tab.windowId);
      return windowLabel === undefined ? tab : { ...tab, windowLabel };
    });
}

function rank(tab: TabInfo, here: Here) {
  return tab.id === here.tabId ? Number.POSITIVE_INFINITY : tab.lastAccessed;
}
