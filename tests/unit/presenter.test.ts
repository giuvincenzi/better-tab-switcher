import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import type { SwitcherSnapshot } from '../../lib/messages';
import { listenToSwitcher, requestSwitcher, showPreview } from '../../lib/presenter/presenter';
import { saveSettings } from '../../lib/settings/store';
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

// The messages between the background and the switcher: what the background sends, and the handlers it sets up.
const messages = await vi.hoisted(async () => (await import('./background-world')).fakeMessages());
vi.mock('../../lib/messages', () => ({ sendMessage: messages.sendMessage, onMessage: messages.onMessage }));

/** The messages of this type the switcher received, with the tab each went to (none: the switcher's window). */
function sent(type: string) {
  return world.received.filter((m) => m.type === type).map(({ data, tabId }) => ({ data, tabId }));
}

const ask = messages.ask;

/** The tabs and settings the first switcher shown in a page got. */
function firstSnapshot(): SwitcherSnapshot {
  const [shown] = sent('showSwitcher');
  if (!shown) throw new Error('No switcher was shown in a page.');
  return shown.data as SwitcherSnapshot;
}

const userWindow = { left: 100, top: 50, width: 1200, height: 800 };
let world: World;
const previews = { takeForSwitcher: vi.fn(async (_tab: { id: number; windowId: number }) => undefined) };

const shortcut = (direction: 'next' | 'previous' = 'next') =>
  requestSwitcher({ direction, from: 'shortcut' }, previews);
const icon = () => requestSwitcher({ direction: 'next', from: 'icon' }, previews);

beforeEach(() => {
  fakeBrowser.reset();
  messages.sendMessage.mockClear();
  messages.handlers.clear();
  previews.takeForSwitcher.mockReset().mockResolvedValue(undefined);
  world = newWorld({
    windows: [normalWindow(1, userWindow), normalWindow(2)],
    tabs: [tab(11, 1, { lastAccessed: 100 }), tab(12, 1, { lastAccessed: 300 }), tab(21, 2)],
    currentTabId: 11,
    injected: new Set([11, 12, 21]),
  });
  messages.state.receive = deliverTo(world);
  fakeChrome(world);
  listenToSwitcher();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the switcher in a web page', () => {
  it('opens in the current page with the tabs of its window, the current one first, going the way asked', async () => {
    await shortcut('previous');
    const [shown] = sent('showSwitcher');
    expect(shown?.tabId).toBe(11);
    const snapshot = shown?.data as SwitcherSnapshot;
    expect(snapshot.tabs.map((t) => t.id)).toEqual([11, 12]);
    expect(snapshot.direction).toBe('previous');
    expect(snapshot.fromIcon).toBe(false);
    expect(browser.windows.create).not.toHaveBeenCalled();
  });

  it('opens from the toolbar icon to stay open until a tab is chosen', async () => {
    await icon();
    expect(firstSnapshot().fromIcon).toBe(true);
  });

  it("injects the switcher's script into a page that doesn't have it yet, then shows it there", async () => {
    world.injected.delete(11);
    await shortcut();
    expect(browser.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 11 }, files: ['/content-scripts/switcher.js'] }),
    );
    expect(sent('showSwitcher').at(-1)?.tabId).toBe(11);
    expect(world.injected.has(11)).toBe(true);
  });

  it('does not inject the script again into a page that already has it', async () => {
    await shortcut();
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('moves the selection when the shortcut is pressed again in the same page', async () => {
    await shortcut();
    await shortcut('previous');
    expect(sent('moveSwitcher')).toEqual([{ data: 'previous', tabId: 11 }]);
    expect(sent('showSwitcher')).toHaveLength(1);
    expect(sent('closeSwitcher')).toEqual([]);
  });

  it('closes the open switcher and opens a new one when the toolbar icon is clicked', async () => {
    await shortcut();
    await icon();
    expect(sent('moveSwitcher')).toEqual([]);
    expect(sent('closeSwitcher')).toEqual([{ data: undefined, tabId: 11 }]);
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11, 11]);
  });

  it('closes the switcher left open in another tab and opens it in the current one', async () => {
    await shortcut();
    world.currentTabId = 21;
    await shortcut();
    expect(sent('closeSwitcher')).toEqual([{ data: undefined, tabId: 11 }]);
    expect(sent('moveSwitcher')).toEqual([]);
    expect(sent('showSwitcher').at(-1)?.tabId).toBe(21);
  });

  it('opens a new switcher in a page reloaded since: the old one is gone', async () => {
    await shortcut();
    world.injected.delete(11);
    await shortcut();
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11, 11]);
    expect(browser.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('closes the open switcher and opens none when there is no current tab', async () => {
    await shortcut();
    world.currentTabId = undefined;
    await shortcut();
    expect(sent('closeSwitcher')).toEqual([{ data: undefined, tabId: 11 }]);
    expect(sent('showSwitcher')).toHaveLength(1);
    expect(browser.windows.create).not.toHaveBeenCalled();
  });
});

describe('the switcher in a window of its own', () => {
  it.each([
    ['a browser page', 'chrome://settings/'],
    ['the new tab page', 'chrome://newtab/'],
    ['a local file', 'file:///home/me/report.pdf'],
    ['the Chrome Web Store', 'https://chromewebstore.google.com/detail/x'],
  ])('opens in its own window on %s, without trying the page', async (_, url) => {
    world.tabs = [tab(11, 1, { url }), tab(12, 1)];
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'popup', focused: true, url: browser.runtime.getURL('/switcher-window.html') }),
    );
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
    expect(sent('showSwitcher')).toEqual([]);
  });

  it('opens in its own window on a web page that keeps the script out', async () => {
    world.injected.delete(11);
    world.refusing.add(11);
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
  });

  it('opens in the middle of the window the user is in', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' })];
    await shortcut();
    const created = vi.mocked(browser.windows.create).mock.calls[0]?.[0];
    const { left = 0, top = 0, width = 0, height = 0 } = created ?? {};
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(userWindow.width);
    expect(height).toBeLessThanOrEqual(userWindow.height);
    expect(Math.abs(left + width / 2 - (userWindow.left + userWindow.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(top + height / 2 - (userWindow.top + userWindow.height / 2))).toBeLessThanOrEqual(1);
  });

  it('gives its window the tabs once, with the place of the window it is in the middle of', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(12, 1), tab(21, 2)];
    await shortcut('previous');
    const snapshot = (await ask('getSnapshot')) as SwitcherSnapshot;
    expect(snapshot.tabs.map((t) => t.id)).toEqual([11, 12]);
    expect(snapshot.direction).toBe('previous');
    expect(snapshot.centeredOn).toEqual(userWindow);
    expect(await ask('getSnapshot')).toBeNull();
  });

  it('opens nowhere on a browser page when "use a window" is turned off', async () => {
    await saveSettings({ chromePagesWindow: false });
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' })];
    await shortcut();
    expect(browser.windows.create).not.toHaveBeenCalled();
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('leaves no switcher behind on a page that keeps the script out when "use a window" is turned off', async () => {
    await saveSettings({ chromePagesWindow: false });
    world.injected.delete(11);
    world.refusing.add(11);
    await shortcut();
    world.currentTabId = 12;
    messages.sendMessage.mockClear();
    await shortcut();
    expect(messages.sendMessage.mock.calls.filter(([, , tabId]) => tabId === 11)).toEqual([]);
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([12]);
  });

  it('moves the selection when the shortcut is pressed again in its window', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(12, 1)];
    await shortcut();
    await shortcut('previous');
    expect(sent('moveSwitcher')).toEqual([{ data: 'previous', tabId: undefined }]);
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
    expect(browser.windows.remove).not.toHaveBeenCalled();
  });

  it('closes its window and opens a new switcher when the shortcut is pressed in another window', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(21, 2)];
    await shortcut();
    world.currentTabId = 21;
    await shortcut();
    expect(browser.windows.remove).toHaveBeenCalledWith(FIRST_POPUP_ID);
    expect(sent('moveSwitcher')).toEqual([]);
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([21]);
  });

  it('opens on the next request after one that failed: a failure never blocks the requests after it', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(12, 1)];
    vi.spyOn(browser.tabs, 'query').mockRejectedValueOnce(new Error('The browser is closing a window.'));
    await expect(shortcut()).rejects.toThrow();
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
  });

  it('opens once when the shortcut is pressed twice quickly, then moves its selection', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(12, 1)];
    await Promise.all([shortcut(), shortcut('previous')]);
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
    expect(browser.windows.remove).not.toHaveBeenCalled();
    expect(sent('moveSwitcher')).toEqual([{ data: 'previous', tabId: undefined }]);
  });
});

describe("the page's picture for the previews", () => {
  beforeEach(async () => {
    await saveSettings({ view: 'grid', gridShow: 'previews' });
  });

  it('is taken before the switcher shows in the page, and the switcher waits for it', async () => {
    let taken = () => {};
    previews.takeForSwitcher.mockReturnValue(new Promise<undefined>((done) => (taken = () => done(undefined))));
    const request = shortcut();
    await vi.waitFor(() => expect(sent('showSwitcher')).toHaveLength(1));
    expect(previews.takeForSwitcher).toHaveBeenCalledWith({ id: 11, windowId: 1 });
    expect(previews.takeForSwitcher.mock.invocationCallOrder[0]).toBeLessThan(
      messages.sendMessage.mock.invocationCallOrder[0] ?? 0,
    );
    expect(firstSnapshot().waitForPicture).toBe(true);
    expect(sent('pictureTaken')).toEqual([]);
    taken();
    await request;
    expect(sent('pictureTaken')).toEqual([{ data: undefined, tabId: 11 }]);
  });

  it('is not taken of an incognito tab', async () => {
    world.tabs = [tab(11, 1, { incognito: true })];
    await shortcut();
    expect(previews.takeForSwitcher).not.toHaveBeenCalled();
    expect(firstSnapshot().waitForPicture).toBe(false);
  });

  it('is not taken when the switcher shows no previews', async () => {
    await saveSettings({ gridShow: 'icons' });
    await shortcut();
    expect(previews.takeForSwitcher).not.toHaveBeenCalled();
    expect(firstSnapshot().waitForPicture).toBe(false);
  });
});

describe('new previews', () => {
  it('go to the switcher open in a page', async () => {
    await shortcut();
    await showPreview(12, 'data:image/webp;base64,BBB');
    expect(sent('previewReady')).toEqual([{ data: { tabId: 12, picture: 'data:image/webp;base64,BBB' }, tabId: 11 }]);
  });

  it("go to the switcher's own window", async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' })];
    await shortcut();
    await showPreview(12, 'data:image/webp;base64,BBB');
    expect(sent('previewReady')).toEqual([
      { data: { tabId: 12, picture: 'data:image/webp;base64,BBB' }, tabId: undefined },
    ]);
  });

  it('go nowhere when no switcher is open', async () => {
    await showPreview(12, 'data:image/webp;base64,BBB');
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('reach a switcher that is still being shown', async () => {
    const deliver = deliverTo(world);
    let arrived: Promise<void> = Promise.resolve();
    messages.state.receive = async (type, data, tabId) => {
      if (type === 'showSwitcher') arrived = showPreview(12, 'data:image/webp;base64,BBB');
      return deliver(type, data, tabId);
    };
    await shortcut();
    await arrived;
    expect(sent('previewReady').map((m) => m.tabId)).toEqual([11]);
  });
});

describe('after the background restarted', () => {
  it('still finds the switcher it opened: the shortcut moves it', async () => {
    await shortcut();
    vi.resetModules();
    const restarted = await import('../../lib/presenter/presenter');
    await restarted.requestSwitcher({ direction: 'next', from: 'shortcut' }, previews);
    expect(sent('moveSwitcher')).toEqual([{ data: 'next', tabId: 11 }]);
    expect(sent('showSwitcher')).toHaveLength(1);
  });

  it("still finds the switcher's window it opened: closing it refocuses the window it came from", async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' })];
    await shortcut();
    vi.resetModules();
    const restarted = await import('../../lib/presenter/presenter');
    messages.handlers.clear();
    restarted.listenToSwitcher();
    await ask('switcherClosed');
    await settle();
    expect(browser.windows.remove).toHaveBeenCalledWith(FIRST_POPUP_ID);
    expect(browser.windows.update).toHaveBeenCalledWith(1, { focused: true });
  });
});
