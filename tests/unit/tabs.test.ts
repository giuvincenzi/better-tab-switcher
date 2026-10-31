import { describe, expect, it } from 'vitest';
import { type Here, switcherTabs, type TabInfo } from '../../lib/tabs/tabs';

function tab(id: number, lastAccessed: number, more: Partial<TabInfo> = {}): TabInfo {
  return {
    id,
    windowId: 1,
    title: `Tab ${id}`,
    url: `https://example.com/${id}`,
    pinned: false,
    audible: false,
    sleeping: false,
    incognito: false,
    lastAccessed,
    ...more,
  };
}

const here: Here = { tabId: 1, windowId: 1, incognito: false };
const thisWindow = { scope: 'window', showPinned: true } as const;
const ids = (tabs: { id: number }[]) => tabs.map((t) => t.id);

describe('switcherTabs', () => {
  it('puts the most recently used first, the current tab on top', () => {
    const tabs = [tab(1, 100), tab(2, 300), tab(3, 200), tab(4, 400)];
    expect(ids(switcherTabs(tabs, [1], here, thisWindow))).toEqual([1, 4, 2, 3]);
  });

  it('keeps the current tab on top even when another was used later', () => {
    const tabs = [tab(1, 1), tab(2, 999)];
    expect(ids(switcherTabs(tabs, [1], here, thisWindow))).toEqual([1, 2]);
  });

  it('shows only the current window by default', () => {
    const tabs = [tab(1, 1), tab(2, 5, { windowId: 2 }), tab(3, 3)];
    expect(ids(switcherTabs(tabs, [1, 2], here, thisWindow))).toEqual([1, 3]);
  });

  it('shows every window with All windows, numbering the other windows from 2', () => {
    const tabs = [tab(1, 1), tab(2, 5, { windowId: 7 }), tab(3, 3, { windowId: 9 }), tab(4, 4)];
    const shown = switcherTabs(tabs, [9, 1, 7], here, { scope: 'all', showPinned: true });
    expect(ids(shown)).toEqual([1, 2, 4, 3]);
    expect(shown.map((t) => t.windowLabel)).toEqual([undefined, '3', undefined, '2']);
  });

  it('never mixes incognito and normal windows', () => {
    const tabs = [tab(1, 1), tab(2, 5, { windowId: 2, incognito: true })];
    expect(ids(switcherTabs(tabs, [1, 2], here, { scope: 'all', showPinned: true }))).toEqual([1]);
    const fromIncognito: Here = { tabId: 2, windowId: 2, incognito: true };
    expect(ids(switcherTabs(tabs, [1, 2], fromIncognito, { scope: 'all', showPinned: true }))).toEqual([2]);
  });

  it('hides pinned tabs when they are not shown, but never the current tab', () => {
    const tabs = [tab(1, 1, { pinned: true }), tab(2, 5, { pinned: true }), tab(3, 3)];
    expect(ids(switcherTabs(tabs, [1], here, { scope: 'window', showPinned: false }))).toEqual([1, 3]);
  });

  it('shows the other incognito windows with All windows, from an incognito window', () => {
    const tabs = [tab(1, 1), tab(2, 9, { windowId: 2, incognito: true }), tab(3, 5, { windowId: 3, incognito: true })];
    const fromIncognito: Here = { tabId: 2, windowId: 2, incognito: true };
    const shown = switcherTabs(tabs, [1, 2, 3], fromIncognito, { scope: 'all', showPinned: true });
    expect(ids(shown)).toEqual([2, 3]);
  });

  it("numbers the windows by Chrome's order, also counting the windows that have no tab shown", () => {
    const tabs = [tab(1, 1), tab(2, 5, { windowId: 7 })];
    const shown = switcherTabs(tabs, [1, 5, 7], here, { scope: 'all', showPinned: true });
    expect(shown.map((t) => t.windowLabel)).toEqual([undefined, '3']);
  });

  it('does not change the list it is given', () => {
    const tabs = [tab(1, 1), tab(2, 5)];
    switcherTabs(tabs, [1], here, thisWindow);
    expect(ids(tabs)).toEqual([1, 2]);
  });
});
