import '../../styles/theme.css';
import './frame.css';
import { mountSwitcher, type SwitcherHandle } from '../../components/switcher/mountSwitcher';
import { onMessage, sendMessage } from '../../lib/messages';

// The switcher in a page: an extension page in a frame the page can't look into (the frame's holder,
// entrypoints/switcher.content.ts). Its tabs come only from the background, so the page never has them. The frame stays
// loaded, hidden, between two switchers: the next one shows at once.
let handle: SwitcherHandle | undefined;

/** The switcher is done, or replaced: it goes at once; the background hides the frame (hideFrame). */
function close() {
  handle?.dispose();
  handle = undefined;
}

onMessage('showSwitcher', ({ data: snapshot }) => {
  close();
  handle = mountSwitcher(document.body, snapshot, close);
});
onMessage('moveSwitcher', ({ data: direction }) => {
  if (!handle) throw new Error('No switcher is open in this page.');
  handle.move(direction);
});
onMessage('closeSwitcher', close);
onMessage('pressKey', ({ data: key }) => handle?.pressKey(key));
onMessage('previewReady', ({ data: preview }) => handle?.showPreview(preview));
onMessage('tabChanged', ({ data: text }) => handle?.changeTab(text));
onMessage('pictureTaken', () => handle?.pictureTaken());
// The frame lost the focus: to the page (a site can take it while it loads), to the browser's address bar, or to
// another window or program. The background asks the browser which (focusLeft).
addEventListener('blur', () => {
  if (handle) void sendMessage('focusLeft');
});
