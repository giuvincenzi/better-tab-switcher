import { describe, expect, it } from 'vitest';
import { listedTabs } from '../../lib/tabs/chrome-tabs';
import type { GroupColor } from '../../lib/tabs/tabs';
import { tab } from './background-world';

// Which tabs the switcher lists, read from the real browser: tests/e2e/tabs.spec.ts and switcher.spec.ts.

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
