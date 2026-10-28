import type { SwitcherEvent } from '../switcher/machine';

/** What the switcher reads of a key press or release. */
export interface Key {
  /** "keydown" or "keyup". */
  type: string;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  /**
   * The key belongs to text being composed (Japanese, Chinese, Korean input): Enter, Esc and the arrows choose and
   * confirm the characters, they don't drive the switcher.
   */
  isComposing: boolean;
}

const MODIFIERS = new Set(['Alt', 'Control', 'Meta']);

/**
 * The release that opens the selected tab: the last of Alt, Ctrl and Cmd let go, whatever the shortcut is (the user
 * can change it in chrome://extensions/shortcuts). Shift doesn't count: Alt+Shift+Y goes back while Alt is held.
 */
export function isRelease(key: Key): boolean {
  return key.type === 'keyup' && MODIFIERS.has(key.key) && !key.altKey && !key.ctrlKey && !key.metaKey;
}

/** How the tabs are laid out, for the arrows. */
export interface Layout {
  /** Tabs per row: 1 for the list, the grid's columns for the grid. */
  columns: number;
  /** The search field has the focus: left and right move its cursor. */
  inField: boolean;
  /**
   * The direction the tabs are laid out in (the page's dir): right to left, the grid starts on the right, so the left
   * arrow goes to the next tab. The arrows always move the way they point.
   */
  direction: 'ltr' | 'rtl';
}

/**
 * The switcher's event for a key, or null when the switcher doesn't use it. The shortcut itself never gets here: Chrome
 * gives it to the extension, which tells the open switcher to go forward or back.
 */
export function keyEvent(
  key: Key,
  layout: Layout = { columns: 1, inField: false, direction: 'ltr' },
): SwitcherEvent | null {
  if (key.isComposing) return null;
  if (isRelease(key)) return { type: 'release' };
  if (key.type !== 'keydown') return null;
  const grid = layout.columns > 1;
  const forward = layout.direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  switch (key.key) {
    case 'ArrowDown':
      return grid ? { type: 'jump', by: layout.columns } : { type: 'next' };
    case 'ArrowUp':
      return grid ? { type: 'jump', by: -layout.columns } : { type: 'previous' };
    case 'ArrowRight':
    case 'ArrowLeft':
      return grid && !layout.inField ? { type: key.key === forward ? 'next' : 'previous' } : null;
    case 'Enter':
      return { type: 'confirm' };
    case 'Escape':
      return { type: 'cancel' };
    default:
      return null;
  }
}
