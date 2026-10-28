import { expect, test } from './fixtures';
import { openPages } from './helpers';

// Temporary measure (removed once read): how long the switcher's script takes to be injected into a page the first
// time, on each system and browser, to set the background's limit for it (lib/presenter/presenter.ts).
test('injection time @probe', async ({ context, serviceWorker }) => {
  const times: number[] = [];
  for (let round = 0; round < 8; round++) {
    const [page] = await openPages(context, [`page${round}`]);
    await page?.bringToFront();
    const took = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const start = performance.now();
      await chrome.scripting.executeScript({
        target: { tabId: tab?.id as number },
        files: ['/content-scripts/switcher.js'],
      });
      return Math.round(performance.now() - start);
    });
    times.push(took);
  }
  console.log(`INJECT ${process.platform} ${process.env.E2E_BROWSER ?? 'chromium'} ${JSON.stringify(times)}`);
  expect(times).toHaveLength(8);
});
