import { describe, expect, it } from 'vitest';
import { canShowInPage } from '../../lib/presenter/placement';

describe('canShowInPage', () => {
  it('draws over web pages', () => {
    expect(canShowInPage('https://example.com/a')).toBe(true);
    expect(canShowInPage('http://localhost:3000/')).toBe(true);
  });

  it('never over Chrome pages, other extensions, the Chrome Web Store or local files', () => {
    for (const url of [
      'chrome://extensions/',
      'chrome://newtab/',
      'chrome-extension://abc/page.html',
      'https://chromewebstore.google.com/detail/x',
      'https://chrome.google.com/webstore/detail/x',
      'file:///home/me/a.pdf',
      'about:blank',
      'view-source:https://example.com',
    ]) {
      expect(canShowInPage(url), url).toBe(false);
    }
  });

  it('never when the address is missing or not an address', () => {
    expect(canShowInPage(undefined)).toBe(false);
    expect(canShowInPage('not an address')).toBe(false);
  });
});
