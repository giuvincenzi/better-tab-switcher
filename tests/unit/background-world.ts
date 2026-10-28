import { vi } from 'vitest';
import { type Browser, browser, fakeBrowser } from '#imports';

// The Chrome the background's tests run against: WXT's fake browser, with the APIs it doesn't have (or has only in
// part) stubbed over a small list of windows and tabs. Each test builds its windows and tabs, then asks the background
// and looks at the calls it made to Chrome.

export interface World {
  windows: Browser.windows.Window[];
  tabs: Browser.tabs.Tab[];
  /** The active tab of the last focused window: where the user is. */
  currentTabId: number | undefined;
  /** Pages that keep extensions' scripts out (Chrome refuses scripting.executeScript there). */
  refusing: Set<number>;
  /** Pages where the switcher's script runs: injected, and not reloaded since. */
  injected: Set<number>;
  /** Pages that hang (a script that never ends): their messages and scripts never get an answer. */
  hung: Set<number>;
  /** The switcher's own window is open and its page listens. */
  windowListening: boolean;
  /** The messages the switcher received from the background, in order: in a page (tab id) or in its window (none). */
  received: { type: string; data: unknown; tabId: number | undefined }[];
}

export function newWorld(more: Partial<World> = {}): World {
  return {
    windows: [],
    tabs: [],
    currentTabId: undefined,
    refusing: new Set(),
    injected: new Set(),
    hung: new Set(),
    windowListening: false,
    received: [],
    ...more,
  };
}

/**
 * A message from the background reaches the switcher's script in a page (with a tab id) or the switcher's window
 * (without); like Chrome, sending fails when nobody listens there.
 */
export function deliverTo(world: World) {
  return async (type: string, data?: unknown, tabId?: number): Promise<void> => {
    if (tabId !== undefined && world.hung.has(tabId)) return new Promise<void>(() => undefined);
    const listens = tabId === undefined ? world.windowListening : world.injected.has(tabId);
    if (!listens) throw new Error('Could not establish connection. Receiving end does not exist.');
    world.received.push({ type, data, tabId });
  };
}

export function normalWindow(
  id: number,
  rect = { left: 0, top: 0, width: 1600, height: 1000 },
): Browser.windows.Window {
  return { id, type: 'normal', focused: false, incognito: false, alwaysOnTop: false, state: 'normal', ...rect };
}

export function tab(id: number, windowId: number, more: Partial<Browser.tabs.Tab> = {}): Browser.tabs.Tab {
  return {
    id,
    windowId,
    index: 0,
    url: `https://example.com/${id}`,
    title: `Tab ${id}`,
    active: false,
    highlighted: false,
    pinned: false,
    incognito: false,
    selected: false,
    discarded: false,
    frozen: false,
    autoDiscardable: true,
    groupId: -1,
    lastAccessed: id,
    ...more,
  } as Browser.tabs.Tab;
}

/** The switcher's own windows get ids from here. */
export const FIRST_POPUP_ID = 900;

export function fakeChrome(world: World) {
  let nextPopupId = FIRST_POPUP_ID;
  vi.spyOn(browser.tabs, 'query').mockImplementation((async (info: Browser.tabs.QueryInfo) => {
    if (info.active) return world.tabs.filter((t) => t.id === world.currentTabId);
    return [...world.tabs];
  }) as never);
  vi.spyOn(browser.tabs, 'get').mockImplementation((async (tabId: number) => {
    const found = world.tabs.find((t) => t.id === tabId);
    if (!found) throw new Error(`No tab with id: ${tabId}.`);
    return found;
  }) as never);
  vi.spyOn(browser.tabs, 'update').mockImplementation((async (tabId: number) =>
    world.tabs.find((t) => t.id === tabId)) as never);
  vi.spyOn(browser.tabs, 'remove').mockImplementation((async () => undefined) as never);
  vi.spyOn(browser.tabGroups, 'query').mockImplementation((async () => []) as never);
  vi.spyOn(browser.windows, 'getAll').mockImplementation((async (filter?: { windowTypes?: string[] }) =>
    world.windows.filter((w) => !filter?.windowTypes || filter.windowTypes.includes(w.type ?? 'normal'))) as never);
  vi.spyOn(browser.windows, 'get').mockImplementation((async (windowId: number) => {
    const found = world.windows.find((w) => w.id === windowId);
    if (!found) throw new Error(`No window with id: ${windowId}.`);
    return found;
  }) as never);
  // A new window opens with its page as its only tab, and with the focus when asked: the user is there.
  vi.spyOn(browser.windows, 'create').mockImplementation((async (data: Browser.windows.CreateData) => {
    const id = nextPopupId++;
    const created: Browser.windows.Window = {
      id,
      type: data.type as Browser.windows.Window['type'],
      focused: data.focused ?? false,
      incognito: false,
      alwaysOnTop: false,
      left: data.left,
      top: data.top,
      width: data.width,
      height: data.height,
    };
    world.windows.push(created);
    const page = tab(id * 10, id, { url: String(data.url) });
    world.tabs.push(page);
    if (data.focused) world.currentTabId = page.id;
    world.windowListening = true;
    return created;
  }) as never);
  vi.spyOn(browser.windows, 'update').mockImplementation((async (windowId: number) =>
    world.windows.find((w) => w.id === windowId)) as never);
  // Chrome tells the extension when one of its windows closes.
  vi.spyOn(browser.windows, 'remove').mockImplementation((async (windowId: number) => {
    const index = world.windows.findIndex((w) => w.id === windowId);
    if (index < 0) throw new Error(`No window with id: ${windowId}.`);
    world.windows.splice(index, 1);
    world.tabs = world.tabs.filter((t) => t.windowId !== windowId);
    if (windowId >= FIRST_POPUP_ID) world.windowListening = false;
    await fakeBrowser.windows.onRemoved.trigger(windowId);
  }) as never);
  vi.spyOn(browser.scripting, 'executeScript').mockImplementation((async (injection: { target: { tabId: number } }) => {
    const { tabId } = injection.target;
    if (world.hung.has(tabId)) return new Promise(() => undefined);
    if (world.refusing.has(tabId)) throw new Error('Cannot access contents of the page.');
    world.injected.add(tabId);
    return [];
  }) as never);
  vi.spyOn(browser.runtime, 'openOptionsPage').mockImplementation((async () => undefined) as never);
}

/**
 * Stands in for lib/messages.ts: the messages the background sends go to `receive` (deliverTo a world), and the handlers
 * it sets up are kept to be asked. Built in vi.hoisted, so that the background loaded again (a restart) uses it too.
 */
export function fakeMessages() {
  type Handler = (message: { data: unknown }) => unknown;
  const handlers = new Map<string, Handler>();
  const state = { receive: async (_type: string, _data?: unknown, _tabId?: number): Promise<void> => undefined };
  return {
    handlers,
    state,
    sendMessage: vi.fn((type: string, data?: unknown, tabId?: number) => state.receive(type, data, tabId)),
    onMessage: (type: string, handler: Handler) => {
      handlers.set(type, handler);
      return () => handlers.delete(type);
    },
    /** Asks the background as the switcher does. */
    ask(type: string, data?: unknown): unknown {
      const handler = handlers.get(type);
      if (!handler) throw new Error(`The background doesn't answer ${type}.`);
      return handler({ data });
    },
  };
}

/** Lets every pending promise of the background run to its end. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
