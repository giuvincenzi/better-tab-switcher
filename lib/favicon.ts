import { browser } from '#imports';
import { DEFAULT_EM_PX } from './switcher/sizes';

type ExtensionPath = Parameters<typeof browser.runtime.getURL>[0];

/**
 * A page's icon from Chrome's own cache (the favicon permission): nothing is fetched from the site. `size` is the size
 * shown, in em; the icon asked for has the screen's pixel density, so it stays sharp at the default text size. A tab with
 * no address yet has no icon to ask for: Chrome would answer with an error.
 */
export function faviconUrl(pageUrl: string, size: number): string | undefined {
  if (!pageUrl) return undefined;
  // _favicon is served by Chrome, not a file of the extension: WXT's list of the extension's paths doesn't have it.
  const url = new URL(browser.runtime.getURL('/_favicon/' as ExtensionPath));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(Math.ceil(size * DEFAULT_EM_PX * globalThis.devicePixelRatio)));
  return url.toString();
}
