import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { deleteAllPreviews, deletePreview, loadPreviews, savePreview } from '../../lib/previews/store';
import { sessionSpace } from './logic-setup';

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

  it('keeps them in memory only (storage.session)', async () => {
    await savePreview(1, 'data:image/webp;base64,AAA');
    expect(Object.keys(await storage.snapshot('local'))).toEqual([]);
    expect(Object.keys(await storage.snapshot('session'))).toHaveLength(1);
  });

  it("deletes a closed tab's preview", async () => {
    await savePreview(1, 'data:image/webp;base64,AAA');
    await savePreview(2, 'data:image/webp;base64,BBB');
    await deletePreview(1);
    expect(await loadPreviews([1, 2])).toEqual({ 2: 'data:image/webp;base64,BBB' });
  });

  it('deletes them all, and nothing else of the session', async () => {
    await storage.setItem('session:openSwitcher', { in: 'page', tabId: 1, fromWindowId: 1 });
    await savePreview(1, 'data:image/webp;base64,AAA');
    await savePreview(2, 'data:image/webp;base64,BBB');
    await deleteAllPreviews();
    expect(await loadPreviews([1, 2])).toEqual({});
    expect(await storage.getItem('session:openSwitcher')).not.toBeNull();
  });

  describe('when the memory for the session is full', () => {
    /** A picture as large as the others, different for each tab. */
    const picture = (tabId: number) => `data:image/webp;base64,${String(tabId).repeat(200)}`;
    let now = 1000;

    beforeEach(() => {
      vi.spyOn(Date, 'now').mockImplementation(() => now++);
    });

    afterEach(() => {
      sessionSpace();
      vi.restoreAllMocks();
    });

    /** Room for exactly `count` previews like these. */
    async function roomFor(count: number) {
      await savePreview(9, picture(9));
      const one = await fakeBrowser.storage.session.getBytesInUse(null);
      await deletePreview(9);
      sessionSpace(count * one);
    }

    it('deletes the oldest previews first, and keeps the new one', async () => {
      await roomFor(3);
      for (const tabId of [1, 2, 3]) await savePreview(tabId, picture(tabId));
      await savePreview(4, picture(4));
      expect(Object.keys(await loadPreviews([1, 2, 3, 4]))).toEqual(['2', '3', '4']);
      await savePreview(1, picture(1));
      expect(Object.keys(await loadPreviews([1, 2, 3, 4]))).toEqual(['1', '3', '4']);
    });

    it("counts a tab's own preview as free when it is taken again: nothing else is deleted", async () => {
      await roomFor(3);
      for (const tabId of [1, 2, 3]) await savePreview(tabId, picture(tabId));
      await savePreview(1, picture(1));
      expect(Object.keys(await loadPreviews([1, 2, 3]))).toEqual(['1', '2', '3']);
    });

    it('deletes as many old previews as the new one needs', async () => {
      await roomFor(3);
      for (const tabId of [1, 2, 3]) await savePreview(tabId, picture(tabId));
      await savePreview(4, `${picture(4)}${'4'.repeat(250)}`);
      expect(Object.keys(await loadPreviews([1, 2, 3, 4]))).toEqual(['3', '4']);
    });

    it('never deletes what is not a preview', async () => {
      await storage.setItem('session:openSwitcher', { in: 'page', tabId: 1, windowId: 1 });
      await roomFor(3);
      for (const tabId of [1, 2, 3, 4]) await savePreview(tabId, picture(tabId));
      expect(await storage.getItem('session:openSwitcher')).not.toBeNull();
    });
  });
});
