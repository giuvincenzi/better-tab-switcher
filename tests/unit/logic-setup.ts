import { fakeBrowser } from 'wxt/testing/fake-browser';

// What WXT's fake browser doesn't have of storage.session, as Chrome documents it: the bytes in use (each key and its
// value written as JSON) and the space there is (10 MB). A test can give storage.session less space (sessionSpace).
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

/** Gives storage.session this many bytes (Chrome's 10 MB when not set). */
export function sessionSpace(bytes = 10 * 1024 * 1024): void {
  session.QUOTA_BYTES = bytes;
}

sessionSpace();
