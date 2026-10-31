import { describe, expect, it } from 'vitest';
import { canShowInPage, centerOn } from '../../lib/presenter/placement';

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

describe('centerOn', () => {
  it('puts the window in the middle of the Chrome window, not of the screen', () => {
    const chromeWindow = { left: 1920, top: 100, width: 1200, height: 800 };
    expect(centerOn(chromeWindow, { width: 500, height: 300 })).toEqual({
      left: 2270,
      top: 350,
      width: 500,
      height: 300,
    });
  });

  it('gives whole pixels', () => {
    expect(centerOn({ left: 0, top: 0, width: 1001, height: 601 }, { width: 500.4, height: 300.6 })).toEqual({
      left: 251,
      top: 150,
      width: 500,
      height: 301,
    });
  });
});
