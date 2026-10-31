import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import { keepPreviews } from '../../lib/previews/service';
import { loadPreviews } from '../../lib/previews/store';
import { saveSettings } from '../../lib/settings/store';
import { PICTURE_WIDTH } from '../../lib/switcher/sizes';
import { fakeChrome, newWorld, normalWindow, settle, tab } from './background-world';

// Making a picture small needs a real browser (tests/unit/shrink.browser.test.ts): here it gives a text that says what
// it was made from.
const shrink = vi.hoisted(() => ({
  picture: vi.fn(async (dataUrl: string, width: number) => `small(${width}):${dataUrl}`),
}));
vi.mock('../../lib/previews/shrink', () => ({ shrinkPicture: shrink.picture }));

const PAGE = 'data:image/jpeg;base64,PAGE';
const onPreview = vi.fn();

beforeEach(async () => {
  fakeBrowser.reset();
  onPreview.mockReset();
  shrink.picture.mockClear();
  fakeChrome(
    newWorld({ windows: [normalWindow(1), normalWindow(2)], tabs: [tab(11, 1), tab(21, 2)], currentTabId: 11 }),
  );
  vi.spyOn(browser.tabs, 'captureVisibleTab').mockImplementation((async () => PAGE) as never);
  await saveSettings({ view: 'grid', gridShow: 'previews' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the picture taken as the switcher opens', () => {
  it('is taken of the window the tab is shown in', async () => {
    await keepPreviews(onPreview).takeForSwitcher({ id: 21, windowId: 2 });
    expect(vi.mocked(browser.tabs.captureVisibleTab).mock.calls[0]?.[0]).toBe(2);
  });

  it('is kept made small for its tab, and given to the open switcher', async () => {
    await keepPreviews(onPreview).takeForSwitcher({ id: 11, windowId: 1 });
    await vi.waitFor(() => expect(onPreview).toHaveBeenCalled());
    const small = await shrink.picture.mock.results[0]?.value;
    expect(shrink.picture).toHaveBeenCalledWith(PAGE, PICTURE_WIDTH);
    expect(onPreview).toHaveBeenCalledWith(11, small);
    expect(await loadPreviews([11])).toEqual({ 11: small });
  });

  it('lets the switcher show when Chrome refuses it (more than two pictures a second), and keeps nothing', async () => {
    vi.mocked(browser.tabs.captureVisibleTab).mockRejectedValue(
      new Error('This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.'),
    );
    await expect(keepPreviews(onPreview).takeForSwitcher({ id: 11, windowId: 1 })).resolves.toBeUndefined();
    await settle();
    expect(onPreview).not.toHaveBeenCalled();
    expect(await loadPreviews([11])).toEqual({});
  });
});

// Deleted when their tab closes or the grid shows icons, on the real browser: tests/e2e/grid.spec.ts.
