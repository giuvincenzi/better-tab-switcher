import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { type Direction, type Preview, type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import type { Theme } from '../../lib/settings/settings';
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
 * Shows the switcher in `container` and connects it to the background; the same in a page and in the switcher's
 * window. `themeRoot` gets the theme chosen in the settings; `onDone` removes the switcher once it is done.
 */
export function mountSwitcher(
  container: HTMLElement,
  themeRoot: HTMLElement,
  snapshot: SwitcherSnapshot,
  canSeeRelease: boolean,
  onDone: () => void,
): SwitcherHandle {
  applyTheme(themeRoot, snapshot.settings.theme);
  const [moves, setMoves] = createSignal({ direction: snapshot.direction, count: 0 });
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const [pictureTaken, setPictureTaken] = createSignal(false);
  const dispose = render(
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
    container,
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
    dispose,
  };
}

/** The theme chosen in the settings (styles/theme.css). */
function applyTheme(root: HTMLElement, theme: Theme) {
  root.dataset.theme = theme;
}
