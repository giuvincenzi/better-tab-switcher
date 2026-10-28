import type { browser } from 'wxt/browser';

declare global {
  /**
   * The extension APIs, inside code the end-to-end tests evaluate in the extension (its service worker, its pages).
   * WXT's type swaps `i18n.getMessage` for its own `i18n`; the extension's pages still have Chrome's.
   */
  const chrome: Omit<typeof browser, 'i18n'> & { i18n: { getMessage(name: string): string } };

  /** The test build's hook in the service worker (entrypoints/background.ts): asks for the switcher as a shortcut or the toolbar icon does. */
  var betterTabSwitcherTest: {
    requestSwitcher(request: { direction: 'next' | 'previous'; from: 'shortcut' | 'icon' }): Promise<void>;
  };
}
