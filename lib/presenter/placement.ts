export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Whether the switcher can be drawn over this page. Chrome lets no extension into its own pages (chrome://, the new
 * tab page, other extensions) nor the Chrome Web Store; there the switcher opens in a window of its own.
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
  if (address.hostname === 'chromewebstore.google.com') return false;
  return !(address.hostname === 'chrome.google.com' && address.pathname.startsWith('/webstore'));
}

/**
 * Where the switcher's window goes: centered on the Chrome window it was opened from, moved inside the screen that
 * window is on when it would go past its edges.
 */
export function centerOn(window: Rect, size: { width: number; height: number }, screens: readonly Rect[]): Rect {
  const centerX = window.left + window.width / 2;
  const centerY = window.top + window.height / 2;
  const screen = screens.find((s) => contains(s, centerX, centerY)) ?? screens[0];
  const width = screen ? Math.min(size.width, screen.width) : size.width;
  const height = screen ? Math.min(size.height, screen.height) : size.height;
  let left = Math.round(centerX - width / 2);
  let top = Math.round(centerY - height / 2);
  if (screen) {
    left = clamp(left, screen.left, screen.left + screen.width - width);
    top = clamp(top, screen.top, screen.top + screen.height - height);
  }
  return { left, top, width, height };
}

function contains(r: Rect, x: number, y: number) {
  return x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
