import { storage } from '#imports';

// The previews of the tabs, one item per tab in storage.session: in memory only, never on disk, gone when Chrome
// closes (.claude/rules/data.md). One item per tab, so saving a picture never rewrites the others.
const PREFIX = 'preview-';

function itemKey(tabId: number) {
  return `session:${PREFIX}${tabId}` as const;
}

export async function savePreview(tabId: number, picture: string): Promise<void> {
  await storage.setItem(itemKey(tabId), picture);
}

/** The previews there are of these tabs, by tab id. */
export async function loadPreviews(tabIds: readonly number[]): Promise<Record<number, string>> {
  if (tabIds.length === 0) return {};
  const items = await storage.getItems(tabIds.map(itemKey));
  const byKey = new Map(items.map(({ key, value }) => [key, value]));
  const previews: Record<number, string> = {};
  for (const tabId of tabIds) {
    const value = byKey.get(itemKey(tabId));
    if (typeof value === 'string') previews[tabId] = value;
  }
  return previews;
}

export async function deletePreview(tabId: number): Promise<void> {
  await storage.removeItem(itemKey(tabId));
}

export async function deleteAllPreviews(): Promise<void> {
  const all = await storage.snapshot('session');
  const keys = Object.keys(all)
    .filter((key) => key.startsWith(PREFIX))
    .map((key) => `session:${key}` as const);
  if (keys.length > 0) await storage.removeItems(keys);
}
