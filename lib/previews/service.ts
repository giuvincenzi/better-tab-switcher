import { browser } from '#imports';
import type { Settings } from '../settings/settings';
import { loadSettings, watchSettings } from '../settings/store';
import { PICTURE_WIDTH } from '../switcher/sizes';
import { shrinkPicture } from './shrink';
import { deleteAllPreviews, deletePreview, savePreview } from './store';

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
 * Keeps a small picture of each tab in memory (lib/previews/store.ts), taken when the switcher opens on it, never
 * blocking anything. `onPreview` gets each new picture, for the switcher already open.
 */
export function keepPreviews(onPreview: (tabId: number, picture: string) => void): Previews {
  async function keep(tabId: number, picture: string) {
    const small = await shrinkPicture(picture, PICTURE_WIDTH);
    // Previews turned off, or the tab closed, while the picture was made small.
    if (!wantsPreviews(await loadSettings()) || !(await browser.tabs.get(tabId).catch(() => undefined))) return;
    await savePreview(tabId, small);
    onPreview(tabId, small);
  }

  browser.tabs.onRemoved.addListener((tabId) => {
    void deletePreview(tabId);
  });
  watchSettings((settings) => {
    if (settings.gridShow !== 'previews') void deleteAllPreviews();
  });

  return {
    takeForSwitcher(tab) {
      const taking = browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
      void taking.then((picture) => keep(tab.id, picture)).catch(() => undefined);
      return taking.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
