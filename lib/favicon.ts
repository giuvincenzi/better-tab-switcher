import { browser } from '#imports';

type ExtensionPath = Parameters<typeof browser.runtime.getURL>[0];

/**
 * A page's icon from Chrome's own cache (the favicon permission): nothing is fetched from the site. `size` is the size
 * shown, in CSS pixels; the icon asked for has the screen's pixel density, so it stays sharp.
 */
export function faviconUrl(pageUrl: string, size: number): string {
  // _favicon is served by Chrome, not a file of the extension: WXT's list of the extension's paths doesn't have it.
  const url = new URL(browser.runtime.getURL('/_favicon/' as ExtensionPath));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(Math.ceil(size * globalThis.devicePixelRatio)));
  return url.toString();
}
