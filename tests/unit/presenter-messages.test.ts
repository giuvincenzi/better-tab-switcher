import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import { listenToSwitcher, requestSwitcher } from '../../lib/presenter/presenter';
import {
  deliverTo,
  FIRST_POPUP_ID,
  fakeChrome,
  newWorld,
  normalWindow,
  settle,
  tab,
  type World,
} from './background-world';

// What the background does when the switcher it opened talks to it, and when Chrome closes or activates tabs and
// windows under it.

const messages = await vi.hoisted(async () => (await import('./background-world')).fakeMessages());
vi.mock('../../lib/messages', () => ({ sendMessage: messages.sendMessage, onMessage: messages.onMessage }));

let world: World;
const previews = { takeForSwitcher: async () => undefined };
const shortcut = () => requestSwitcher({ direction: 'next', from: 'shortcut' }, previews);
const received = (type: string) => world.received.filter((m) => m.type === type).map((m) => m.tabId);

/** Opens the switcher in the page of tab 11 (window 1). */
async function openInPage() {
  await shortcut();
}

/** Opens the switcher in its own window, from a browser page in window 1. */
async function openInWindow() {
  world.tabs[0] = tab(11, 1, { url: 'chrome://settings/' });
  await shortcut();
}

beforeEach(() => {
  fakeBrowser.reset();
  messages.sendMessage.mockClear();
  messages.handlers.clear();
  world = newWorld({
    windows: [normalWindow(1), normalWindow(2)],
    tabs: [tab(11, 1), tab(12, 1), tab(21, 2)],
    currentTabId: 11,
    injected: new Set([11, 12, 21]),
  });
  messages.state.receive = deliverTo(world);
  fakeChrome(world);
  listenToSwitcher(async () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// What the user sees of these on the real browser (the tab opened and its window in front, the switcher's window
// closed, the keys the page passes on, the tabs closed from the switcher, the switcher closed when another tab or
// window comes to the front, the previews shown): tests/e2e/switcher.spec.ts, switching.spec.ts, tabs.spec.ts,
// focus.spec.ts and grid.spec.ts.

describe('opening a tab', () => {
  it('focuses the window the tab is in now, when it was moved to another window while the switcher was open', async () => {
    await openInPage();
    // The switcher listed tab 12 in window 1; it was dragged to window 2 meanwhile.
    world.tabs = world.tabs.map((t) => (t.id === 12 ? { ...t, windowId: 2 } : t));
    await messages.ask('openTab', 12);
    expect(browser.tabs.update).toHaveBeenCalledWith(12, { active: true });
    expect(browser.windows.update).toHaveBeenCalledWith(2, { focused: true });
  });

  it('does nothing, quietly, when the tab was closed while the switcher was open', async () => {
    await openInPage();
    world.tabs = world.tabs.filter((t) => t.id !== 21);
    await expect(messages.ask('openTab', 21)).resolves.toBeUndefined();
    expect(browser.tabs.update).not.toHaveBeenCalled();
    expect(browser.windows.update).not.toHaveBeenCalled();
  });
});

describe("the switcher's frame in a page, once the switcher is done", () => {
  it.each([
    ['a tab is chosen', () => messages.ask('openTab', 12)],
    ['it closes without a tab chosen', () => messages.ask('switcherClosed')],
    ['the settings open', () => messages.ask('openSettings')],
  ])('hides when %s', async (_, done) => {
    await openInPage();
    await done();
    await settle();
    expect(received('hideFrame')).toEqual([11]);
  });

  it('hides without holding up the tab chosen, even when the page hangs', async () => {
    await openInPage();
    world.hung.add(11);
    await messages.ask('openTab', 12);
    expect(browser.tabs.update).toHaveBeenCalledWith(12, { active: true });
  });
});

describe('the keys the page got while the frame had no focus', () => {
  const altUp = { type: 'keyup', key: 'Alt', altKey: false, ctrlKey: false, metaKey: false, isComposing: false };

  it('go nowhere from another page, or when the switcher is in its own window or closed', async () => {
    await openInPage();
    await messages.ask('keyInPage', altUp, 12);
    await messages.ask('switcherClosed');
    await messages.ask('keyInPage', altUp, 11);
    await openInWindow();
    await messages.ask('keyInPage', altUp, 11);
    expect(received('pressKey')).toEqual([]);
  });
});

describe('the switcher closed without a tab chosen', () => {
  it('closes quietly when the window it came from has closed meanwhile', async () => {
    await openInWindow();
    vi.mocked(browser.windows.update).mockRejectedValue(new Error('No window with id: 1.'));
    await expect(messages.ask('switcherClosed')).resolves.toBeUndefined();
  });
});

describe('the switcher left for another window', () => {
  it('is forgotten: the next shortcut opens a new one', async () => {
    await openInWindow();
    await messages.ask('switcherLeft');
    // The user is in a browser window again.
    world.currentTabId = 11;
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledTimes(2);
  });
});

describe('the settings', () => {
  it("open from the switcher, and the switcher's window closes", async () => {
    await openInWindow();
    await messages.ask('openSettings');
    expect(browser.windows.remove).toHaveBeenCalledWith(FIRST_POPUP_ID);
    expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
  });
});

describe('tabs and windows closed or activated under the switcher', () => {
  it('forgets the switcher whose tab closed: nothing is sent to that tab any more', async () => {
    await openInPage();
    await fakeBrowser.tabs.onRemoved.trigger(11, { windowId: 1, isWindowClosing: false });
    world.injected.delete(11);
    world.currentTabId = 12;
    messages.sendMessage.mockClear();
    await shortcut();
    expect(messages.sendMessage.mock.calls.filter(([, , tabId]) => tabId === 11)).toEqual([]);
    expect(received('showSwitcher')).toEqual([11, 12]);
  });

  it('keeps the switcher when another window closes', async () => {
    await openInPage();
    await fakeBrowser.windows.onRemoved.trigger(2);
    await shortcut();
    expect(received('moveSwitcher')).toEqual([11]);
  });

  it('keeps the switcher open when a tab comes to the front of another window', async () => {
    await openInPage();
    await fakeBrowser.tabs.onActivated.trigger({ tabId: 21, windowId: 2 });
    await settle();
    expect(received('closeSwitcher')).toEqual([]);
    await shortcut();
    expect(received('moveSwitcher')).toEqual([11]);
  });

  it('keeps the switcher open when its own tab is activated again', async () => {
    await openInPage();
    await fakeBrowser.tabs.onActivated.trigger({ tabId: 11, windowId: 1 });
    await settle();
    expect(received('closeSwitcher')).toEqual([]);
  });
});
