import { browser } from '#imports';

/**
 * The extension's shortcuts as the browser writes them, "" for one without keys: the next and previous tab ones
 * (wxt.config.ts) and the toolbar icon's (_execute_action, the browser's own for every extension with an icon).
 */
export interface Shortcuts {
  next: string;
  previous: string;
  icon: string;
}

export async function readShortcuts(): Promise<Shortcuts> {
  const commands = await browser.commands.getAll();
  const keys = (name: string) => commands.find((command) => command.name === name)?.shortcut ?? '';
  return { next: keys('next-tab'), previous: keys('previous-tab'), icon: keys('_execute_action') };
}

/**
 * The next or previous tab shortcut has no keys: another extension already used its default ones when this one was
 * installed (the browser gives an extension its suggested keys only when they are free), or the user took them away.
 */
export const shortcutMissing = (shortcuts: Shortcuts): boolean => !shortcuts.next || !shortcuts.previous;

/** The settings page's address that opens the shortcuts' dialog (entrypoints/options). */
export const SHORTCUTS_DIALOG_PAGE = '/options.html?shortcuts';

/** Just installed: when the browser left a shortcut without keys, the settings open on the dialog to choose them. */
export async function askForMissingShortcuts(): Promise<void> {
  if (shortcutMissing(await readShortcuts()))
    await browser.tabs.create({ url: browser.runtime.getURL(SHORTCUTS_DIALOG_PAGE) });
}
