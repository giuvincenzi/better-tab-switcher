import { describe, expect, it } from 'vitest';
import { browserName, isKeptOutPage, shortcutsPageUrl } from '../../lib/browser';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const EDGE = `${CHROME} Edg/140.0.0.0`;

describe('browserName', () => {
  it('tells Edge by its "Edg/" and Chrome otherwise', () => {
    expect(browserName(CHROME)).toBe('chrome');
    expect(browserName(EDGE)).toBe('edge');
  });
});

describe('shortcutsPageUrl', () => {
  it("opens each browser's own shortcuts page", () => {
    expect(shortcutsPageUrl('chrome')).toBe('chrome://extensions/shortcuts');
    expect(shortcutsPageUrl('edge')).toBe('edge://extensions/shortcuts');
  });
});

describe('isKeptOutPage', () => {
  it('knows the Chrome Web Store, old and new address, and no other site', () => {
    expect(isKeptOutPage(new URL('https://chromewebstore.google.com/detail/x'))).toBe(true);
    expect(isKeptOutPage(new URL('https://chrome.google.com/webstore/detail/x'))).toBe(true);
    expect(isKeptOutPage(new URL('https://chrome.google.com/other'))).toBe(false);
    expect(isKeptOutPage(new URL('https://example.com/'))).toBe(false);
  });
});
