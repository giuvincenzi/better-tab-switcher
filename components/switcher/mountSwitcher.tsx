import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { applyLanguage } from '../../lib/i18n/language';
import { type Direction, type Preview, type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import { saveSettings } from '../../lib/settings/store';
import { applyTheme } from '../ui/applyTheme';
import { registerEmUnit } from '../ui/emUnit';
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
 * Shows the switcher in `container`, in the page or in its own window, and connects it to the background. It is drawn
 * in a modal dialog: the browser's top layer, above everything of the page, its own dialogs, popovers and full screen
 * elements too. `onDone` removes it once it is done; `onFrame` gets the panel's size (Switcher).
 */
export function mountSwitcher(
  container: HTMLElement,
  snapshot: SwitcherSnapshot,
  onDone: () => void,
  onFrame?: (size: { width: number; height: number }) => void,
): SwitcherHandle {
  registerEmUnit();
  const dialog = document.createElement('dialog');
  dialog.className = styles.dialog as string;
  dialog.classList.toggle(styles.ownWindow as string, snapshot.centeredOn !== undefined);
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
          void sendMessage('openTab', tab.id);
        }}
        onClose={() => {
          onDone();
          void sendMessage('switcherClosed');
        }}
        onCloseTab={(tab) => void sendMessage('closeTab', tab.id)}
        onSettingsChange={(change) => void saveSettings(change)}
        onSettings={() => {
          onDone();
          void sendMessage('openSettings');
        }}
        onFrame={onFrame}
      />
    ),
    dialog,
  );
  // The previews already taken (the grid can be chosen in the toolbar); a newer one that arrived meanwhile stays.
  void sendMessage(
    'getPreviews',
    snapshot.tabs.map((tab) => tab.id),
  ).then((saved) => setPreviews((arrived) => ({ ...saved, ...arrived })));
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
