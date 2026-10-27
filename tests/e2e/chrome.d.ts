import type { browser } from 'wxt/browser';

declare global {
  /**
   * The extension APIs, inside code the end-to-end tests evaluate in the extension (its service worker, its pages).
   * WXT's type swaps `i18n.getMessage` for its own `i18n`; the extension's pages still have Chrome's.
   */
  const chrome: Omit<typeof browser, 'i18n'> & { i18n: { getMessage(name: string): string } };

  /** The test build's hook in the service worker (entrypoints/background.ts): opens the switcher as a shortcut does. */
  var betterTabSwitcherTest: { showSwitcher(direction: 'next' | 'previous', fromClick: boolean): Promise<void> };
}
