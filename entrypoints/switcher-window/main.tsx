import '../../styles/theme.css';
import './switcher.css';
import { mountSwitcher } from '../../components/switcher/mountSwitcher';
import { onMessage, sendMessage } from '../../lib/messages';

// The switcher in a window of its own, where a page can't host it (Chrome's pages, the Chrome Web Store). The
// background opens this window and closes it once a tab is chosen or the switcher is closed.
const snapshot = await sendMessage('getSnapshot');
const container = document.getElementById('switcher');
if (snapshot && container) {
  const handle = mountSwitcher(container, document.documentElement, snapshot, true, () => handle.dispose());
  onMessage('moveSwitcher', ({ data: direction }) => handle.move(direction));
  // Another window took the focus: the switcher closes, as a click outside it would close it.
  window.addEventListener('blur', () => void sendMessage('switcherClosed'));
} else {
  window.close();
}
