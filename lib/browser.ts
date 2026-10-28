/**
 * What differs between Chrome and Microsoft Edge, in one place: the rest of the code asks here. Both are Chromium and
 * run the extension with the same APIs; only these values change.
 */
export type BrowserName = 'chrome' | 'edge';

/** The browser the extension runs in: Edge names itself "Edg/" in its user agent, Chrome doesn't. */
export function browserName(userAgent: string = navigator.userAgent): BrowserName {
  return /\bEdg\//.test(userAgent) ? 'edge' : 'chrome';
}

/** The text (locales/en.yml, a GLOBAL word) with each browser's name, for the sentences that name the browser. */
export const BROWSER_NAME_TEXT = { chrome: 'Browser_Chrome', edge: 'Browser_Edge' } as const;

/** The browser's page where the extensions' shortcuts are changed. */
export function shortcutsPageUrl(name: BrowserName = browserName()): string {
  return name === 'edge' ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
}

/**
 * Web pages the browser keeps every extension out of, known by their address: the Chrome Web Store. Any other page
 * that keeps the switcher out is found when the switcher tries to show there (lib/presenter/presenter.ts).
 */
export function isKeptOutPage(address: URL): boolean {
  if (address.hostname === 'chromewebstore.google.com') return true;
  return address.hostname === 'chrome.google.com' && address.pathname.startsWith('/webstore');
}
