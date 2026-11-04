import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  isMemoryFull,
  loadPreviews,
  missingBytes,
  previewsToDelete,
  type SavedPreview,
  savePreview,
  withRoomForState,
} from '../../lib/previews/store';

// The previews kept in memory, deleted when their tab closes, and the oldest going first when the memory is full, on
// the real browser: tests/e2e/grid.spec.ts.

describe('previews store', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('gives back the previews there are, by tab id', async () => {
    await savePreview(1, 'data:image/webp;base64,AAA');
    await savePreview(3, 'data:image/webp;base64,CCC');
    expect(await loadPreviews([1, 2, 3])).toEqual({ 1: 'data:image/webp;base64,AAA', 3: 'data:image/webp;base64,CCC' });
    expect(await loadPreviews([])).toEqual({});
  });
});

describe('when the memory for the session is full', () => {
  /** A preview as large as the others, saved at `savedAt`. */
  const preview = (savedAt: number): SavedPreview => ({ picture: 'data:image/webp;base64,AAAA', savedAt });
  /** The bytes a preview item takes in Chrome's storage: its key and its value written as JSON. */
  const bytes = (key: string, value: SavedPreview) => new TextEncoder().encode(key + JSON.stringify(value)).length;
  /** The session's memory with the previews of tabs 1, 2 and 3, saved in this order. */
  const session = { 'preview-2': preview(20), 'preview-1': preview(10), 'preview-3': preview(30) };
  const one = bytes('preview-1', preview(10));

  it('is not full while the new preview fits', () => {
    expect(missingBytes('preview-4', preview(40), { inUse: 3 * one, replaced: 0, quota: 4 * one })).toBeLessThanOrEqual(
      0,
    );
  });

  it("counts a tab's own preview as free when it is taken again", () => {
    expect(
      missingBytes('preview-1', preview(40), { inUse: 3 * one, replaced: one, quota: 3 * one }),
    ).toBeLessThanOrEqual(0);
    expect(missingBytes('preview-4', preview(40), { inUse: 3 * one, replaced: 0, quota: 3 * one })).toBe(one);
  });

  it('deletes the oldest previews first', () => {
    expect(previewsToDelete(session, 'preview-4', one)).toEqual(['preview-1']);
  });

  it('deletes as many old previews as the new one needs', () => {
    expect(previewsToDelete(session, 'preview-4', one + 1)).toEqual(['preview-1', 'preview-2']);
  });

  it("never deletes the tab's own preview, nor what is not a preview", () => {
    const others = { ...session, openSwitcher: { in: 'page', tabId: 1, windowId: 1 }, 'preview-9': 'damaged' };
    expect(previewsToDelete(others, 'preview-1', 10 * one)).toEqual(['preview-2', 'preview-3']);
  });
});

describe("the switcher's state when the memory for the session is full", () => {
  const FULL = 'Session storage quota bytes exceeded. Values were not stored.';
  /** A preview of about `kilobytes` KB, saved at `savedAt`. */
  const big = (kilobytes: number, savedAt: number): SavedPreview => ({
    picture: `data:image/webp;base64,${'A'.repeat(kilobytes * 1024)}`,
    savedAt,
  });

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("knows Chrome's answer for a full memory from its other limits", () => {
    expect(isMemoryFull(new Error(FULL))).toBe(true);
    expect(isMemoryFull(new Error('This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.'))).toBe(
      false,
    );
    expect(isMemoryFull(undefined)).toBe(false);
  });

  it('makes room by deleting the oldest previews, keeps the newest, and writes the state', async () => {
    await fakeBrowser.storage.session.set({
      'preview-1': big(600, 10),
      'preview-2': big(600, 20),
      'preview-3': big(600, 30),
    });
    const session = fakeBrowser.storage.session;
    // Full to the last byte, as Chrome counts it.
    session.getBytesInUse = vi.fn(async () => session.QUOTA_BYTES) as typeof session.getBytesInUse;
    const write = vi.fn().mockRejectedValueOnce(new Error(FULL)).mockResolvedValueOnce(undefined);
    await withRoomForState(write);
    expect(write).toHaveBeenCalledTimes(2);
    // The room for the state, 1 MB: the two oldest previews, about 600 KB each.
    expect(Object.keys(await session.get(null)).sort()).toEqual(['preview-3']);
  });

  it('deletes nothing and fails as before when the write fails for another reason', async () => {
    await fakeBrowser.storage.session.set({ 'preview-1': big(1, 10) });
    const write = vi.fn().mockRejectedValue(new Error('Something else'));
    await expect(withRoomForState(write)).rejects.toThrow('Something else');
    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(await fakeBrowser.storage.session.get(null))).toEqual(['preview-1']);
  });
});
