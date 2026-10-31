import { onMessage } from '../messages';
import { restoreDefaultSettings, saveSettings } from './store';

/**
 * In the background: the one writer of the settings. The settings page and the switcher's toolbar send their changes
 * here, and they are saved one after the other, in the order they come: two pages saving at the same moment each read
 * the settings, changed one and wrote them all back, so one change was lost. The pages read and watch the settings
 * themselves (lib/settings/store.ts).
 */
export function listenToSettingsChanges(): void {
  onMessage('saveSettings', ({ data: change }) => inTurn(() => saveSettings(change)));
  onMessage('restoreDefaultSettings', () => inTurn(restoreDefaultSettings));
}

/** The last write asked for: the next one waits for it. */
let lastWrite: Promise<unknown> = Promise.resolve();

/** Runs `write` once every write asked for before it is done, failed or not; resolves or fails as it does. */
export function inTurn<T>(write: () => Promise<T>): Promise<T> {
  const done = lastWrite.then(write);
  lastWrite = done.catch(() => undefined);
  return done;
}
