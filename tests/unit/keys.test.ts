import { describe, expect, it } from 'vitest';
import { isRelease, type Key, keyEvent } from '../../lib/keys/keys';

const up = (key: string, held: Partial<Key> = {}): Key => ({
  type: 'keyup',
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...held,
});
const down = (key: string): Key => ({ ...up(key), type: 'keydown' });

describe('isRelease', () => {
  it('is the release of Alt, Ctrl or Cmd when none of them is still held', () => {
    expect(isRelease(up('Alt'))).toBe(true);
    expect(isRelease(up('Control'))).toBe(true);
    expect(isRelease(up('Meta'))).toBe(true);
  });

  it('is not a release while another of them is still held (Ctrl+Alt+Y)', () => {
    expect(isRelease(up('Alt', { ctrlKey: true }))).toBe(false);
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
    const grid = { columns: 5, inField: false };
    expect(keyEvent(down('ArrowRight'), grid)).toEqual({ type: 'next' });
    expect(keyEvent(down('ArrowLeft'), grid)).toEqual({ type: 'previous' });
    expect(keyEvent(down('ArrowDown'), grid)).toEqual({ type: 'jump', by: 5 });
    expect(keyEvent(down('ArrowUp'), grid)).toEqual({ type: 'jump', by: -5 });
  });

  it('leaves left and right to the search field while it has the focus', () => {
    const grid = { columns: 5, inField: true };
    expect(keyEvent(down('ArrowRight'), grid)).toBeNull();
    expect(keyEvent(down('ArrowLeft'), grid)).toBeNull();
    expect(keyEvent(down('ArrowDown'), grid)).toEqual({ type: 'jump', by: 5 });
  });

  it('ignores the other keys, which stay for typing in the search field', () => {
    expect(keyEvent(down('a'))).toBeNull();
    expect(keyEvent(down('ArrowLeft'))).toBeNull();
    expect(keyEvent(up('Enter'))).toBeNull();
  });
});
