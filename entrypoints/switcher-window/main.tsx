import '../../styles/theme.css';
import './switcher.css';
import { i18n } from '#i18n';
import { browser } from '#imports';
import { mountSwitcher } from '../../components/switcher/mountSwitcher';
import { applyTheme } from '../../components/ui/applyTheme';
import { onMessage, sendMessage } from '../../lib/messages';
import { centerOn, type Rect } from '../../lib/presenter/placement';

// The switcher in a window of its own, where Chrome keeps extensions out of the page (its own pages, the Chrome Web
// Store), with Use a window on Chrome's pages on. The background opens this window in the middle of the Chrome window the user is
// in, and closes it once a tab is chosen or the switcher is closed.
document.title = i18n.t('Extension_Name');
const snapshot = await sendMessage('getSnapshot');
const centeredOn = snapshot?.centeredOn;
if (snapshot && centeredOn) {
  applyTheme(document.documentElement, snapshot.settings.theme);
  const handle = mountSwitcher(
    document.body,
    snapshot,
    // Done: the switcher stays drawn until the background closes its window, so the window never shows empty.
    () => undefined,
    (size) => void fitWindow(centeredOn, size),
  );
  onMessage('moveSwitcher', ({ data: direction }) => handle.move(direction));
  onMessage('previewReady', ({ data: preview }) => handle.showPreview(preview));
  // Another window took the focus: the switcher closes, as a click outside it closes it in a page.
  window.addEventListener('blur', () => void sendMessage('switcherClosed'));
} else {
  window.close();
}

/** Makes the window as large as the switcher's panel, its frame added, in the middle of the Chrome window again. */
async function fitWindow(on: Rect, panel: { width: number; height: number }): Promise<void> {
  const size = {
    width: Math.ceil(panel.width) + window.outerWidth - window.innerWidth,
    height: Math.ceil(panel.height) + window.outerHeight - window.innerHeight,
  };
  await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, centerOn(on, size));
}
