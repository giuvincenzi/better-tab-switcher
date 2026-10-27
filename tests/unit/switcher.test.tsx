import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Switcher, type SwitcherProps } from '../../components/switcher/Switcher';
import type { Direction, SwitcherSnapshot } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

const tab = (id: number, title: string): SwitcherTab => ({
  id,
  windowId: 1,
  title,
  url: `https://example.com/${id}`,
  pinned: false,
  audible: false,
  sleeping: false,
  incognito: false,
  lastAccessed: 1000 - id,
});
const tabs = [tab(1, 'Pull request #12'), tab(2, 'Inbox (3)'), tab(3, 'Q4 planning'), tab(4, 'Running plan')];

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});

function open(settings: Partial<Settings> = {}, more: Partial<SwitcherSnapshot & SwitcherProps> = {}) {
  const snapshot: SwitcherSnapshot = {
    tabs,
    settings: { ...defaultSettings, delayMs: 0, ...settings },
    direction: 'next',
    fromClick: false,
    shortcuts: { next: 'Alt+Y', previous: 'Alt+Shift+Y' },
    waitForPicture: false,
    ...more,
  };
  const [moves, setMoves] = createSignal<{ direction: Direction; count: number }>({ direction: 'next', count: 0 });
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const [pictureTaken, setPictureTaken] = createSignal(false);
  const handlers = { onOpen: vi.fn(), onClose: vi.fn(), onCloseTab: vi.fn(), onSettings: vi.fn() };
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <Switcher
        snapshot={snapshot}
        moves={moves}
        canSeeRelease={more.canSeeRelease ?? true}
        previews={previews}
        pictureTaken={pictureTaken}
        {...handlers}
      />
    ),
    host,
  );
  const press = (key: string, type: 'keydown' | 'keyup' = 'keydown') =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  const move = (direction: Direction) => setMoves((m) => ({ direction, count: m.count + 1 }));
  return { host, handlers, press, move, setPreviews, takePicture: () => setPictureTaken(true) };
}

const selectedTitle = (host: HTMLElement) => host.querySelector('[aria-selected="true"]')?.getAttribute('aria-label');
const footer = (host: HTMLElement) => host.querySelector('button[aria-label="Settings"]')?.parentElement?.textContent;

describe('Switcher', () => {
  it('selects the previous tab and shows the keys with the real shortcuts', () => {
    const { host } = open();
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(selectedTitle(host)).toBe('Inbox (3)');
    expect(footer(host)).toContain('Alt+Y next, Alt+Shift+Y back, Esc closes');
  });

  it('shows only the next tab shortcut when the previous one has no keys', () => {
    const { host } = open({}, { shortcuts: { next: 'Ctrl+Q', previous: '' } });
    expect(footer(host)).toContain('Ctrl+Q next, Esc closes');
  });

  it('says how to choose when it stays open', () => {
    expect(footer(open({ stayOpen: true }).host)).toContain('Enter or a click opens the tab, Esc closes');
    dispose?.();
    expect(footer(open({}, { fromClick: true }).host)).toContain('Enter or a click opens the tab, Esc closes');
    dispose?.();
    expect(footer(open({}, { canSeeRelease: false }).host)).toContain('Enter or a click opens the tab, Esc closes');
  });

  it('opens the selected tab when Alt is released', () => {
    const { handlers, press } = open();
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[1]);
  });

  it('moves when the shortcut is pressed again, and with the arrows', () => {
    const { host, move, press, handlers } = open();
    move('next');
    expect(selectedTitle(host)).toBe('Q4 planning');
    press('ArrowDown');
    expect(selectedTitle(host)).toBe('Running plan');
    move('previous');
    press('Enter');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[2]);
  });

  it('closes on Esc', () => {
    const { handlers, press } = open();
    press('Escape');
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('starts on the search field, focused, with Search on', () => {
    const { host } = open({ search: true });
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(selectedTitle(host)).toBeUndefined();
    expect(footer(host)).toContain('Type to search, Alt+Y goes to the tabs, Esc closes');
  });

  it('shows the tabs that match what is typed, with the match highlighted', () => {
    const { host } = open({ search: true });
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    field.value = 'plan';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    const shown = [...host.querySelectorAll('[role="option"]')].map((row) => row.getAttribute('aria-label'));
    expect(shown).toEqual(['Q4 planning', 'Running plan']);
    expect([...host.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['plan', 'plan']);
  });

  it('says so when nothing matches', () => {
    const { host } = open({ search: true });
    const field = host.querySelector('input[type="search"]') as HTMLInputElement;
    field.value = 'passport';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(host.textContent).toContain('No tabs match your search.');
  });

  it('shows the search field from the footer button, also with Search off', () => {
    const { host } = open();
    expect(host.querySelector('input[type="search"]')).toBeNull();
    (host.querySelector('button[aria-label="Search tabs"]') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
  });

  it('opens the settings from the footer', () => {
    const { host, handlers } = open();
    (host.querySelector('button[aria-label="Settings"]') as HTMLButtonElement).click();
    expect(handlers.onSettings).toHaveBeenCalledOnce();
  });

  it('closes a tab and keeps the list', () => {
    const { host, handlers } = open();
    (host.querySelectorAll('button[aria-label="Close tab"]')[3] as HTMLButtonElement).click();
    expect(handlers.onCloseTab).toHaveBeenCalledWith(tabs[3]);
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it('stays hidden for the delay, so a quick tap never shows it', async () => {
    const { host, handlers, press } = open({ delayMs: 200 });
    const backdrop = host.firstElementChild as HTMLElement;
    expect(getComputedStyle(backdrop).visibility).toBe('hidden');
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[1]);
    dispose?.();
    const later = open({ delayMs: 50 });
    await vi.waitFor(() =>
      expect(getComputedStyle(later.host.firstElementChild as HTMLElement).visibility).toBe('visible'),
    );
  });

  it("stays hidden until the page's picture is taken, so it is not in it", async () => {
    const { host, takePicture } = open({ view: 'grid' }, { waitForPicture: true });
    const backdrop = host.firstElementChild as HTMLElement;
    expect(getComputedStyle(backdrop).visibility).toBe('hidden');
    takePicture();
    await vi.waitFor(() => expect(getComputedStyle(backdrop).visibility).toBe('visible'));
  });
});

describe('Switcher in the grid', () => {
  it('moves along a row with left and right, between rows with up and down', () => {
    const { host, press } = open({ view: 'grid', gridColumns: 2 });
    expect(selectedTitle(host)).toBe('Inbox (3)');
    press('ArrowDown');
    expect(selectedTitle(host)).toBe('Running plan');
    press('ArrowLeft');
    expect(selectedTitle(host)).toBe('Q4 planning');
    press('ArrowUp');
    expect(selectedTitle(host)).toBe('Pull request #12');
    press('ArrowRight');
    expect(selectedTitle(host)).toBe('Inbox (3)');
  });

  it("shows the site's icon until the tab's picture arrives", () => {
    const { host, setPreviews } = open({ view: 'grid' });
    const tile = () => host.querySelector('[aria-label="Q4 planning"]') as HTMLElement;
    expect(tile().querySelector('img[src^="data:"]')).toBeNull();
    expect(tile().querySelectorAll('img[src*="_favicon"]')).toHaveLength(2);
    setPreviews({ 3: 'data:image/webp;base64,UklGRg==' });
    expect(tile().querySelector('img[src^="data:"]')).not.toBeNull();
  });

  it("shows only the sites' icons with Previews off", () => {
    const { host, setPreviews } = open({ view: 'grid', previews: false });
    setPreviews({ 3: 'data:image/webp;base64,UklGRg==' });
    expect(host.querySelector('img[src^="data:"]')).toBeNull();
  });
});
