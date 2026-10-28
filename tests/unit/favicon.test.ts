import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { faviconUrl } from '../../lib/favicon';

function onScreen(devicePixelRatio: number) {
  vi.stubGlobal('devicePixelRatio', devicePixelRatio);
}

describe('faviconUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Chrome's own icon cache of the extension for the page's icon, never the site", () => {
    onScreen(1);
    const url = new URL(faviconUrl('https://mail.example.com/inbox', 1));
    expect(url.origin).toBe(new URL(fakeBrowser.runtime.getURL('/')).origin);
    expect(url.pathname).toBe('/_favicon/');
    expect(url.searchParams.get('pageUrl')).toBe('https://mail.example.com/inbox');
  });

  it('passes the whole page address, with its query and its fragment', () => {
    onScreen(1);
    const page = 'https://example.com/search?q=a&b=c d#top';
    const url = new URL(faviconUrl(page, 1));
    expect(url.searchParams.get('pageUrl')).toBe(page);
    expect([...url.searchParams.keys()].sort()).toEqual(['pageUrl', 'size']);
  });

  it("asks for the size shown in the screen's pixels, rounded up to stay sharp", () => {
    const size = (em: number) => new URL(faviconUrl('https://x.example', em)).searchParams.get('size');
    onScreen(1);
    expect(size(1)).toBe('16');
    onScreen(2);
    expect(size(1)).toBe('32');
    // 1.0625 em at 16 px is 17 px; on a screen with 1.25 pixels per pixel, 21.25 of them.
    onScreen(1.25);
    expect(size(1.0625)).toBe('22');
  });
});
