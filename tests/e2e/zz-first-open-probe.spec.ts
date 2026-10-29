import type { Page } from '@playwright/test';
import { test } from './fixtures';
import { openPages, useSettings } from './helpers';

// TEMPORARY: what each message of the background to a page takes the first time the switcher opens there, and how it
// ends: to know why macOS once got the switcher's window instead.
test.setTimeout(300_000);

for (const view of ['grid', 'list'] as const) {
  test(`probe first opening ${view}`, async ({ context, serviceWorker }) => {
    await useSettings(serviceWorker, { view });
    await serviceWorker.evaluate(() => {
      const log: string[] = [];
      Object.assign(globalThis, { probeLog: log });
      const send = chrome.tabs.sendMessage.bind(chrome.tabs) as (...args: unknown[]) => unknown;
      chrome.tabs.sendMessage = ((tabId: number, message: { type?: string }, options: unknown, reply?: unknown) => {
        const started = performance.now();
        const callback = typeof options === 'function' ? options : reply;
        const done = (response: unknown) => {
          const error = chrome.runtime.lastError?.message;
          log.push(`${message?.type} ${Math.round(performance.now() - started)} ms${error ? ` ERROR ${error}` : ''}`);
          (callback as (r: unknown) => void)?.(response);
        };
        return typeof options === 'function' ? send(tabId, message, done) : send(tabId, message, options, done);
      }) as never;
      const inject = chrome.scripting.executeScript.bind(chrome.scripting);
      chrome.scripting.executeScript = (async (injection: Parameters<typeof inject>[0]) => {
        const started = performance.now();
        try {
          return await inject(injection);
        } finally {
          log.push(`executeScript ${Math.round(performance.now() - started)} ms`);
        }
      }) as never;
    });
    const results: string[] = [];
    for (let run = 0; run < 8; run++) {
      const [page] = (await openPages(context, [`run${run}-a`, `run${run}-b`])).slice(-1) as [Page];
      await page.bringToFront();
      await serviceWorker.evaluate(() => {
        (globalThis as unknown as { probeLog: string[] }).probeLog.length = 0;
      });
      const started = performance.now();
      await serviceWorker.evaluate(() =>
        globalThis.betterTabSwitcherTest.requestSwitcher({ direction: 'next', from: 'shortcut' }),
      );
      const took = Math.round(performance.now() - started);
      const log = await serviceWorker.evaluate(() =>
        (globalThis as unknown as { probeLog: string[] }).probeLog.join(' | '),
      );
      const windows = await serviceWorker.evaluate(async () =>
        (await chrome.windows.getAll()).map((w) => w.type).join(','),
      );
      results.push(`run ${run}: ${took} ms, windows ${windows}: ${log}`);
      for (const other of context.pages()) if (other.url().startsWith('chrome-extension://')) await other.close();
      await page.keyboard.press('Escape');
    }
    console.log(`PROBE ${process.platform} ${process.env.E2E_BROWSER ?? 'chromium'} ${view}\n${results.join('\n')}`);
  });
}
