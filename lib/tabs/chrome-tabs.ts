import { type Browser, browser } from '#imports';
import type { GroupColor, TabInfo } from './tabs';

/**
 * Every tab of the normal windows and every normal window, from Chrome, and the window the current tab counts in.
 * The current tab of a popup or app window (a site's sign-in window, an installed web app) counts as a tab of its home
 * window: the window of the tab that opened it, or else the normal window used last; so the switcher there lists it
 * first, then that window's tabs. The switcher's own window never counts.
 */
export async function readTabs(
  current?: Browser.tabs.Tab,
): Promise<{ tabs: TabInfo[]; windowIds: number[]; currentWindowId: number | undefined }> {
  const [tabs, windows, groups] = await Promise.all([
    browser.tabs.query({}),
    browser.windows.getAll({ windowTypes: ['normal'] }),
    browser.tabGroups.query({}),
  ]);
  const colors = new Map(groups.map((group) => [group.id, group.color as GroupColor]));
  const normal = new Set(windows.map((w) => w.id));
  const read = listedTabs(tabs, normal, colors);
  let currentWindowId = current?.windowId;
  if (current?.id !== undefined && !normal.has(current.windowId) && !isOwnPage(current)) {
    const opener = tabs.find((tab) => tab.id === current.openerTabId && normal.has(tab.windowId));
    const home =
      opener?.windowId ??
      (await browser.windows.getLastFocused({ windowTypes: ['normal'] }).then(
        (window) => window.id,
        () => undefined,
      ));
    if (home !== undefined) {
      currentWindowId = home;
      read.push({ ...tabInfo(current, colors), windowId: home });
    }
  }
  return { tabs: read, windowIds: windows.flatMap((w) => (w.id === undefined ? [] : [w.id])), currentWindowId };
}

/**
 * A tab's address: the page it shows, or the one it is loading. Chrome gives a tab that hasn't shown its page yet an
 * empty url, not none, with the address it is loading in pendingUrl.
 */
function addressOf(tab: Browser.tabs.Tab): string {
  return tab.url || tab.pendingUrl || '';
}

/** A page of this extension: the switcher's own window. */
function isOwnPage(tab: Browser.tabs.Tab): boolean {
  return addressOf(tab).startsWith(browser.runtime.getURL('/'));
}

/**
 * What the switcher shows of the tabs in these windows (`windowIds`), as Chrome gives them: a tab without an id (one
 * Chrome is still making) is left out. `colors` has the color of each tab group, by its id.
 */
export function listedTabs(
  tabs: readonly Browser.tabs.Tab[],
  windowIds: ReadonlySet<number | undefined>,
  colors: ReadonlyMap<number, GroupColor>,
): TabInfo[] {
  return tabs.filter((tab) => tab.id !== undefined && windowIds.has(tab.windowId)).map((tab) => tabInfo(tab, colors));
}

function tabInfo(tab: Browser.tabs.Tab, colors: ReadonlyMap<number, GroupColor>): TabInfo {
  const url = addressOf(tab);
  const info: TabInfo = {
    id: tab.id as number,
    windowId: tab.windowId,
    title: tab.title || url,
    url,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    sleeping: tab.discarded || (tab.frozen ?? false),
    incognito: tab.incognito,
    lastAccessed: tab.lastAccessed ?? 0,
  };
  const groupColor = colors.get(tab.groupId);
  return groupColor ? { ...info, groupColor } : info;
}
