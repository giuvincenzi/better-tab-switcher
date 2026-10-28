import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import { readTabs } from '../../lib/tabs/chrome-tabs';
import { fakeChrome, newWorld, normalWindow, tab, type World } from './background-world';

let world: World;

beforeEach(() => {
  fakeBrowser.reset();
  world = newWorld({ windows: [normalWindow(1), normalWindow(2)] });
  fakeChrome(world);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function readOne(more: Parameters<typeof tab>[2]) {
  world.tabs = [tab(11, 1, more)];
  const { tabs } = await readTabs();
  return tabs[0];
}

describe('readTabs', () => {
  it("reads the tabs and windows of the normal windows only, never the switcher's own window", async () => {
    world.windows.push({ ...normalWindow(900), type: 'popup' });
    world.tabs = [tab(11, 1), tab(21, 2), tab(9000, 900, { url: 'chrome-extension://id/switcher-window.html' })];
    const { tabs, windowIds } = await readTabs();
    expect(tabs.map((t) => t.id)).toEqual([11, 21]);
    expect(windowIds).toEqual([1, 2]);
  });

  it('leaves out a tab without an id', async () => {
    world.tabs = [tab(11, 1), tab(12, 1, { id: undefined })];
    expect((await readTabs()).tabs.map((t) => t.id)).toEqual([11]);
  });

  it('gives the address as the title of a tab without one', async () => {
    expect((await readOne({ title: '' }))?.title).toBe('https://example.com/11');
  });

  it('gives the address a tab is loading when it has none yet', async () => {
    const loading = await readOne({ url: undefined, title: '', pendingUrl: 'https://example.com/next' });
    expect(loading?.url).toBe('https://example.com/next');
    expect(loading?.title).toBe('https://example.com/next');
  });

  it('marks as sleeping a tab Chrome discarded or froze', async () => {
    expect((await readOne({ discarded: true }))?.sleeping).toBe(true);
    expect((await readOne({ frozen: true }))?.sleeping).toBe(true);
    expect((await readOne({}))?.sleeping).toBe(false);
  });

  it("gives a tab in a group its group's color, and none to a tab in no group", async () => {
    vi.mocked(browser.tabGroups.query).mockResolvedValue([
      { id: 5, color: 'cyan', collapsed: false, windowId: 1, title: 'Work' },
    ] as never);
    world.tabs = [tab(11, 1, { groupId: 5 }), tab(12, 1)];
    const { tabs } = await readTabs();
    expect(tabs[0]?.groupColor).toBe('cyan');
    expect(tabs[1]).not.toHaveProperty('groupColor');
  });

  it('keeps what the switcher shows of a tab', async () => {
    const read = await readOne({ pinned: true, audible: true, incognito: true, lastAccessed: 1234, title: 'Mail' });
    expect(read).toMatchObject({ id: 11, windowId: 1, title: 'Mail', pinned: true, audible: true, incognito: true });
    expect(read?.lastAccessed).toBe(1234);
  });
});
