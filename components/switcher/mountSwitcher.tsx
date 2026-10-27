import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { type Direction, type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import type { Theme } from '../../lib/settings/settings';
import { Switcher } from './Switcher';

export interface SwitcherHandle {
  /** The shortcut was pressed again. */
  move: (direction: Direction) => void;
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
  const dispose = render(
    () => (
      <Switcher
        snapshot={snapshot}
        moves={moves}
        canSeeRelease={canSeeRelease}
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
  return {
    move: (direction) => setMoves((last) => ({ direction, count: last.count + 1 })),
    dispose,
  };
}

/** The theme chosen in the settings; the device's theme needs nothing (styles/theme.css). */
function applyTheme(root: HTMLElement, theme: Theme) {
  if (theme === 'device') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
