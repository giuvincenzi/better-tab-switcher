// Temporary experiment (edge_experiment.yml): can Playwright load the extension in Microsoft Edge, and open the
// switcher there? Two ways, each tried in Edge and in Playwright's Chromium (the control):
//   A: the --load-extension flag, at launch;
//   B: the DevTools protocol's Extensions.loadUnpacked, on the browser's own connection.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const extension = resolve('.output/chrome-mv3-e2e');

function log(channel, way, text) {
  console.log(`RESULT ${process.platform} ${channel} ${way}: ${text}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0];
}

/** Two pages of a site that exists only here, then the switcher from the toolbar icon: how many tabs it lists. */
async function openSwitcher(context, worker) {
  await context.route('https://bts.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>page</title><h1>page</h1>' }),
  );
  const first = await context.newPage();
  await first.goto('https://bts.test/alpha');
  const second = await context.newPage();
  await second.goto('https://bts.test/beta');
  await second.bringToFront();
  await worker.evaluate(() => globalThis.betterTabSwitcherTest.requestSwitcher({ direction: 'next', from: 'icon' }));
  const rows = second.locator('better-tab-switcher [role="option"]');
  await rows.first().waitFor({ timeout: 10000 });
  return rows.count();
}

async function withFlag(channel) {
  const way = 'A --load-extension';
  let context;
  try {
    context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'bts-')), {
      channel,
      headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 10000 }));
    log(channel, way, `service worker ${worker.url()}`);
    log(channel, way, `switcher shows ${await openSwitcher(context, worker)} tabs`);
  } catch (error) {
    log(channel, way, `failed: ${firstLine(error)}`);
  } finally {
    await context?.close();
  }
}

async function withProtocol(channel) {
  const way = 'B Extensions.loadUnpacked';
  let browser;
  try {
    browser = await chromium.launch({
      channel,
      headless: true,
      args: ['--enable-unsafe-extension-debugging'],
      ignoreDefaultArgs: ['--disable-extensions'],
    });
    const session = await browser.newBrowserCDPSession();
    const { id } = await session.send('Extensions.loadUnpacked', { path: extension, enableInIncognito: true });
    log(channel, way, `loaded, id ${id}`);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/options.html`);
    log(channel, way, `settings page title "${await page.title()}"`);
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null));
    if (!worker) {
      log(channel, way, 'no service worker in the context');
      return;
    }
    log(channel, way, `service worker ${worker.url()}`);
    log(channel, way, `switcher shows ${await openSwitcher(context, worker)} tabs`);
  } catch (error) {
    log(channel, way, `failed: ${firstLine(error)}`);
  } finally {
    await browser?.close();
  }
}

/** Sends one DevTools protocol command to the browser on its debugging port (the browser's target, not a page's). */
async function sendToBrowser(port, method, params) {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.onopen = done;
    socket.onerror = () => fail(new Error('no connection to the debugging port'));
  });
  const answer = new Promise((done) => {
    socket.onmessage = (event) => done(JSON.parse(event.data));
  });
  socket.send(JSON.stringify({ id: 1, method, params }));
  const message = await answer;
  socket.close();
  if (message.error) throw new Error(`${method}: ${message.error.message}`);
  return message.result;
}

async function withPort(channel) {
  const way = 'C Extensions.loadUnpacked on the debugging port';
  const port = channel === 'msedge' ? 9333 : 9334;
  let context;
  try {
    context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'bts-')), {
      channel,
      headless: true,
      args: [`--remote-debugging-port=${port}`, '--enable-unsafe-extension-debugging'],
      // Playwright starts the browser with --disable-extensions unless it loads one itself.
      ignoreDefaultArgs: ['--disable-extensions'],
    });
    const { id } = await sendToBrowser(port, 'Extensions.loadUnpacked', { path: extension });
    log(channel, way, `loaded, id ${id}`);
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 10000 }));
    log(channel, way, `service worker ${worker.url()}`);
    log(channel, way, `switcher shows ${await openSwitcher(context, worker)} tabs`);
  } catch (error) {
    log(channel, way, `failed: ${firstLine(error)}`);
  } finally {
    await context?.close();
  }
}

for (const channel of ['chromium', 'msedge']) {
  await withFlag(channel);
  await withProtocol(channel);
  await withPort(channel);
}
