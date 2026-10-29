import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, fakeBrowser } from '#imports';
import { askForMissingShortcuts, readShortcuts, SHORTCUTS_DIALOG_PAGE } from '../../lib/shortcuts';

// The extension's shortcuts as the browser gives them (lib/shortcuts.ts), and the settings' dialog after the install
// when the browser left one without keys.

/** The browser's commands: the next and previous tab ones, and the toolbar icon's. */
function commands(next: string, previous: string, icon = '') {
  (fakeBrowser.commands as { getAll: unknown }).getAll = vi.fn(async () => [
    { name: '_execute_action', shortcut: icon },
    { name: 'next-tab', shortcut: next },
    { name: 'previous-tab', shortcut: previous },
  ]);
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the shortcuts', () => {
  it('reads the next and previous tab ones and the toolbar icon\'s, "" for one without keys', async () => {
    commands('Alt+S', '', 'Alt+K');
    expect(await readShortcuts()).toEqual({ next: 'Alt+S', previous: '', icon: 'Alt+K' });
  });

  it("opens the settings on the shortcuts' dialog after the install when the next or previous one has no keys", async () => {
    commands('', 'Alt+Shift+S');
    await askForMissingShortcuts();
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: browser.runtime.getURL(SHORTCUTS_DIALOG_PAGE) });
  });

  it("opens nothing when both have their keys, whatever the toolbar icon's", async () => {
    commands('Alt+S', 'Alt+Shift+S', '');
    await askForMissingShortcuts();
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });
});
