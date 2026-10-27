import type { SwitcherEvent } from '../switcher/machine';

/** What the switcher reads of a key press or release. */
export interface Key {
  /** "keydown" or "keyup". */
  type: string;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

const MODIFIERS = new Set(['Alt', 'Control', 'Meta']);

/**
 * The release that opens the selected tab: the last of Alt, Ctrl and Cmd let go, whatever the shortcut is (the user
 * can change it in chrome://extensions/shortcuts). Shift doesn't count: Alt+Shift+Y goes back while Alt is held.
 */
export function isRelease(key: Key): boolean {
  return key.type === 'keyup' && MODIFIERS.has(key.key) && !key.altKey && !key.ctrlKey && !key.metaKey;
}

/**
 * The switcher's event for a key, or null when the switcher doesn't use it. The shortcut itself never gets here: Chrome
 * gives it to the extension, which tells the open switcher to go forward or back.
 */
export function keyEvent(key: Key): SwitcherEvent | null {
  if (isRelease(key)) return { type: 'release' };
  if (key.type !== 'keydown') return null;
  switch (key.key) {
    case 'ArrowDown':
      return { type: 'next' };
    case 'ArrowUp':
      return { type: 'previous' };
    case 'Enter':
      return { type: 'confirm' };
    case 'Escape':
      return { type: 'cancel' };
    default:
      return null;
  }
}
