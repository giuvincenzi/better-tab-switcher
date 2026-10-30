import '../../styles/theme.css';
import './frame.css';
import { mountSwitcher, type SwitcherHandle } from '../../components/switcher/mountSwitcher';
import { onMessage, sendMessage } from '../../lib/messages';

// The switcher in a page: an extension page in a frame the page can't look into (the frame's holder,
// entrypoints/switcher.content.ts). Its tabs come only from the background, so the page never has them. The frame stays
// loaded, hidden, between two switchers: the next one shows at once.
let handle: SwitcherHandle | undefined;
/**
 * The switcher asked for and not drawn yet (showSwitcher), with what came for it meanwhile: given to it, in order,
 * once it is there.
 */
let coming: { draw: ReturnType<typeof setTimeout>; meanwhile: ((switcher: SwitcherHandle) => void)[] } | undefined;

/** The switcher is done, or replaced: it goes at once; the background hides the frame (hideFrame). */
function close() {
  if (coming) clearTimeout(coming.draw);
  coming = undefined;
  handle?.dispose();
  handle = undefined;
}

/** Gives the open switcher what came for it, or keeps it for the one being drawn. False when there is none. */
function toSwitcher(give: (switcher: SwitcherHandle) => void): boolean {
  if (handle) give(handle);
  else if (coming) coming.meanwhile.push(give);
  else return false;
  return true;
}

// Answered at once, drawn just after: the background's limit for an answer tells a page that hangs, and drawing
// hundreds of tabs on a slow machine took longer than it (the switcher went to its own window though the page was fine).
onMessage('showSwitcher', ({ data: snapshot }) => {
  close();
  const meanwhile: ((switcher: SwitcherHandle) => void)[] = [];
  coming = {
    meanwhile,
    draw: setTimeout(() => {
      coming = undefined;
      handle = mountSwitcher(document.body, snapshot, close);
      for (const give of meanwhile) give(handle);
    }),
  };
});
onMessage('moveSwitcher', ({ data: direction }) => {
  if (!toSwitcher((switcher) => switcher.move(direction))) throw new Error('No switcher is open in this page.');
});
onMessage('closeSwitcher', close);
onMessage('pressKey', ({ data: key }) => void toSwitcher((switcher) => switcher.pressKey(key)));
onMessage('previewReady', ({ data: preview }) => void toSwitcher((switcher) => switcher.showPreview(preview)));
onMessage('tabChanged', ({ data: text }) => void toSwitcher((switcher) => switcher.changeTab(text)));
onMessage('pictureTaken', () => void toSwitcher((switcher) => switcher.pictureTaken()));
// The frame lost the focus: to the page (a site can take it while it loads), to the browser's address bar, or to
// another window or program. The background asks the browser which (focusLeft).
addEventListener('blur', () => {
  if (handle) void sendMessage('focusLeft');
});
