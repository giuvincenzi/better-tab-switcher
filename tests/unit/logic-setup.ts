import { fakeBrowser } from 'wxt/testing/fake-browser';

// What WXT's fake browser doesn't have of storage.session, as Chrome documents it: the bytes in use (each key and its
// value written as JSON) and the space there is (10 MB).
const session = fakeBrowser.storage.session as Omit<typeof fakeBrowser.storage.session, 'QUOTA_BYTES'> & {
  QUOTA_BYTES: number;
};

session.getBytesInUse = (async (keys?: string | string[] | null) => {
  const items: Record<string, unknown> = await session.get(null);
  const wanted = keys == null ? Object.keys(items) : typeof keys === 'string' ? [keys] : keys;
  let bytes = 0;
  for (const key of wanted)
    if (key in items) bytes += new TextEncoder().encode(key + JSON.stringify(items[key])).length;
  return bytes;
}) as typeof session.getBytesInUse;

session.QUOTA_BYTES = 10 * 1024 * 1024;

// What it doesn't have of tabs: onAttached, a tab moved into a window (Chrome sends it, with onDetached, as a tab
// moves to another window).
const attached = new Set<(...args: unknown[]) => unknown>();
(fakeBrowser.tabs as { onAttached: unknown }).onAttached = {
  addListener: (listener: (...args: unknown[]) => unknown) => attached.add(listener),
  removeListener: (listener: (...args: unknown[]) => unknown) => attached.delete(listener),
  hasListener: (listener: (...args: unknown[]) => unknown) => attached.has(listener),
  hasListeners: () => attached.size > 0,
};
