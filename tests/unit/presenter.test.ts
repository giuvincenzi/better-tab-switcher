import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import type { SwitcherSnapshot } from '../../lib/messages';
import {
  FIRST_TIME_MS,
  listenToSwitcher,
  PAGE_ANSWER_MS,
  requestSwitcher,
  showPreview,
} from '../../lib/presenter/presenter';
import { saveSettings } from '../../lib/settings/store';
import {
  deliverTo,
  FIRST_POPUP_ID,
  FIRST_POPUP_TAB_ID,
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

/** The messages of this type the switcher (or the frame's holder) received, with the tab each went to. */
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

beforeEach(async () => {
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
  // The background put the holder in these pages before (lib/presenter/presenter.ts, pagesWithHolder).
  await browser.storage.session.set({ pagesWithHolder: [...world.injected] });
  listenToSwitcher(async () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// What the user sees of these on the real browser (the switcher in the page or in its own window, the tabs it lists,
// the shortcut moving it, the reloaded page, the page that hangs): tests/e2e/switcher.spec.ts and switching.spec.ts.

describe('the switcher in a web page', () => {
  it('gives the switcher, once it is there, the keys the page got while its frame was loading, in order', async () => {
    const altUp = { type: 'keyup', key: 'Alt', altKey: false, ctrlKey: false, metaKey: false, isComposing: false };
    const down = { ...altUp, type: 'keydown', key: 'ArrowDown', altKey: true };
    world.keysWhileLoading.set(11, [down, altUp]);
    await shortcut();
    expect(world.received.map((m) => m.type)).toEqual(['showFrame', 'showSwitcher', 'pressKey', 'pressKey']);
    expect(sent('pressKey')).toEqual([
      { data: down, tabId: 11 },
      { data: altUp, tabId: 11 },
    ]);
  });

  it('sends each message to one tab, never to every page of the extension (each page keeps a hidden frame)', async () => {
    await shortcut();
    await shortcut('previous');
    await showPreview(12, 'data:image/webp;base64,BBB');
    world.currentTabId = 12;
    await icon();
    world.tabs.push(tab(13, 1, { url: 'chrome://settings/' }));
    world.currentTabId = 13;
    await shortcut();
    await shortcut();
    await showPreview(12, 'data:image/webp;base64,CCC');
    const calls = messages.sendMessage.mock.calls;
    expect(calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['showSwitcher', 'moveSwitcher', 'previewReady', 'closeSwitcher', 'hideFrame']),
    );
    expect(calls.filter(([, , tabId]) => tabId === undefined)).toEqual([]);
  });

  it('opens from the toolbar icon to stay open until a tab is chosen', async () => {
    await icon();
    expect(firstSnapshot().fromIcon).toBe(true);
  });

  it('does not inject the script again into a page that already has it', async () => {
    await shortcut();
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('closes the open switcher and opens a new one when the toolbar icon is clicked', async () => {
    await shortcut();
    await icon();
    expect(sent('moveSwitcher')).toEqual([]);
    expect(sent('closeSwitcher')).toEqual([{ data: undefined, tabId: 11 }]);
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11, 11]);
  });

  it('puts the holder in at once in a page it never put it in, without asking the page first', async () => {
    // A busy page can take over a second even to tell that nobody listens: it would be taken for one that hangs.
    world.tabs.push(tab(13, 1, { lastAccessed: 400 }));
    world.currentTabId = 13;
    await shortcut();
    expect(browser.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(messages.sendMessage.mock.calls.filter(([, , tabId]) => tabId === 13).map(([type]) => type)).toEqual([
      'showFrame',
      'showSwitcher',
    ]);
    expect(messages.sendMessage.mock.invocationCallOrder[0] ?? 0).toBeGreaterThan(
      vi.mocked(browser.scripting.executeScript).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('puts the holder in again at once in a tab that loaded another page since', async () => {
    await shortcut();
    await ask('switcherClosed');
    world.injected.delete(11);
    await fakeBrowser.tabs.onUpdated.trigger(11, { status: 'loading' }, world.tabs[0] as never);
    messages.sendMessage.mockClear();
    await shortcut();
    expect(browser.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(messages.sendMessage.mock.calls.filter(([, , tabId]) => tabId === 11).map(([type]) => type)).toEqual([
      'showFrame',
      'showSwitcher',
    ]);
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

describe('a page that hangs (a script that never ends)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A request, time going by (the waits for pages that don't answer) until it is done. */
  async function waited(request: Promise<void>): Promise<void> {
    let done = false;
    const settled = request.finally(() => {
      done = true;
    });
    while (!done) await vi.advanceTimersByTimeAsync(PAGE_ANSWER_MS);
    await settled;
  }

  it('with a switcher open in it, lets the shortcut open a new one instead of waiting for it', async () => {
    await shortcut();
    world.hung.add(11);
    await waited(shortcut());
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
    world.currentTabId = 12;
    await waited(icon());
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11, 12]);
  });

  it('waits for a script slower to put in than a page has to answer, and shows the switcher in the page', async () => {
    world.injected.delete(11);
    vi.mocked(browser.scripting.executeScript).mockImplementationOnce(
      (() =>
        new Promise((resolve) =>
          setTimeout(() => {
            world.injected.add(11);
            resolve([]);
          }, PAGE_ANSWER_MS * 2),
        )) as never,
    );
    await waited(shortcut());
    expect(PAGE_ANSWER_MS * 2).toBeLessThan(FIRST_TIME_MS);
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11]);
    expect(browser.windows.create).not.toHaveBeenCalled();
  });

  it('gives the switcher its first showing in a frame just made the time of a first opening, not the next ones', async () => {
    // Over 1 s once on a busy macOS machine: more than a page has to answer, less than a first opening has.
    world.showMs = PAGE_ANSWER_MS * 2;
    expect(world.showMs).toBeLessThan(FIRST_TIME_MS);
    world.frameToMake.add(11);
    await waited(shortcut());
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11]);
    expect(browser.windows.create).not.toHaveBeenCalled();
    // In a frame already there, as slow a switcher is taken for a page that hangs: it shows in its own window.
    world.currentTabId = 12;
    await waited(shortcut());
    expect(sent('showSwitcher').map((m) => m.tabId)).toEqual([11]);
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
  });

  it('puts nothing more into a page that hangs: no script, and the switcher in its own window after one wait', async () => {
    world.hung.add(11);
    const request = shortcut();
    await vi.advanceTimersByTimeAsync(PAGE_ANSWER_MS);
    await request;
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
  });
});

// Where the switcher can show in a page: tests/unit/placement.test.ts.
describe('the switcher in a window of its own', () => {
  it('opens in its own window on a web page that keeps the script out', async () => {
    world.injected.delete(11);
    world.refusing.add(11);
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
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
    expect(sent('moveSwitcher')).toEqual([{ data: 'previous', tabId: FIRST_POPUP_TAB_ID }]);
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
      { data: { tabId: 12, picture: 'data:image/webp;base64,BBB' }, tabId: FIRST_POPUP_TAB_ID },
    ]);
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
    restarted.listenToSwitcher(async () => {});
    await ask('switcherClosed');
    await settle();
    expect(browser.windows.remove).toHaveBeenCalledWith(FIRST_POPUP_ID);
    expect(browser.windows.update).toHaveBeenCalledWith(1, { focused: true });
  });
});
