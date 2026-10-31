import { describe, expect, it } from 'vitest';
import { isRelease, type Key, keyEvent } from '../../lib/keys/keys';

const up = (key: string, held: Partial<Key> = {}): Key => ({
  type: 'keyup',
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
  ...held,
});
const down = (key: string, more: Partial<Key> = {}): Key => ({ ...up(key), type: 'keydown', ...more });

describe('isRelease', () => {
  it('is the release of Alt, Ctrl or Cmd when none of them is still held', () => {
    expect(isRelease(up('Alt'))).toBe(true);
    expect(isRelease(up('Control'))).toBe(true);
    expect(isRelease(up('Meta'))).toBe(true);
  });

  it('is not a release while another of them is still held (Ctrl+Alt+S)', () => {
    expect(isRelease(up('Alt', { ctrlKey: true }))).toBe(false);
  });

  it('waits for the last of Alt, Ctrl and Cmd, whichever is still held', () => {
    expect(isRelease(up('Control', { metaKey: true }))).toBe(false);
    expect(isRelease(up('Meta', { altKey: true }))).toBe(false);
  });

  it('is not the release of Shift or of a letter', () => {
    expect(isRelease(up('Shift'))).toBe(false);
    expect(isRelease(up('y'))).toBe(false);
  });

  it('is never a key press', () => {
    expect(isRelease(down('Alt'))).toBe(false);
  });
});

describe('keyEvent', () => {
  it('moves with the arrows, opens with Enter, closes with Esc', () => {
    expect(keyEvent(down('ArrowDown'))).toEqual({ type: 'next' });
    expect(keyEvent(down('ArrowUp'))).toEqual({ type: 'previous' });
    expect(keyEvent(down('Enter'))).toEqual({ type: 'confirm' });
    expect(keyEvent(down('Escape'))).toEqual({ type: 'cancel' });
  });

  it('gives the release of Alt', () => {
    expect(keyEvent(up('Alt'))).toEqual({ type: 'release' });
  });

  it('in the grid, moves to the next tab with right and left, a row with down and up', () => {
    const grid = { columns: 5, inField: false, direction: 'ltr' } as const;
    expect(keyEvent(down('ArrowRight'), grid)).toEqual({ type: 'next' });
    expect(keyEvent(down('ArrowLeft'), grid)).toEqual({ type: 'previous' });
    expect(keyEvent(down('ArrowDown'), grid)).toEqual({ type: 'jump', by: 5 });
    expect(keyEvent(down('ArrowUp'), grid)).toEqual({ type: 'jump', by: -5 });
  });

  it('in a right-to-left grid, moves the way the arrow points: left to the next tab, right to the previous', () => {
    const grid = { columns: 5, inField: false, direction: 'rtl' } as const;
    expect(keyEvent(down('ArrowLeft'), grid)).toEqual({ type: 'next' });
    expect(keyEvent(down('ArrowRight'), grid)).toEqual({ type: 'previous' });
    expect(keyEvent(down('ArrowDown'), grid)).toEqual({ type: 'jump', by: 5 });
    expect(keyEvent(down('ArrowUp'), grid)).toEqual({ type: 'jump', by: -5 });
  });

  it('leaves left and right to the search field while it has the focus', () => {
    const grid = { columns: 5, inField: true, direction: 'ltr' } as const;
    expect(keyEvent(down('ArrowRight'), grid)).toBeNull();
    expect(keyEvent(down('ArrowLeft'), grid)).toBeNull();
    expect(keyEvent(down('ArrowDown'), grid)).toEqual({ type: 'jump', by: 5 });
  });

  it('leaves every key to the text being composed (Japanese, Chinese, Korean input): Enter, Esc and the arrows', () => {
    const composing = { isComposing: true };
    for (const key of ['Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
      expect(keyEvent(down(key, composing), { columns: 3, inField: true, direction: 'ltr' }), key).toBeNull();
    }
  });

  it('ignores the other keys, which stay for typing in the search field', () => {
    expect(keyEvent(down('a'))).toBeNull();
    expect(keyEvent(down('ArrowLeft'))).toBeNull();
    expect(keyEvent(up('Enter'))).toBeNull();
  });

  it('treats two columns already as a grid', () => {
    const grid = { columns: 2, inField: false, direction: 'ltr' } as const;
    expect(keyEvent(down('ArrowRight'), grid)).toEqual({ type: 'next' });
    expect(keyEvent(down('ArrowUp'), grid)).toEqual({ type: 'jump', by: -2 });
  });
});
