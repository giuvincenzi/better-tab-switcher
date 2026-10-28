import { type Browser, browser, storage } from '#imports';
import { type Direction, onMessage, type Preview, type SwitcherSnapshot, sendMessage } from '../messages';
import { type Previews, wantsPreviews } from '../previews/service';
import { loadPreviews } from '../previews/store';
import { loadSettings } from '../settings/store';
import { readTabs } from '../tabs/chrome-tabs';
import { switcherTabs } from '../tabs/tabs';
import { canShowInPage } from './placement';

/** What asks for the switcher: the next or previous tab shortcut, or the toolbar icon. */
export interface SwitcherRequest {
  direction: Direction;
  from: 'shortcut' | 'icon';
}

/**
 * The open switcher: the tab it is shown in. The presenter is the only one that knows it; it is kept in
 * storage.session because Chrome can stop the background between two key presses.
 */
interface OpenSwitcher {
  tabId: number;
  windowId: number;
}

const openSwitcher = storage.defineItem<OpenSwitcher | null>('session:openSwitcher', { fallback: null });

/** The switcher's script, injected into a page only when it opens there. */
const SWITCHER_SCRIPT = '/content-scripts/switcher.js';

/**
 * The one way the switcher opens or moves, whatever asks for it:
 * - the shortcut, with the switcher open in the current tab: its selection moves;
 * - anything else: a switcher open elsewhere closes, and a new one opens in the current tab.
 * Chrome lets no extension into its own pages nor the Chrome Web Store: there nothing happens.
 */
export async function requestSwitcher(request: SwitcherRequest, previews: Previews): Promise<void> {
  const [[current], open] = await Promise.all([
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
    openSwitcher.getValue(),
  ]);
  if (open && request.from === 'shortcut' && open.tabId === current?.id) {
    if (
      await sendMessage('moveSwitcher', request.direction, open.tabId).then(
        () => true,
        () => false,
      )
    )
      return;
  }
  if (open) await closeSwitcher(open);
  if (current?.id === undefined || !canShowInPage(current.url)) return;

  const tabId = current.id;
  const snapshot = await takeSnapshot(current, request);
  // The page's picture is taken first: the switcher, shown in the page, would be in it.
  const picture =
    wantsPreviews(snapshot.settings) && !current.incognito
      ? previews.takeForSwitcher({ id: tabId, windowId: current.windowId })
      : undefined;
  // Known before the switcher shows: a preview that arrives meanwhile goes to it.
  await openSwitcher.setValue({ tabId, windowId: current.windowId });
  if (!(await showInPage(tabId, { ...snapshot, waitForPicture: picture !== undefined }))) {
    await openSwitcher.setValue(null);
    return;
  }
  if (picture) {
    await picture;
    await sendMessage('pictureTaken', undefined, tabId).catch(() => undefined);
  }
}

/** Gives a tab's new preview to the open switcher, if there is one. */
export async function showPreview(tabId: number, picture: string): Promise<void> {
  const open = await openSwitcher.getValue();
  const preview: Preview = { tabId, picture };
  if (open) await sendMessage('previewReady', preview, open.tabId).catch(() => undefined);
}

/** Answers the switcher's messages, and closes or forgets the switcher when its tab goes away. */
export function listenToSwitcher(): void {
  onMessage('openTab', async ({ data: tab }) => {
    const open = await openSwitcher.getValue();
    await openSwitcher.setValue(null);
    await browser.tabs.update(tab.id, { active: true });
    // Focusing a window that already has the focus can move the keyboard focus out of the page (macOS).
    if (open?.windowId !== tab.windowId) await browser.windows.update(tab.windowId, { focused: true });
  });
  onMessage('closeTab', async ({ data: tabId }) => {
    await browser.tabs.remove(tabId);
  });
  onMessage('switcherClosed', async () => {
    await openSwitcher.setValue(null);
  });
  onMessage('getPreviews', ({ data: tabIds }) => loadPreviews(tabIds));
  onMessage('openSettings', async () => {
    await openSwitcher.setValue(null);
    await browser.runtime.openOptionsPage();
  });
  browser.tabs.onRemoved.addListener(async (tabId) => {
    if ((await openSwitcher.getValue())?.tabId === tabId) await openSwitcher.setValue(null);
  });
  // Another tab came to the front of the switcher's window (a click on it, Ctrl+Tab): the switcher closes, so it never
  // stays open where nobody sees it.
  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    const open = await openSwitcher.getValue();
    if (open && open.windowId === windowId && open.tabId !== tabId) await closeSwitcher(open);
  });
}

async function takeSnapshot(current: Browser.tabs.Tab, request: SwitcherRequest): Promise<SwitcherSnapshot> {
  const [settings, { tabs, windowIds }] = await Promise.all([loadSettings(), readTabs()]);
  const here = { tabId: current.id as number, windowId: current.windowId, incognito: current.incognito };
  return {
    tabs: switcherTabs(tabs, windowIds, here, settings),
    settings,
    direction: request.direction,
    fromIcon: request.from === 'icon',
    waitForPicture: false,
  };
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

/** Closes the open switcher; it is gone already when its page closed or reloaded. */
async function closeSwitcher(open: OpenSwitcher): Promise<void> {
  await openSwitcher.setValue(null);
  await sendMessage('closeSwitcher', undefined, open.tabId).catch(() => undefined);
}
