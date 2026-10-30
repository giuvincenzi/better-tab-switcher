import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { browser } from '#imports';
import { mountSwitcher, type SwitcherHandle } from '../../components/switcher/mountSwitcher';
import { type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

// The switcher as the page and its own window show it: mountSwitcher, with the messages to the background faked.
vi.mock('../../lib/messages', () => ({ sendMessage: vi.fn() }));

const tab = (id: number, title: string): SwitcherTab => ({
  id,
  windowId: 10 + id,
  title,
  url: `https://example.com/${id}`,
  pinned: false,
  audible: false,
  sleeping: false,
  incognito: false,
  lastAccessed: 1000 - id,
});
const tabs = [tab(1, 'Pull request #12'), tab(2, 'Inbox (3)'), tab(3, 'Q4 planning'), tab(4, 'Running plan')];

/** The previews the background already has, given when the test says so. */
let savedPreviews: (previews: Record<number, string>) => void;
const messages = vi.mocked(sendMessage);

beforeEach(() => {
  messages.mockReset();
  messages.mockImplementation(((name: string) =>
    name === 'getPreviews'
      ? new Promise((done) => {
          savedPreviews = done;
        })
      : Promise.resolve()) as unknown as typeof sendMessage);
});

let handle: SwitcherHandle | undefined;
afterEach(() => {
  handle?.dispose();
  handle = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(settings: Partial<Settings> = {}, more: Partial<SwitcherSnapshot> = {}) {
  const onDone = vi.fn();
  const snapshot: SwitcherSnapshot = {
    tabs,
    settings: { ...defaultSettings, delayMs: 0, ...settings },
    direction: 'next',
    fromIcon: false,
    waitForPicture: false,
    ...more,
  };
  handle = mountSwitcher(document.body, snapshot, onDone);
  const dialog = document.querySelector('dialog') as HTMLDialogElement;
  return { dialog, onDone, handle };
}

const selectedName = () => document.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('aria-label');
const tile = (name: string) => document.querySelector(`[role="option"][aria-label="${name}"]`) as HTMLElement;
const picture = (name: string) => tile(name).querySelector('img[src^="data:"]')?.getAttribute('src');

describe('mountSwitcher', () => {
  it('shows the switcher in a modal dialog, above everything of the page', () => {
    const { dialog } = mount();
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(dialog.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('gives the switcher the theme chosen in the settings', () => {
    const { dialog } = mount({ theme: 'dark' });
    expect(dialog.dataset.theme).toBe('dark');
  });

  it('runs left to right in English', () => {
    const { dialog } = mount();
    expect(dialog.lang).toBe('en');
    expect(dialog.dir).toBe('ltr');
  });

  it('runs right to left when its texts are in Arabic', () => {
    const getMessage = browser.i18n.getMessage;
    vi.spyOn(browser.i18n, 'getMessage').mockImplementation(((name: string, ...rest: []) =>
      name === 'Language_Tag' ? 'ar' : getMessage(name as never, ...rest)) as typeof getMessage);
    const { dialog } = mount();
    expect(dialog.dir).toBe('rtl');
    expect(getComputedStyle(dialog.querySelector('[role="listbox"]') as HTMLElement).direction).toBe('rtl');
  });

  it('closes on Esc as the switcher, never as a dialog: it tells the background once', async () => {
    const { dialog, onDone } = mount();
    await userEvent.keyboard('{Escape}');
    expect(onDone).toHaveBeenCalledOnce();
    expect(messages).toHaveBeenCalledWith('switcherClosed');
    // The dialog's own Esc (cancel) does nothing: the switcher removes it when it is done.
    expect(dialog.open).toBe(true);
  });

  it('opens the chosen tab in its window, once the switcher is done', () => {
    const { onDone } = mount();
    tile('Q4 planning, example.com/3').click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(messages).toHaveBeenCalledWith('openTab', 3);
  });

  it('asks the background to close a tab and stays open', () => {
    const { onDone } = mount();
    (tile('Q4 planning, example.com/3').querySelector('button[aria-label="Close tab"]') as HTMLButtonElement).click();
    expect(messages).toHaveBeenCalledWith('closeTab', { tabId: 3, resume: expect.anything() });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('opens the settings page and closes', () => {
    const { onDone } = mount();
    (document.querySelector('button[aria-label="All settings"]') as HTMLButtonElement).click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(messages).toHaveBeenCalledWith('openSettings');
  });

  it('sends a change made in the toolbar to the background, which saves the settings', () => {
    mount();
    (document.querySelector('button[aria-label="Compact"]') as HTMLButtonElement).click();
    expect(messages).toHaveBeenCalledWith('saveSettings', { compact: true });
  });

  it('moves the selection each time the shortcut is pressed again', () => {
    const { handle } = mount();
    expect(selectedName()).toBe('Inbox (3), example.com/2');
    handle.move('next');
    expect(selectedName()).toBe('Q4 planning, example.com/3');
    handle.move('previous');
    expect(selectedName()).toBe('Inbox (3), example.com/2');
  });

  it('shows the previews the background already has, for the tabs shown', async () => {
    mount({ view: 'grid' });
    expect(messages).toHaveBeenCalledWith('getPreviews', [1, 2, 3, 4]);
    savedPreviews({ 3: 'data:image/webp;base64,c2F2ZWQ=' });
    await vi.waitFor(() => expect(picture('Q4 planning, example.com/3')).toBe('data:image/webp;base64,c2F2ZWQ='));
  });

  it('keeps a preview that arrived while the saved ones were on their way: it is newer', async () => {
    const { handle } = mount({ view: 'grid' });
    handle.showPreview({ tabId: 3, picture: 'data:image/webp;base64,bmV3' });
    expect(picture('Q4 planning, example.com/3')).toBe('data:image/webp;base64,bmV3');
    savedPreviews({ 3: 'data:image/webp;base64,b2xk', 4: 'data:image/webp;base64,c2F2ZWQ=' });
    await vi.waitFor(() => expect(picture('Running plan, example.com/4')).toBe('data:image/webp;base64,c2F2ZWQ='));
    expect(picture('Q4 planning, example.com/3')).toBe('data:image/webp;base64,bmV3');
  });

  it("shows itself once the page's picture is taken", async () => {
    const { dialog, handle } = mount({}, { waitForPicture: true });
    const backdrop = dialog.firstElementChild as HTMLElement;
    expect(getComputedStyle(backdrop).visibility).toBe('hidden');
    handle.pictureTaken();
    await vi.waitFor(() => expect(getComputedStyle(backdrop).visibility).toBe('visible'));
  });

  it('leaves nothing in the page once disposed', () => {
    const { handle } = mount();
    handle.dispose();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});
