import { browser } from '#imports';

/** Restarts the extension (Restart in System): its pages close, and it starts again. */
export function restartExtension(): void {
  browser.runtime.reload();
}
