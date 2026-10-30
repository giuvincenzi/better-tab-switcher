import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '#imports';
import { listedTabs, readTabs } from '../../lib/tabs/chrome-tabs';
import type { GroupColor } from '../../lib/tabs/tabs';
import { fakeChrome, newWorld, normalWindow, tab, type World } from './background-world';

// Which tabs the switcher lists, read from the real browser: tests/e2e/tabs.spec.ts and switcher.spec.ts.

describe('readTabs', () => {
  let world: World;

  beforeEach(() => {
    fakeBrowser.reset();
    world = newWorld({ windows: [normalWindow(1), normalWindow(2)] });
    fakeChrome(world);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts the current tab of a window opened by no tab (an installed web app) in the normal window used last', async () => {
    world.windows.push({ ...normalWindow(50), type: 'app' });
    world.lastNormalWindowId = 2;
    const app = tab(51, 50);
    world.tabs = [tab(11, 1), tab(21, 2), app];
    const { tabs, currentWindowId } = await readTabs(app);
    expect(currentWindowId).toBe(2);
    expect(tabs.find((t) => t.id === 51)?.windowId).toBe(2);
  });
});

describe('listedTabs', () => {
  const noGroups = new Map<number, GroupColor>();
  const windows = new Set([1]);
  /** What the switcher shows of one tab of window 1, as Chrome gives it. */
  const listed = (more: Parameters<typeof tab>[2]) => listedTabs([tab(11, 1, more)], windows, noGroups)[0];

  it('lists the tabs of the windows asked, leaving out a tab without an id', () => {
    const tabs = [tab(11, 1), tab(12, 1, { id: undefined }), tab(21, 2)];
    expect(listedTabs(tabs, windows, noGroups).map((t) => t.id)).toEqual([11]);
  });

  it('gives the address as the title of a tab without one', () => {
    expect(listed({ title: '' })?.title).toBe('https://example.com/11');
  });

  it('gives the address a tab is loading when it has not shown its page yet (Chrome gives an empty url)', () => {
    const loading = listed({ url: '', title: '', pendingUrl: 'https://example.com/next' });
    expect(loading?.url).toBe('https://example.com/next');
    expect(loading?.title).toBe('https://example.com/next');
  });

  it('marks as sleeping a tab Chrome discarded or froze', () => {
    expect(listed({ discarded: true })?.sleeping).toBe(true);
    expect(listed({ frozen: true })?.sleeping).toBe(true);
    expect(listed({})?.sleeping).toBe(false);
  });

  it("gives a tab in a group its group's color, and none to a tab in no group", () => {
    const colors = new Map<number, GroupColor>([[5, 'cyan']]);
    const [grouped, alone] = listedTabs([tab(11, 1, { groupId: 5 }), tab(12, 1)], windows, colors);
    expect(grouped?.groupColor).toBe('cyan');
    expect(alone).not.toHaveProperty('groupColor');
  });

  it('keeps what the switcher shows of a tab', () => {
    const read = listed({ pinned: true, audible: true, incognito: true, lastAccessed: 1234, title: 'Mail' });
    expect(read).toEqual({
      id: 11,
      windowId: 1,
      title: 'Mail',
      url: 'https://example.com/11',
      pinned: true,
      audible: true,
      sleeping: false,
      incognito: true,
      lastAccessed: 1234,
    });
  });
});
