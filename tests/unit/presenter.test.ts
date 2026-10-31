import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import { listenToSwitcher, requestSwitcher } from '../../lib/presenter/presenter';
import { deliverTo, fakeChrome, newWorld, normalWindow, tab, type World } from './background-world';

// The messages between the background and the switcher: what the background sends, and the handlers it sets up.
const messages = await vi.hoisted(async () => (await import('./background-world')).fakeMessages());
vi.mock('../../lib/messages', () => ({ sendMessage: messages.sendMessage, onMessage: messages.onMessage }));

const userWindow = { left: 100, top: 50, width: 1200, height: 800 };
let world: World;
const previews = { takeForSwitcher: vi.fn(async (_tab: { id: number; windowId: number }) => undefined) };

const shortcut = () => requestSwitcher({ direction: 'next', from: 'shortcut' }, previews);

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

describe('the switcher in a window of its own', () => {
  it('opens on the next request after one that failed: a failure never blocks the requests after it', async () => {
    world.tabs = [tab(11, 1, { url: 'chrome://settings/' }), tab(12, 1)];
    vi.spyOn(browser.tabs, 'query').mockRejectedValueOnce(new Error('The browser is closing a window.'));
    await expect(shortcut()).rejects.toThrow();
    await shortcut();
    expect(browser.windows.create).toHaveBeenCalledTimes(1);
  });
});
