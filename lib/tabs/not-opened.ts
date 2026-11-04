import { type Browser, browser, storage } from '#imports';
import { withRoomForState } from '../previews/store';

// The tabs opened in the background and not opened since, shown with "New" (Tabs not opened yet). Chrome doesn't say
// it: a tab's lastAccessed starts at the time it is made and changes only when it shows (web_contents_impl.cc), so a
// tab never opened can't be told from one used once. The background sees them made and opened, and keeps only their
// ids, one item per tab in storage.session: in memory only, never on disk, gone when Chrome closes
// (.claude/rules/data.md). One item per tab, so two tabs made at once never write over each other.
const PREFIX = 'notOpened-';

function itemKey(tabId: number) {
  return `session:${PREFIX}${tabId}` as const;
}

/**
 * Whether a tab the browser just made is one the user hasn't opened: made in the background (a link opened with
 * Ctrl+click), not a tab the browser brings back (Reopen closed window). A new tab has no page of its own yet as it is
 * made: an empty url, the address it goes to in pendingUrl. A tab brought back already has its page, from the session:
 * its url (Chrome leaves it unloaded until it is opened, Microsoft Edge loads it at once, so its status can't tell).
 * The tabs of a session restored as the browser starts come before the background runs, with no event (tests/e2e).
 */
export function madeNotOpened(tab: Pick<Browser.tabs.Tab, 'active' | 'url'>): boolean {
  return !tab.active && !tab.url;
}

/** Follows the tabs made, opened, replaced and closed. Added as the background starts (architecture.md). */
export function followNotOpenedTabs(): void {
  browser.tabs.onCreated.addListener(async (tab) => {
    const tabId = tab.id;
    if (tabId !== undefined && madeNotOpened(tab)) await withRoomForState(() => storage.setItem(itemKey(tabId), true));
  });
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    await storage.removeItem(itemKey(tabId));
  });
  browser.tabs.onRemoved.addListener(async (tabId) => {
    await storage.removeItem(itemKey(tabId));
  });
  // A tab Chrome took out of memory gets a new id (tabs.discard): it is still not opened.
  browser.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    if (!(await storage.getItem(itemKey(removedTabId)))) return;
    await withRoomForState(() => storage.setItem(itemKey(addedTabId), true));
    await storage.removeItem(itemKey(removedTabId));
  });
}

/** Which of these tabs haven't been opened yet. */
export async function notOpenedTabs(tabIds: readonly number[]): Promise<Set<number>> {
  if (tabIds.length === 0) return new Set();
  const items = await storage.getItems(tabIds.map(itemKey));
  const byKey = new Map(items.map(({ key, value }) => [key, value]));
  return new Set(tabIds.filter((tabId) => byKey.get(itemKey(tabId)) === true));
}
