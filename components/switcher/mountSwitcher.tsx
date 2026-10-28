import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { applyLanguage } from '../../lib/i18n/direction';
import { type Direction, type Preview, type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import { applyTheme } from '../ui/applyTheme';
import styles from './mountSwitcher.module.css';
import { Switcher } from './Switcher';

export interface SwitcherHandle {
  /** The shortcut was pressed again. */
  move: (direction: Direction) => void;
  /** A tab's new preview. */
  showPreview: (preview: Preview) => void;
  /** The page's picture is taken: the switcher can show. */
  pictureTaken: () => void;
  dispose: () => void;
}

/**
 * Shows the switcher in `container`, in the page, and connects it to the background. It is drawn in a modal dialog:
 * the browser's top layer, above everything of the page, its own dialogs, popovers and full screen elements too.
 * `onDone` removes it once it is done.
 */
export function mountSwitcher(container: HTMLElement, snapshot: SwitcherSnapshot, onDone: () => void): SwitcherHandle {
  const dialog = document.createElement('dialog');
  dialog.className = styles.dialog as string;
  // The dialog takes the focus itself, not the first control in it (the search field stays as it is).
  dialog.autofocus = true;
  applyTheme(dialog, snapshot.settings.theme);
  applyLanguage(dialog);
  // Esc is the switcher's own key (it closes it as a click outside does), never the dialog's.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  container.append(dialog);
  const canSeeRelease = document.hasFocus();
  dialog.showModal();

  const [moves, setMoves] = createSignal({ direction: snapshot.direction, count: 0 });
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const [pictureTaken, setPictureTaken] = createSignal(false);

  const disposeRender = render(
    () => (
      <Switcher
        snapshot={snapshot}
        moves={moves}
        canSeeRelease={canSeeRelease}
        previews={previews}
        pictureTaken={pictureTaken}
        onOpen={(tab) => {
          onDone();
          void sendMessage('openTab', { id: tab.id, windowId: tab.windowId });
        }}
        onClose={() => {
          onDone();
          void sendMessage('switcherClosed');
        }}
        onCloseTab={(tab) => void sendMessage('closeTab', tab.id)}
        onSettings={() => {
          onDone();
          void sendMessage('openSettings');
        }}
      />
    ),
    dialog,
  );
  // The previews already taken; a newer one that arrived meanwhile stays.
  if (snapshot.settings.view === 'grid' && snapshot.settings.previews) {
    void sendMessage(
      'getPreviews',
      snapshot.tabs.map((tab) => tab.id),
    ).then((saved) => setPreviews((arrived) => ({ ...saved, ...arrived })));
  }
  return {
    move: (direction) => setMoves((last) => ({ direction, count: last.count + 1 })),
    showPreview: ({ tabId, picture }) => setPreviews((all) => ({ ...all, [tabId]: picture })),
    pictureTaken: () => setPictureTaken(true),
    dispose() {
      disposeRender();
      dialog.close();
      dialog.remove();
    },
  };
}
