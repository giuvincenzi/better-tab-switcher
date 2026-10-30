import '../../styles/theme.css';
import './switcher.css';
import { i18n } from '#i18n';
import { browser } from '#imports';
import { mountSwitcher } from '../../components/switcher/mountSwitcher';
import { applyTheme } from '../../components/ui/applyTheme';
import { onMessage, sendMessage } from '../../lib/messages';
import { centerOn, type Rect } from '../../lib/presenter/placement';

// The switcher in a window of its own, where a page can't hold it (Chrome's own pages, the Chrome Web Store, a page
// that keeps scripts out of its frames), with Open the switcher in a window on Chrome's pages on. The background opens
// this window in the middle of the Chrome window the user is in, and closes it once a tab is chosen or closed.
document.title = i18n.t('Extension_Name');
const snapshot = await sendMessage('getSnapshot');
const centeredOn = snapshot?.centeredOn;
if (snapshot && centeredOn) {
  applyTheme(document.documentElement, snapshot.settings.theme);
  // Chrome's zoom of this page (the extension's pages, or Chrome's default zoom): the page measures in pixels of the
  // zoom, the windows are placed in pixels of the screen.
  const zoom = await browser.tabs.getZoom();
  const handle = mountSwitcher(
    document.body,
    // The Chrome window the switcher takes its sizes from, in this page's pixels.
    { ...snapshot, centeredOn: { ...centeredOn, width: centeredOn.width / zoom, height: centeredOn.height / zoom } },
    // Done: the switcher stays drawn until the background closes its window, so the window never shows empty.
    () => undefined,
    (size) => void fitWindow(centeredOn, size, zoom),
  );
  onMessage('moveSwitcher', ({ data: direction }) => handle.move(direction));
  onMessage('previewReady', ({ data: preview }) => handle.showPreview(preview));
  onMessage('tabsListed', ({ data: tabs }) => handle.listTabs(tabs));
  // Another window took the focus: the switcher closes, as a click outside it closes it in a page, and the focus stays
  // where the user went.
  window.addEventListener('blur', () => void sendMessage('switcherLeft'));
} else {
  window.close();
}

/**
 * Makes the window as large as the switcher's panel (in this page's pixels, `zoom` times smaller than the screen's), its
 * frame added, in the middle of the Chrome window again.
 */
async function fitWindow(on: Rect, panel: { width: number; height: number }, zoom: number): Promise<void> {
  const size = {
    width: Math.ceil(panel.width * zoom) + window.outerWidth - Math.round(window.innerWidth * zoom),
    height: Math.ceil(panel.height * zoom) + window.outerHeight - Math.round(window.innerHeight * zoom),
  };
  await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, centerOn(on, size));
}
