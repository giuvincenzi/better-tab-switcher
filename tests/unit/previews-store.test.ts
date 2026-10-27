import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { deleteAllPreviews, deletePreview, loadPreviews, savePreview } from '../../lib/previews/store';

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
});
