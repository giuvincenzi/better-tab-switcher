import { isKeptOutPage } from '../browser';

/**
 * Whether the switcher can be drawn over this page: a web page (http, https) the browser doesn't keep extensions out
 * of. The browser's own pages (chrome://, edge://, the new tab page, other extensions) and local files never.
 */
export function canShowInPage(url: string | undefined): boolean {
  if (!url) return false;
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return false;
  }
  if (address.protocol !== 'http:' && address.protocol !== 'https:') return false;
  return !isKeptOutPage(address);
}

/** A window's place and size on the screen, in pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A window of this size, in the middle of another window (`on`), as the switcher is in the middle of the page. */
export function centerOn(on: Rect, size: { width: number; height: number }): Rect {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  return {
    left: Math.round(on.left + (on.width - width) / 2),
    top: Math.round(on.top + (on.height - height) / 2),
    width,
    height,
  };
}
