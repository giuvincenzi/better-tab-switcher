import { browser, storage } from '#imports';

// The previews of the tabs, one item per tab in storage.session: in memory only, never on disk, gone when Chrome
// closes (.claude/rules/data.md). One item per tab, so saving a picture never rewrites the others.
const PREFIX = 'preview-';

/** A preview as it is kept: the picture, and when it was saved (the oldest go first when memory is full). */
interface SavedPreview {
  picture: string;
  savedAt: number;
}

function itemKey(tabId: number) {
  return `session:${PREFIX}${tabId}` as const;
}

function isSavedPreview(value: unknown): value is SavedPreview {
  return typeof (value as SavedPreview | null)?.picture === 'string';
}

/**
 * Saves a tab's preview. When the memory for the extension's session (storage.session) can't hold it, the oldest
 * previews go first; the new one always stays (.claude/rules/data.md).
 */
export async function savePreview(tabId: number, picture: string): Promise<void> {
  const saved: SavedPreview = { picture, savedAt: Date.now() };
  await makeRoom(`${PREFIX}${tabId}`, saved);
  await storage.setItem(itemKey(tabId), saved);
}

/** The bytes an item takes in Chrome's storage: its key and its value written as JSON (storage.getBytesInUse). */
function bytesOf(key: string, value: unknown): number {
  return new TextEncoder().encode(key + JSON.stringify(value)).length;
}

/** Deletes the oldest previews, but never `key`'s, until `saved` fits in place of `key`'s preview. */
async function makeRoom(key: string, saved: SavedPreview): Promise<void> {
  const session = browser.storage.session;
  const [inUse, replaced] = await Promise.all([session.getBytesInUse(null), session.getBytesInUse(key)]);
  let missing = inUse - replaced + bytesOf(key, saved) - session.QUOTA_BYTES;
  if (missing <= 0) return;
  const oldestFirst = Object.entries(await storage.snapshot('session'))
    .filter((entry): entry is [string, SavedPreview] => entry[0].startsWith(PREFIX) && entry[0] !== key)
    .filter(([, value]) => isSavedPreview(value))
    .sort(([, a], [, b]) => a.savedAt - b.savedAt);
  const gone: `session:${string}`[] = [];
  for (const [other, value] of oldestFirst) {
    if (missing <= 0) break;
    gone.push(`session:${other}`);
    missing -= bytesOf(other, value);
  }
  if (gone.length > 0) await storage.removeItems(gone);
}

/** The previews there are of these tabs, by tab id. */
export async function loadPreviews(tabIds: readonly number[]): Promise<Record<number, string>> {
  if (tabIds.length === 0) return {};
  const items = await storage.getItems(tabIds.map(itemKey));
  const byKey = new Map(items.map(({ key, value }) => [key, value]));
  const previews: Record<number, string> = {};
  for (const tabId of tabIds) {
    const value = byKey.get(itemKey(tabId));
    if (isSavedPreview(value)) previews[tabId] = value.picture;
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
