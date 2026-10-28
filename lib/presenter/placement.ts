/**
 * Whether the switcher can be drawn over this page. Chrome lets no extension into its own pages (chrome://, the new
 * tab page, other extensions) nor the Chrome Web Store.
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
