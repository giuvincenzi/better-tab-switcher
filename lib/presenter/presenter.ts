import { type Browser, browser, storage } from '#imports';
import {
  type Direction,
  type FrameShown,
  onMessage,
  type Preview,
  type Resume,
  type SwitcherSnapshot,
  sendMessage,
  type TabText,
} from '../messages';
import { type Previews, wantsPreviews } from '../previews/service';
import { loadPreviews } from '../previews/store';
import { loadSettings } from '../settings/store';
import { firstWindowSize } from '../switcher/sizes';
import { readTabs, tabText } from '../tabs/chrome-tabs';
import { switcherTabs } from '../tabs/tabs';
import { canShowInPage, centerOn, type Rect } from './placement';

/** What asks for the switcher: the next or previous tab shortcut, or the toolbar icon. */
export interface SwitcherRequest {
  direction: Direction;
  from: 'shortcut' | 'icon';
  /** The switcher opening again as the user left it (closeTab). */
  resume?: Resume;
}

/**
 * The open switcher: the tab it is shown in, or its own window (on Chrome's pages), its tab and the window it came
 * from. The switcher is sent its messages in its tab (lib/messages.ts). The presenter is the only one that knows it; it
 * is kept in storage.session because Chrome can stop the background between two key presses.
 */
type OpenSwitcher =
  | { in: 'page'; tabId: number; windowId: number; windowFocused: boolean }
  | { in: 'window'; windowId: number; tabId: number; fromWindowId: number };

const openSwitcher = storage.defineItem<OpenSwitcher | null>('session:openSwitcher', { fallback: null });
/** The tabs for the switcher's window, until the window asks for them (getSnapshot). */
const windowSnapshot = storage.defineItem<SwitcherSnapshot | null>('session:windowSnapshot', { fallback: null });
/**
 * The tabs whose page has the frame's holder: put in by the background, and the tab hasn't loaded another page since.
 * There the switcher is shown with a message, and a page that doesn't answer it within PAGE_ANSWER_MS hangs. In any
 * other tab the holder is put in first, without asking the page: on a busy machine a page can take over a second even to
 * tell that nobody listens, and would be taken for one that hangs. In storage.session, cleared like the holders
 * themselves when the browser closes or the extension updates.
 */
const pagesWithHolder = storage.defineItem<number[]>('session:pagesWithHolder', { fallback: [] });

/** The holder of the switcher's frame, injected into a page only when the switcher opens there. */
const SWITCHER_SCRIPT = '/content-scripts/switcher.js';
/** The switcher's own window, where a page can't host it. */
const SWITCHER_WINDOW = '/switcher-window.html';

/**
 * The one way the switcher opens or moves, whatever asks for it:
 * - the shortcut, with the switcher open where the user is: its selection moves;
 * - anything else: a switcher open elsewhere closes, and a new one opens in the current tab.
 * Chrome lets no extension into its own pages nor the Chrome Web Store: there the switcher opens in a window of its
 * own (Open the switcher in a window on Chrome's pages, on by default), or nothing happens when the user turned that off.
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
  if (open) await answered(sendMessage('previewReady', preview, open.tabId)).catch(() => undefined);
}

/**
 * Answers the switcher's messages, and closes or forgets the switcher when its tab or its window goes away. `request`
 * opens a switcher (requestSwitcher, with the background's previews).
 */
export function listenToSwitcher(request: (switcher: SwitcherRequest) => Promise<void>): void {
  onMessage('getSnapshot', async () => {
    const snapshot = await windowSnapshot.getValue();
    await windowSnapshot.setValue(null);
    if (!snapshot) return null;
    // The tabs that had nothing to show as the switcher opened, as they are now (blankTabsNow).
    const now = new Map((await blankTabsNow(snapshot)).map((text) => [text.tabId, text]));
    return { ...snapshot, tabs: snapshot.tabs.map((tab) => ({ ...tab, ...now.get(tab.id) })) };
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
  onMessage('closeTab', async ({ data: { tabId, resume } }) => {
    const open = await openSwitcher.getValue();
    if (open?.in !== 'page' || open.tabId !== tabId) {
      await browser.tabs.remove(tabId);
      return;
    }
    // The tab the switcher is in: the switcher goes with its page. Forgotten first, so the tab the browser shows
    // instead closes nothing (tabs.onActivated); then it opens there, as the user left it.
    await openSwitcher.setValue(null);
    await browser.tabs.remove(tabId);
    await request({ direction: 'next', from: resume.fromIcon ? 'icon' : 'shortcut', resume });
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
  // A key the page got for the switcher in it, while its frame didn't have the focus.
  onMessage('keyInPage', async ({ data: key, sender }) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.tabId === sender.tab?.id)
      await answered(sendMessage('pressKey', key, open.tabId)).catch(() => undefined);
  });
  onMessage('getPreviews', ({ data: tabIds }) => loadPreviews(tabIds));
  onMessage('openSettings', async () => {
    await forget();
    await browser.runtime.openOptionsPage();
  });
  browser.tabs.onRemoved.addListener(async (tabId) => {
    await forgetHolder(tabId);
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.tabId === tabId) await openSwitcher.setValue(null);
  });
  browser.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (change.status === 'loading') await forgetHolder(tabId);
    // The open switcher shows the tab as it is now: a tab just made gets its address and title a moment later.
    if (change.title === undefined && change.url === undefined && change.status === undefined) return;
    const open = await openSwitcher.getValue();
    if (open)
      await answered(sendMessage('tabsChanged', [{ tabId, ...tabText(tab) }], open.tabId)).catch(() => undefined);
  });
  browser.windows.onRemoved.addListener(async (windowId) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'window' && open.windowId === windowId) await openSwitcher.setValue(null);
  });
  // The focus may have left the switcher's window: its frame or its page tells (focusLeft), and Chrome too
  // (windows.onFocusChanged), though not on every system (none on an X11 desktop without a window manager).
  onMessage('focusLeft', async ({ sender }) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.tabId === sender.tab?.id) await closeWhenWindowLeft(open);
  });
  browser.windows.onFocusChanged.addListener(async () => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page') await closeWhenWindowLeft(open);
  });
  // Another tab came to the front of the switcher's window (a click on it, Ctrl+Tab): the switcher closes, so it never
  // stays open where nobody sees it.
  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    const open = await openSwitcher.getValue();
    if (open?.in === 'page' && open.windowId === windowId && open.tabId !== tabId) await closeSwitcher(open);
  });
}

/**
 * The tabs of a switcher that had nothing to show as it opened (no address, no title: a tab just made, on macOS), as
 * Chrome gives them now. Chrome can fill them in between reading the tabs and the switcher being there to hear of it
 * (tabs.onUpdated): read again once it is, they never stay empty rows. Only those tabs: the switcher's opening never
 * waits for them.
 */
async function blankTabsNow(snapshot: SwitcherSnapshot): Promise<TabText[]> {
  const blank = snapshot.tabs.filter((tab) => !tab.title && !tab.url);
  const now = await Promise.all(blank.map((tab) => browser.tabs.get(tab.id).catch(() => undefined)));
  return now.flatMap((tab) => (tab?.id === undefined ? [] : [{ tabId: tab.id, ...tabText(tab) }]));
}

/**
 * Closes the switcher in a page when its window no longer has the focus: the user went to another window or program,
 * so it never waits where the user isn't, as its own window does (switcherLeft). The window keeps the focus when it
 * moved to its address bar, or to the page (a site can take it as it loads): the switcher stays.
 */
async function closeWhenWindowLeft(open: OpenSwitcher): Promise<void> {
  // Only a window that had the focus can lose it (a browser with no window on screen gives none the focus).
  if (open.in !== 'page' || !open.windowFocused) return;
  const window = await browser.windows.get(open.windowId).catch(() => undefined);
  if (window && !window.focused) await closeSwitcher(open);
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

/**
 * How long each step of putting the switcher into a page the first time can take: its frame's holder (the script), the
 * frame, then the switcher's first showing in the new frame (and the keys pressed meanwhile). The script took at most
 * 23 ms on GitHub's Linux, Windows and macOS machines, in Chromium and Microsoft Edge; a whole first opening with the
 * frame, at most 360 ms on a computer slowed down 6 times, but over 1 s once on a busy macOS machine, past
 * PAGE_ANSWER_MS. The limit is far above all of them, so a page that is only slow is never taken for one that hangs.
 */
export const FIRST_TIME_MS = 5000;

/** A page that doesn't answer: it hangs, or is paused. Says what it didn't answer, and the time it had. */
class NoAnswer extends Error {
  constructor(what: string, limitMs: number) {
    super(`The page did not answer ${what} within ${limitMs} ms.`);
  }
}

/**
 * What a page was sent, or NoAnswer when the page doesn't answer within the limit (PAGE_ANSWER_MS by default). `what`
 * names the message or script in the error.
 */
function answered<T>(sent: Promise<T>, limitMs = PAGE_ANSWER_MS, what = 'a message'): Promise<T> {
  return new Promise((resolve, reject) => {
    const late = setTimeout(() => reject(new NoAnswer(what, limitMs)), limitMs);
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
  return answered(sendMessage('moveSwitcher', direction, open.tabId)).then(
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
    ...(request.resume ? { resume: request.resume } : {}),
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
  // Whether its window has the focus as it opens: the switcher closes when the window loses it (closeWhenWindowLeft).
  const windowFocused = await browser.windows.get(current.windowId).then(
    (window) => window.focused,
    () => false,
  );
  await openSwitcher.setValue({ in: 'page', tabId, windowId: current.windowId, windowFocused });
  if (!(await sendSnapshot(tabId, { ...snapshot, waitForPicture: picture !== undefined }))) {
    await openSwitcher.setValue(null);
    return false;
  }
  // Not waited for: the switcher is there already.
  void blankTabsNow(snapshot).then((texts) => {
    if (texts.length > 0) answered(sendMessage('tabsChanged', texts, tabId)).catch(() => undefined);
  });
  if (picture) {
    await picture;
    await answered(sendMessage('pictureTaken', undefined, tabId)).catch(() => undefined);
  }
  return true;
}

/**
 * Shows the switcher's frame in the page and sends it the tabs, then the keys the page got meanwhile. False when Chrome
 * doesn't let it in, the page keeps scripts out of its frames, or the page doesn't answer: then the page is told to
 * hide what it may show once it answers again (it handles its messages in order), so no switcher shows late there.
 */
async function sendSnapshot(tabId: number, snapshot: SwitcherSnapshot): Promise<boolean> {
  try {
    const { canSeeRelease, keys, madeNow } = await showFrame(tabId);
    // In a frame just made, the switcher shows for the first time: it has the time of a first opening.
    const limitMs = madeNow ? FIRST_TIME_MS : PAGE_ANSWER_MS;
    await answered(sendMessage('showSwitcher', { ...snapshot, canSeeRelease }, tabId), limitMs, 'showSwitcher');
    for (const key of keys) await answered(sendMessage('pressKey', key, tabId), limitMs, 'pressKey');
    return true;
  } catch (error) {
    // Never quietly: why the switcher didn't show in the page, for whoever looks at the background's console. An
    // information, not a warning: nothing went wrong for the user, and the extension's Errors page stays clean.
    console.info(`The switcher couldn't show in the page of tab ${tabId}, so it opens in its own window:`, error);
    sendMessage('closeSwitcher', undefined, tabId).catch(() => undefined);
    sendMessage('hideFrame', undefined, tabId).catch(() => undefined);
    return false;
  }
}

/** A sandboxed page: it keeps scripts out of its frames, the switcher's too (showFrame). */
class Sandboxed extends Error {
  constructor() {
    super('The page is sandboxed: its frames run no script.');
  }
}

/** Shows the switcher's frame over the page, putting its holder in the page the first time. */
async function showFrame(tabId: number): Promise<FrameShown> {
  const show = async (limitMs: number) => {
    const shown = await answered(sendMessage('showFrame', undefined, tabId), limitMs, 'showFrame');
    if (!shown) throw new Sandboxed();
    return shown;
  };
  if ((await pagesWithHolder.getValue()).includes(tabId)) {
    try {
      return await show(PAGE_ANSWER_MS);
    } catch (error) {
      // The page hangs, or is sandboxed: nothing more is tried there. Otherwise its holder is gone, and is put in again.
      if (error instanceof NoAnswer || error instanceof Sandboxed) throw error;
    }
  }
  await answered(
    browser.scripting.executeScript({ target: { tabId }, files: [SWITCHER_SCRIPT] }),
    FIRST_TIME_MS,
    'the script of the frame',
  );
  const shown = await show(FIRST_TIME_MS);
  await pagesWithHolder.setValue([...new Set([...(await pagesWithHolder.getValue()), tabId])]);
  return shown;
}

/** The tab loads another page, or closes: its holder is gone with its page. */
async function forgetHolder(tabId: number): Promise<void> {
  const pages = await pagesWithHolder.getValue();
  if (pages.includes(tabId)) await pagesWithHolder.setValue(pages.filter((id) => id !== tabId));
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
  const tabId = created?.tabs?.[0]?.id;
  if (created?.id !== undefined && tabId !== undefined)
    await openSwitcher.setValue({ in: 'window', windowId: created.id, tabId, fromWindowId });
}

/**
 * The switcher is done (it is gone already): it is no longer open, and its frame hides, or its own window closes. The
 * frame hides while the background goes on: the tab chosen never waits for the page it was chosen in.
 */
async function forget(): Promise<OpenSwitcher | null> {
  const open = await openSwitcher.getValue();
  await openSwitcher.setValue(null);
  if (open?.in === 'page') void answered(sendMessage('hideFrame', undefined, open.tabId)).catch(() => undefined);
  else if (open) await browser.windows.remove(open.windowId).catch(() => undefined);
  return open;
}

/** Closes the open switcher, for a new one; in a page, it is gone already when the page closed or reloaded. */
async function closeSwitcher(open: OpenSwitcher): Promise<void> {
  await openSwitcher.setValue(null);
  if (open.in === 'page')
    await Promise.all(
      (['closeSwitcher', 'hideFrame'] as const).map((type) =>
        answered(sendMessage(type, undefined, open.tabId)).catch(() => undefined),
      ),
    );
  else await browser.windows.remove(open.windowId).catch(() => undefined);
}
