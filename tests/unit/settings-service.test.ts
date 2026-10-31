import { describe, expect, it } from 'vitest';
import { inTurn } from '../../lib/settings/service';

// The background's writes of the settings, one after the other (lib/settings/service.ts). Two pages saving at the same
// moment on the real browser: tests/e2e/settings.spec.ts.

/** Lets the promises already settled run their callbacks. */
const settled = () => new Promise((resolve) => setTimeout(resolve));

/** A write that ends when the test says so, noting in `log` when it starts and ends. */
function heldWrite(name: string, log: string[]) {
  let end: (fail: boolean) => void = () => {};
  const write = () =>
    new Promise<string>((resolve, reject) => {
      log.push(`${name} started`);
      end = (fail) => {
        log.push(`${name} ended`);
        if (fail) reject(new Error(`${name} failed`));
        else resolve(name);
      };
    });
  return { write, finish: (fail = false) => end(fail) };
}

describe('the settings written in turn', () => {
  it('starts each write once the one asked for before it is done, in the order they come', async () => {
    const log: string[] = [];
    const change = heldWrite('change', log);
    const restore = heldWrite('restore', log);
    const changed = inTurn(change.write);
    const restored = inTurn(restore.write);
    await settled();
    expect(log).toEqual(['change started']);
    change.finish();
    expect(await changed).toBe('change');
    await settled();
    restore.finish();
    expect(await restored).toBe('restore');
    expect(log).toEqual(['change started', 'change ended', 'restore started', 'restore ended']);
  });

  it('goes on with the next write after one that failed, which fails alone', async () => {
    const failing = heldWrite('change', []);
    const failed = inTurn(failing.write);
    const next = inTurn(async () => 'next');
    await settled();
    failing.finish(true);
    await expect(failed).rejects.toThrow('change failed');
    expect(await next).toBe('next');
  });
});
