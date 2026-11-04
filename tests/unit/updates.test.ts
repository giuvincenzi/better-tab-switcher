import { describe, expect, it, vi } from 'vitest';
import { checkForUpdate } from '../../lib/updates';

// The browser's answer to a check, as its documentation gives it (runtime.requestUpdateCheck): a real store can't be
// reached by the tests, so the answers are given here.
describe('checking for a new version', () => {
  it('says what the browser found: up to date, a new version, or that it checked a moment ago', async () => {
    expect(await checkForUpdate(async () => ({ status: 'no_update' }))).toEqual({ kind: 'current' });
    expect(await checkForUpdate(async () => ({ status: 'update_available', version: '1.3.0' }))).toEqual({
      kind: 'ready',
      version: '1.3.0',
    });
    expect(await checkForUpdate(async () => ({ status: 'update_available' }))).toEqual({ kind: 'ready' });
    expect(await checkForUpdate(async () => ({ status: 'throttled' }))).toEqual({ kind: 'later' });
  });

  it('says the check failed, and why in the console, when the browser refuses it or answers something else', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(
      await checkForUpdate(async () => {
        throw new Error('no store');
      }),
    ).toEqual({ kind: 'failed' });
    expect(await checkForUpdate(async () => ({ status: 'something_new' }))).toEqual({ kind: 'failed' });
    expect(info).toHaveBeenCalledTimes(2);
    info.mockRestore();
  });
});
