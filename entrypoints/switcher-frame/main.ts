import '../../styles/theme.css';
import './frame.css';
import { mountSwitcher, type SwitcherHandle } from '../../components/switcher/mountSwitcher';
import { onMessage } from '../../lib/messages';

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
onMessage('pictureTaken', () => handle?.pictureTaken());
