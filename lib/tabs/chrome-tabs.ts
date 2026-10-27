import { type Browser, browser } from '#imports';
import type { GroupColor, TabInfo } from './tabs';

/** Every tab and every normal window, from Chrome. */
export async function readTabs(): Promise<{ tabs: TabInfo[]; windowIds: number[] }> {
  const [tabs, windows, groups] = await Promise.all([
    browser.tabs.query({}),
    browser.windows.getAll({ windowTypes: ['normal'] }),
    browser.tabGroups.query({}),
  ]);
  const colors = new Map(groups.map((group) => [group.id, group.color as GroupColor]));
  const normal = new Set(windows.map((w) => w.id));
  return {
    tabs: tabs.filter((tab) => tab.id !== undefined && normal.has(tab.windowId)).map((tab) => toTabInfo(tab, colors)),
    windowIds: windows.flatMap((w) => (w.id === undefined ? [] : [w.id])),
  };
}

function toTabInfo(tab: Browser.tabs.Tab, colors: Map<number, GroupColor>): TabInfo {
  const url = tab.url ?? tab.pendingUrl ?? '';
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
