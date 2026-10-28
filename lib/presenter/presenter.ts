import { type Browser, browser, storage } from '#imports';
import { type Direction, onMessage, type Preview, type SwitcherSnapshot, sendMessage } from '../messages';
import { type Previews, wantsPreviews } from '../previews/service';
import { loadPreviews } from '../previews/store';
import { loadSettings } from '../settings/store';
import { firstWindowSize } from '../switcher/sizes';
import { readTabs } from '../tabs/chrome-tabs';
import { switcherTabs } from '../tabs/tabs';
import { canShowInPage, centerOn, type Rect } from './placement';

/** What asks for the switcher: the next or previous tab shortcut, or the toolbar icon. */
export interface SwitcherRequest {
  direction: Direction;
  from: 'shortcut' | 'icon';
}

/**
 * The open switcher: the tab it is shown in, or its own window (on Chrome's pages) and the window it came from. The
 * presenter is the only one that knows it; it is kept in storage.session because Chrome can stop the background
 * between two key presses.
 */
type OpenSwitcher =
  | { in: 'page'; tabId: number; windowId: number }
  | { in: 'window'; windowId: number; fromWindowId: number };

const openSwitcher = storage.defineItem<OpenSwitcher | null>('session:openSwitcher', { fallback: null });
/** The tabs for the switcher's window, until the window asks for them (getSnapshot). */
const windowSnapshot = storage.defineItem<SwitcherSnapshot | null>('session:windowSnapshot', { fallback: null });

/** The switcher's script, injected into a page only when it opens there. */
const SWITCHER_SCRIPT = '/content-scripts/switcher.js';
/** The switcher's own window, where a page can't host it. */
const SWITCHER_WINDOW = '/switcher-window.html';

/**
 * The one way the switcher opens or moves, whatever asks for it:
 * - the shortcut, with the switcher open where the user is: its selection moves;
 * - anything else: a switcher open elsewhere closes, and a new one opens in the current tab.
 * Chrome lets no extension into its own pages nor the Chrome Web Store: there the switcher opens in a window of its
 * own (Use a window on Chrome's pages, on by default), or nothing happens when the user turned that off.
 * The requests are handled one after the other, in the order they come: two at once (the shortcut pressed twice
 * quickly) would both find no switcher open and both open one.
 */
export function requestSwitcher(request: SwitcherRequest, previews: Previews): Promise<void> {
  const handled = lastRequest.then(() => handleRequest(request, previews));
  lastRequest = handled.catch(() => undefined);
  return handled;
}

/** The request being handled, or the last one: the next request waits for it. */
let lastRequest: Promise<void> = Promise.resolve();

async function handleRequest(request: SwitcherRequest, previews: Previews): Promise<void> {
  const [[current], open] = await Promise.all([
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
    openSwitcher.getValue(),
  ]);
  if (open && request.from === 'shortcut' && isWhereTheUserIs(open, current) && (await move(open, request.direction)))
    return;
  if (open) await closeSwitcher(open);
  if (current?.id === undefined) return;

  const snapshot = await takeSnapshot(current, request);
  if (canShowInPage(current.url) && (await showInPage(current, snapshot, previews))) return;
  if (snapshot.settings.chromePagesWindow) await showInWindow(current.windowId, snapshot);
}

/** Gives a tab's new preview to the open switcher, if there is one. */
export async function showPreview(tabId: number, picture: string): Promise<void> {
  const open = await openSwitcher.getValue();
  const preview: Preview = { tabId, picture };
  if (open?.in === 'page') await sendMessage('previewReady', preview, open.tabId).catch(() => undefined);
  else if (open) await sendMessage('previewReady', preview).catch(() => undefined);
}

/** Answers the switcher's messages, and closes or forgets the switcher when its tab or its window goes away. */
export function listenToSwitcher(): void {
  onMessage('getSnapshot', async () => {
    const snapshot = await windowSnapshot.getValue();
    await windowSnapshot.setValue(null);
    return snapshot;
  });
  onMessage('openTab', async ({ data: tabId }) => {
    const open = await forget();
    // The tab as it is now: it may have moved to another window, or closed, while the switcher was open.
    const now = await browser.tabs.get(tabId).catch(() => undefined);
    if (!now) return;
    await browser.tabs.update(tabId, { active: true });
    // Focusing a window that already has the focus can move the keyboard focus out of the page (macOS).
    if (open?.windowId !== now.windowId) await browser.windows.update(now.windowId, { focused: true });
  });
  onMessage('closeTab', async ({ data: tabId }) => {
    await browser.tabs.remove(tabId);
  });
  onMessage('switcherClosed', async () => {
    const open = await forget();
    if (open?.in === 'window')
      await browser.windows.update(open.fromWindowId, { focused: true }).catch(() => undefined);
  });
  // The user went to another window (or another program): the focus stays there.
  onMessage('switcherLeft', async () => {
    await forget();
  });
  onMessage('getPreviews', ({ data: tabIds }) => loadPreviews(tabIds));
  onMessage('openSettings', async () => {
    await forget();
    await browser.runtime.openOptionsPage();
  });
  browser.tabs.onRemoved.addListener(async (tabId) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.tabId === tabId) await openSwitcher.setValue(null);
  });
  browser.windows.onRemoved.addListener(async (windowId) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'window' && open.windowId === windowId) await openSwitcher.setValue(null);
  });
  // Another tab came to the front of the switcher's window (a click on it, Ctrl+Tab): the switcher closes, so it never
  // stays open where nobody sees it.
  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.windowId === windowId && open.tabId !== tabId) await closeSwitcher(open);
  });
}

/** The switcher is open in the current tab, or it is its own window and that window has the focus. */
function isWhereTheUserIs(open: OpenSwitcher, current: Browser.tabs.Tab | undefined): boolean {
  return open.in === 'page' ? open.tabId === current?.id : open.windowId === current?.windowId;
}

/**
 * How long a page has to answer the switcher's messages. A page that doesn't (a script that never ends, a page paused)
 * is a page the switcher can't show in: the requests never wait for it, and those after it are not held up.
 */
export const PAGE_ANSWER_MS = 1000;

/** What a page was sent, or a failure when the page doesn't answer in PAGE_ANSWER_MS. */
function answered<T>(sent: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const late = setTimeout(() => reject(new Error('The page did not answer.')), PAGE_ANSWER_MS);
    sent.then(
      (value) => {
        clearTimeout(late);
        resolve(value);
      },
      (error) => {
        clearTimeout(late);
        reject(error);
      },
    );
  });
}

/** Moves the open switcher's selection. False when it is not there any more (its page closed, reloaded or hangs). */
function move(open: OpenSwitcher, direction: Direction): Promise<boolean> {
  const sent =
    open.in === 'page'
      ? answered(sendMessage('moveSwitcher', direction, open.tabId))
      : sendMessage('moveSwitcher', direction);
  return sent.then(
    () => true,
    () => false,
  );
}

async function takeSnapshot(current: Browser.tabs.Tab, request: SwitcherRequest): Promise<SwitcherSnapshot> {
  const [settings, { tabs, windowIds, currentWindowId }] = await Promise.all([loadSettings(), readTabs(current)]);
  // A popup's tab counts in its home window (readTabs).
  const here = {
    tabId: current.id as number,
    windowId: currentWindowId ?? current.windowId,
    incognito: current.incognito,
  };
  return {
    tabs: switcherTabs(tabs, windowIds, here, settings),
    settings,
    direction: request.direction,
    fromIcon: request.from === 'icon',
    waitForPicture: false,
  };
}

/** Shows the switcher in the current tab's page. False when Chrome doesn't let it in. */
async function showInPage(current: Browser.tabs.Tab, snapshot: SwitcherSnapshot, previews: Previews): Promise<boolean> {
  const tabId = current.id as number;
  // The page's picture is taken first: the switcher, shown in the page, would be in it.
  const picture =
    wantsPreviews(snapshot.settings) && !current.incognito
      ? previews.takeForSwitcher({ id: tabId, windowId: current.windowId })
      : undefined;
  // Known before the switcher shows: a preview that arrives meanwhile goes to it.
  await openSwitcher.setValue({ in: 'page', tabId, windowId: current.windowId });
  if (!(await sendSnapshot(tabId, { ...snapshot, waitForPicture: picture !== undefined }))) {
    await openSwitcher.setValue(null);
    return false;
  }
  if (picture) {
    await picture;
    await answered(sendMessage('pictureTaken', undefined, tabId)).catch(() => undefined);
  }
  return true;
}

/**
 * Sends the tabs to the page's switcher, injecting its script the first time. False when Chrome doesn't let it in or
 * the page doesn't answer: then the page is told to close what it may show once it answers again (it handles its
 * messages in order), so no switcher shows late there.
 */
async function sendSnapshot(tabId: number, snapshot: SwitcherSnapshot): Promise<boolean> {
  const show = () => answered(sendMessage('showSwitcher', snapshot, tabId));
  try {
    await show();
    return true;
  } catch {
    // Not injected yet in this page, or the page doesn't answer.
  }
  try {
    await answered(browser.scripting.executeScript({ target: { tabId }, files: [SWITCHER_SCRIPT] }));
    await show();
    return true;
  } catch {
    sendMessage('closeSwitcher', undefined, tabId).catch(() => undefined);
    return false;
  }
}

/**
 * Opens the switcher's own window in the middle of the window the user is in, about the switcher's size: the switcher
 * fits it to its exact size once it has measured itself (entrypoints/switcher-window).
 */
async function showInWindow(fromWindowId: number, snapshot: SwitcherSnapshot): Promise<void> {
  const from = await browser.windows.get(fromWindowId);
  const centeredOn: Rect = {
    left: from.left ?? 0,
    top: from.top ?? 0,
    width: from.width ?? 0,
    height: from.height ?? 0,
  };
  await windowSnapshot.setValue({ ...snapshot, centeredOn });
  const created = await browser.windows.create({
    url: browser.runtime.getURL(SWITCHER_WINDOW),
    type: 'popup',
    focused: true,
    ...centerOn(centeredOn, firstWindowSize(snapshot.settings, snapshot.tabs.length, centeredOn)),
  });
  if (created?.id !== undefined) await openSwitcher.setValue({ in: 'window', windowId: created.id, fromWindowId });
}

/** The switcher is done: it is no longer open, and its own window, if it has one, closes. */
async function forget(): Promise<OpenSwitcher | null> {
  const open = await openSwitcher.getValue();
  await openSwitcher.setValue(null);
  if (open?.in === 'window') await browser.windows.remove(open.windowId).catch(() => undefined);
  return open;
}

/** Closes the open switcher, for a new one; in a page, it is gone already when the page closed or reloaded. */
async function closeSwitcher(open: OpenSwitcher): Promise<void> {
  await openSwitcher.setValue(null);
  if (open.in === 'page') await answered(sendMessage('closeSwitcher', undefined, open.tabId)).catch(() => undefined);
  else await browser.windows.remove(open.windowId).catch(() => undefined);
}
