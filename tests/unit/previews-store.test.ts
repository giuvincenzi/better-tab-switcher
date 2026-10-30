import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import {
  deleteAllPreviews,
  loadPreviews,
  missingBytes,
  previewsToDelete,
  type SavedPreview,
  savePreview,
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

  it('deletes them all, and nothing else of the session', async () => {
    await storage.setItem('session:openSwitcher', { in: 'page', tabId: 1, fromWindowId: 1 });
    await savePreview(1, 'data:image/webp;base64,AAA');
    await savePreview(2, 'data:image/webp;base64,BBB');
    await deleteAllPreviews();
    expect(await loadPreviews([1, 2])).toEqual({});
    expect(await storage.getItem('session:openSwitcher')).not.toBeNull();
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
