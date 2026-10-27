// The extension's icons: assets/icon.svg drawn by Playwright's Chromium at each size Chrome asks for, into
// public/icon/<size>.png. At 16 px (Chrome's toolbar) assets/icon-16.svg, without the window's dots, which would be a
// blur there. Run it after changing the icon: the PNGs are committed.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const sizes = [16, 32, 48, 96, 128];
/** @param {number} size */
const svg = (size) => readFileSync(size === 16 ? 'assets/icon-16.svg' : 'assets/icon.svg', 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(size)}`,
  );
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
  console.log(`public/icon/${size}.png`);
}
await browser.close();
