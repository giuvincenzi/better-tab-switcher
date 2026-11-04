import { beforeEach, describe, expect, it } from 'vitest';
import { type Browser, fakeBrowser } from '#imports';
import { followNotOpenedTabs, madeNotOpened, notOpenedTabs } from '../../lib/tabs/not-opened';

// What the browser gives as a tab is made (measured in Chromium and Microsoft Edge): a tab opened in the background has
// no page yet (an empty url, the address in pendingUrl); one brought back (Reopen closed window) already has its url.
const made = (id: number, active: boolean, url: string) =>
  ({ id, active, url, pendingUrl: 'https://bts.test/page' }) as unknown as Browser.tabs.Tab;
const NEW = '';
const BROUGHT_BACK = 'https://bts.test/page';

/** onReplaced, which the tests' setup adds to the fake browser (tests/unit/logic-setup.ts). */
const onReplaced = () =>
  fakeBrowser.tabs.onReplaced as unknown as { trigger: (addedTabId: number, removedTabId: number) => Promise<unknown> };

/** Lets the listeners' writes to storage.session end. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('madeNotOpened', () => {
  it('is true of a tab made in the background, with no page of its own yet', () => {
    expect(madeNotOpened({ active: false, url: '' })).toBe(true);
    expect(madeNotOpened({ active: false })).toBe(true);
  });

  it('is false of a tab made in front, and of one the browser brings back with its page', () => {
    expect(madeNotOpened({ active: true, url: '' })).toBe(false);
    expect(madeNotOpened({ active: false, url: 'https://bts.test/page' })).toBe(false);
  });
});

describe('the tabs not opened yet', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    followNotOpenedTabs();
  });

  it('are the tabs made in the background, until they are opened', async () => {
    await fakeBrowser.tabs.onCreated.trigger(made(1, false, NEW));
    await fakeBrowser.tabs.onCreated.trigger(made(2, false, NEW));
    await settle();
    expect(await notOpenedTabs([1, 2, 3])).toEqual(new Set([1, 2]));
    await fakeBrowser.tabs.onActivated.trigger({ tabId: 1, windowId: 1 });
    await settle();
    expect(await notOpenedTabs([1, 2])).toEqual(new Set([2]));
  });

  it('never include a tab made in front, nor one Chrome brought back', async () => {
    await fakeBrowser.tabs.onCreated.trigger(made(1, true, NEW));
    await fakeBrowser.tabs.onCreated.trigger(made(2, false, BROUGHT_BACK));
    await settle();
    expect(await notOpenedTabs([1, 2])).toEqual(new Set());
  });

  it('forget a tab that closes', async () => {
    await fakeBrowser.tabs.onCreated.trigger(made(1, false, NEW));
    await settle();
    await fakeBrowser.tabs.onRemoved.trigger(1, { windowId: 1, isWindowClosing: false });
    await settle();
    expect(await notOpenedTabs([1])).toEqual(new Set());
    expect(await fakeBrowser.storage.session.get(null)).toEqual({});
  });

  it('keep a tab Chrome took out of memory under its new id, and only that one', async () => {
    await fakeBrowser.tabs.onCreated.trigger(made(1, false, NEW));
    await settle();
    await onReplaced().trigger(5, 1);
    await onReplaced().trigger(6, 2);
    await settle();
    expect(await notOpenedTabs([1, 2, 5, 6])).toEqual(new Set([5]));
  });

  it('are kept in the session only, one item per tab', async () => {
    await fakeBrowser.tabs.onCreated.trigger(made(1, false, NEW));
    await settle();
    expect(await fakeBrowser.storage.session.get(null)).toEqual({ 'notOpened-1': true });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
});
