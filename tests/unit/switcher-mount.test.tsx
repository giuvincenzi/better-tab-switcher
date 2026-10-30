import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from '#imports';
import { mountSwitcher, type SwitcherHandle } from '../../components/switcher/mountSwitcher';
import { type SwitcherSnapshot, sendMessage } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

// The switcher as the page and its own window show it: mountSwitcher, with the messages to the background faked. What
// the user does with it on the real browser (above the page's dialogs, its theme, Esc, opening and closing tabs, the
// toolbar, the shortcut pressed again, the previews kept): tests/e2e/switcher.spec.ts, settings.spec.ts, grid.spec.ts.
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

const tile = (name: string) => document.querySelector(`[role="option"][aria-label="${name}"]`) as HTMLElement;
const picture = (name: string) => tile(name).querySelector('img[src^="data:"]')?.getAttribute('src');

describe('mountSwitcher', () => {
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
});
