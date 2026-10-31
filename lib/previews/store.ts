import { browser, storage } from '#imports';

// The previews of the tabs, one item per tab in storage.session: in memory only, never on disk, gone when Chrome
// closes (.claude/rules/data.md). One item per tab, so saving a picture never rewrites the others.
const PREFIX = 'preview-';

/**
 * The room the previews always leave in the session's memory, for the switcher's own state there (where it is open,
 * the pages that have its frame, its window's tabs: hundreds of tabs take hundreds of kilobytes). Without it, previews
 * up to the last byte left the switcher unable to open.
 */
export const STATE_ROOM_BYTES = 1024 * 1024;

/** A preview as it is kept: the picture, and when it was saved (the oldest go first when memory is full). */
export interface SavedPreview {
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

/** The bytes the session's memory lacks for `saved` to take the place of `key`'s item; 0 or less when it fits. */
export function missingBytes(
  key: string,
  saved: SavedPreview,
  space: { inUse: number; replaced: number; quota: number },
): number {
  return space.inUse - space.replaced + bytesOf(key, saved) - space.quota;
}

/**
 * The keys of the previews to delete, oldest first, to free `missing` bytes among the items of the session's memory
 * (`session`, by key): never `key`'s own preview, nor anything that is not a preview.
 */
export function previewsToDelete(session: Record<string, unknown>, key: string, missing: number): string[] {
  const oldestFirst = Object.entries(session)
    .filter((entry): entry is [string, SavedPreview] => entry[0].startsWith(PREFIX) && entry[0] !== key)
    .filter(([, value]) => isSavedPreview(value))
    .sort(([, a], [, b]) => a.savedAt - b.savedAt);
  const gone: string[] = [];
  let left = missing;
  for (const [other, value] of oldestFirst) {
    if (left <= 0) break;
    gone.push(other);
    left -= bytesOf(other, value);
  }
  return gone;
}

/** Deletes the oldest previews, but never `key`'s, until `saved` fits in place of `key`'s preview. */
async function makeRoom(key: string, saved: SavedPreview): Promise<void> {
  const session = browser.storage.session;
  const [inUse, replaced] = await Promise.all([session.getBytesInUse(null), session.getBytesInUse(key)]);
  const missing = missingBytes(key, saved, { inUse, replaced, quota: session.QUOTA_BYTES - STATE_ROOM_BYTES });
  if (missing <= 0) return;
  const gone = previewsToDelete(await storage.snapshot('session'), key, missing);
  if (gone.length > 0) await storage.removeItems(gone.map((other) => `session:${other}` as const));
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
