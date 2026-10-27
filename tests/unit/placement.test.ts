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
  const screen = { left: 0, top: 0, width: 1920, height: 1080 };

  it('centers on the Chrome window', () => {
    const window = { left: 100, top: 100, width: 1200, height: 800 };
    expect(centerOn(window, { width: 480, height: 400 }, [screen])).toEqual({
      left: 460,
      top: 300,
      width: 480,
      height: 400,
    });
  });

  it('stays inside the screen when the window is partly off it', () => {
    const window = { left: 1700, top: 900, width: 800, height: 600 };
    expect(centerOn(window, { width: 480, height: 400 }, [screen])).toEqual({
      left: 1440,
      top: 680,
      width: 480,
      height: 400,
    });
  });

  it('uses the screen the window is on', () => {
    const second = { left: 1920, top: 0, width: 1280, height: 1024 };
    const window = { left: 2000, top: 50, width: 1000, height: 800 };
    expect(centerOn(window, { width: 480, height: 400 }, [screen, second]).left).toBe(2260);
  });

  it('is never bigger than the screen', () => {
    const small = { left: 0, top: 0, width: 400, height: 300 };
    expect(centerOn(small, { width: 480, height: 400 }, [small])).toEqual({ left: 0, top: 0, width: 400, height: 300 });
  });
});
