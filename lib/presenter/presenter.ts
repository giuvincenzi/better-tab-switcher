import { type Browser, browser, storage } from '#imports';
import { type Direction, onMessage, type SwitcherSnapshot, sendMessage } from '../messages';
import type { Settings } from '../settings/settings';
import { loadSettings } from '../settings/store';
import { readTabs } from '../tabs/chrome-tabs';
import { switcherTabs } from '../tabs/tabs';
import { canShowInPage, centerOn, type Rect } from './placement';

/** Where the open switcher is: in a page, or in its own window opened from a Chrome window. */
type OpenSwitcher =
  | { in: 'page'; tabId: number; fromWindowId: number }
  | { in: 'window'; windowId: number; fromWindowId: number };

const openSwitcher = storage.defineItem<OpenSwitcher | null>('session:openSwitcher', { fallback: null });
const windowSnapshot = storage.defineItem<SwitcherSnapshot | null>('session:windowSnapshot', { fallback: null });

/** The switcher's script, injected into a page only when it opens there. */
const SWITCHER_SCRIPT = '/content-scripts/switcher.js';
const SWITCHER_PAGE = '/switcher-window.html';

/** Opens the switcher, or moves its selection when it is already open (the shortcut pressed again). */
export async function showSwitcher(direction: Direction, fromClick: boolean): Promise<void> {
  const open = await openSwitcher.getValue();
  if (open && (await moveOpenSwitcher(open, direction))) return;
  await openSwitcher.setValue(null);

  const [current] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (current?.id === undefined) return;
  const snapshot = await takeSnapshot(current, direction, fromClick);
  if (canShowInPage(current.url) && (await showInPage(current.id, snapshot))) {
    await openSwitcher.setValue({ in: 'page', tabId: current.id, fromWindowId: current.windowId });
    return;
  }
  await showInWindow(current.windowId, snapshot);
}

/** Answers the switcher's messages. */
export function listenToSwitcher(): void {
  onMessage('getSnapshot', async () => {
    const snapshot = await windowSnapshot.getValue();
    await windowSnapshot.setValue(null);
    return snapshot;
  });
  onMessage('openTab', async ({ data: tab }) => {
    const open = await openSwitcher.getValue();
    await closeSwitcher(open);
    await browser.tabs.update(tab.id, { active: true });
    // Focusing a window that already has the focus can move the keyboard focus out of the page (macOS).
    if (open?.fromWindowId !== tab.windowId) await browser.windows.update(tab.windowId, { focused: true });
  });
  onMessage('closeTab', async ({ data: tabId }) => {
    await browser.tabs.remove(tabId);
  });
  onMessage('switcherClosed', async () => {
    await closeSwitcher(await openSwitcher.getValue());
  });
  onMessage('openSettings', async () => {
    await closeSwitcher(await openSwitcher.getValue());
    await browser.runtime.openOptionsPage();
  });
  browser.windows.onRemoved.addListener(async (windowId) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'window' && open.windowId === windowId) await openSwitcher.setValue(null);
  });
}

async function takeSnapshot(current: Browser.tabs.Tab, direction: Direction, fromClick: boolean) {
  const [settings, { tabs, windowIds }, commands] = await Promise.all([
    loadSettings(),
    readTabs(),
    browser.commands.getAll(),
  ]);
  const here = { tabId: current.id as number, windowId: current.windowId, incognito: current.incognito };
  const shortcut = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? '';
  return {
    tabs: switcherTabs(tabs, windowIds, here, settings),
    settings,
    direction,
    fromClick,
    shortcuts: { next: shortcut('next-tab'), previous: shortcut('previous-tab') },
  } satisfies SwitcherSnapshot;
}

async function moveOpenSwitcher(open: OpenSwitcher, direction: Direction): Promise<boolean> {
  try {
    if (open.in === 'page') await sendMessage('moveSwitcher', direction, open.tabId);
    else await sendMessage('moveSwitcher', direction);
    return true;
  } catch {
    return false;
  }
}

/** Shows the switcher in the page, injecting its script the first time. False when Chrome doesn't let it in. */
async function showInPage(tabId: number, snapshot: SwitcherSnapshot): Promise<boolean> {
  try {
    await sendMessage('showSwitcher', snapshot, tabId);
    return true;
  } catch {
    // Not injected yet in this page.
  }
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [SWITCHER_SCRIPT] });
    await sendMessage('showSwitcher', snapshot, tabId);
    return true;
  } catch {
    return false;
  }
}

async function showInWindow(fromWindowId: number, snapshot: SwitcherSnapshot): Promise<void> {
  await windowSnapshot.setValue(snapshot);
  const [from, displays] = await Promise.all([browser.windows.get(fromWindowId), browser.system.display.getInfo()]);
  const screens: Rect[] = displays.map((d) => d.workArea);
  const window: Rect = { left: from.left ?? 0, top: from.top ?? 0, width: from.width ?? 0, height: from.height ?? 0 };
  const bounds = centerOn(window, switcherWindowSize(snapshot.settings, snapshot.tabs.length), screens);
  const created = await browser.windows.create({
    url: browser.runtime.getURL(SWITCHER_PAGE),
    type: 'popup',
    focused: true,
    ...bounds,
  });
  if (created?.id !== undefined) await openSwitcher.setValue({ in: 'window', windowId: created.id, fromWindowId });
}

async function closeSwitcher(open: OpenSwitcher | null): Promise<void> {
  await openSwitcher.setValue(null);
  if (open?.in === 'window') {
    await browser.windows.remove(open.windowId).catch(() => undefined);
    await browser.windows.update(open.fromWindowId, { focused: true }).catch(() => undefined);
  }
}

/** The switcher's window: as big as the switcher it shows, plus the window's own title bar and border. */
function switcherWindowSize(settings: Settings, count: number) {
  const frame = { width: 16, height: 40 };
  const rows = settings.listRows === 'all' ? count : Math.min(settings.listRows, count);
  const row = settings.compact ? 38 : 50;
  const extra = (settings.search ? 52 : 0) + 48;
  return {
    width: (settings.compact ? 440 : 560) + frame.width,
    height: rows * row + extra + frame.height,
  };
}
