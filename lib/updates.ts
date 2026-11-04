import { browser } from '#imports';

/**
 * Checking for a new version of the extension, from the settings page. The browser already checks its store every few
 * hours and installs a new version by itself; the user can ask for a check at once (runtime.requestUpdateCheck, only
 * on the user's click: its documentation asks extensions not to call it on their own).
 */

/** What a check found: up to date, a new version ready to use, or no answer now. */
export type UpdateCheck =
  | { kind: 'current' }
  /** Downloaded: it is used when the extension restarts. Its version, when the browser says it. */
  | { kind: 'ready'; version?: string }
  /** The browser checked a moment ago and doesn't check again yet. */
  | { kind: 'later' }
  | { kind: 'failed' };

/** Asks the browser to check its store for a new version now. */
export async function checkForUpdate(
  request: () => Promise<{ status: string; version?: string }> = () => browser.runtime.requestUpdateCheck(),
): Promise<UpdateCheck> {
  try {
    const { status, version } = await request();
    if (status === 'no_update') return { kind: 'current' };
    if (status === 'update_available') return version ? { kind: 'ready', version } : { kind: 'ready' };
    if (status === 'throttled') return { kind: 'later' };
    console.info(`Better Tab Switcher: the browser answered the update check with "${status}".`);
    return { kind: 'failed' };
  } catch (error) {
    console.info('Better Tab Switcher: the browser could not check for updates.', error);
    return { kind: 'failed' };
  }
}

/** Restarts the extension (Restart in System, Restart extension in About): a new version downloaded runs then. Its pages close. */
export function restartExtension(): void {
  browser.runtime.reload();
}
