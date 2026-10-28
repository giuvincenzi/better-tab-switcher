import { browser } from '#imports';
import type { Settings } from '../settings/settings';
import { loadSettings, watchSettings } from '../settings/store';
import { PICTURE_WIDTH } from '../switcher/sizes';
import { createCaptureQueue } from './queue';
import { shrinkPicture } from './shrink';
import { deleteAllPreviews, deletePreview, savePreview } from './store';

/** Chrome takes at most two pictures a second (captureVisibleTab). */
const CAPTURE_GAP_MS = 500;

/** The permission that lets the extension take a tab's picture whenever the tab is used, not only in the switcher. */
export const ALL_SITES = { origins: ['<all_urls>'] };

/** Pictures are taken only for the grid showing previews: the list and the grid of icons never show them. */
export function wantsPreviews(settings: Settings): boolean {
  return settings.view === 'grid' && settings.gridShow === 'previews';
}

export interface Previews {
  /**
   * Takes the current tab's picture as the switcher opens there (the shortcut or the toolbar icon gave the extension
   * that tab: activeTab). Resolves once Chrome has taken it, or couldn't: from then on the switcher can show without
   * being in the picture. The picture is made small and saved after that.
   */
  takeForSwitcher: (tab: { id: number; windowId: number }) => Promise<void>;
}

/**
 * Keeps a small picture of each tab in memory (lib/previews/store.ts), never blocking anything: a picture is taken
 * when the switcher opens and, with the permission for all sites, each time a tab is shown or has loaded. `onPreview`
 * gets each new picture, for a switcher already open.
 */
export function keepPreviews(onPreview: (tabId: number, picture: string) => void): Previews {
  const queue = createCaptureQueue(async ({ tabId, windowId }) => {
    const tab = await browser.tabs.get(tabId);
    // The picture is of the window's visible tab: only when it is still this one.
    if (!tab.active || tab.windowId !== windowId || !canTake(tab) || !(await wanted())) return;
    await keep(tabId, await browser.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 }));
  }, CAPTURE_GAP_MS);

  async function keep(tabId: number, picture: string) {
    const small = await shrinkPicture(picture, PICTURE_WIDTH);
    // Previews turned off, or the tab closed, while the picture was made small.
    if (!(await wanted()) || !(await browser.tabs.get(tabId).catch(() => undefined))) return;
    await savePreview(tabId, small);
    onPreview(tabId, small);
  }

  async function takeWhenAllowed(tab: { id?: number; windowId: number; active: boolean }) {
    if (tab.id === undefined || !tab.active || !(await wanted())) return;
    if (await browser.permissions.contains(ALL_SITES)) queue.request({ tabId: tab.id, windowId: tab.windowId });
  }

  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    void takeWhenAllowed({ id: tabId, windowId, active: true });
  });
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.status === 'complete') void takeWhenAllowed(tab);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    queue.forget(tabId);
    void deletePreview(tabId);
  });
  watchSettings((settings) => {
    if (settings.gridShow !== 'previews') void deleteAllPreviews();
  });

  return {
    takeForSwitcher(tab) {
      queue.forget(tab.id);
      const taking = browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
      void taking.then((picture) => keep(tab.id, picture)).catch(() => undefined);
      return taking.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}

async function wanted(): Promise<boolean> {
  return wantsPreviews(await loadSettings());
}

/** No pictures of incognito tabs, nor of the extension's own pages (the switcher's window). */
function canTake(tab: { incognito: boolean; url?: string }): boolean {
  return !tab.incognito && !tab.url?.startsWith(browser.runtime.getURL('/'));
}
