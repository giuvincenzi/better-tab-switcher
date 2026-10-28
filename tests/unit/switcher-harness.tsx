import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { vi } from 'vitest';
import { Switcher, type SwitcherProps } from '../../components/switcher/Switcher';
import type { Direction, SwitcherSnapshot } from '../../lib/messages';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

// The Switcher rendered with a snapshot and fake handlers, for the switcher's tests (switcher-*.test.tsx).

export const tab = (id: number, title: string, more: Partial<SwitcherTab> = {}): SwitcherTab => ({
  id,
  windowId: 1,
  title,
  url: `https://example.com/${id}`,
  pinned: false,
  audible: false,
  sleeping: false,
  incognito: false,
  lastAccessed: 1000 - id,
  ...more,
});

export const tabs = [tab(1, 'Pull request #12'), tab(2, 'Inbox (3)'), tab(3, 'Q4 planning'), tab(4, 'Running plan')];

/** So many tabs, named "Tab 1", "Tab 2"… */
export const manyTabs = (count: number) => Array.from({ length: count }, (_, i) => tab(i + 1, `Tab ${i + 1}`));

let disposeLast: (() => void) | undefined;

/** Removes the switcher shown last: call it in afterEach. */
export function closeAll(): void {
  disposeLast?.();
  disposeLast = undefined;
  document.body.innerHTML = '';
}

export function openSwitcher(settings: Partial<Settings> = {}, more: Partial<SwitcherSnapshot & SwitcherProps> = {}) {
  disposeLast?.();
  const snapshot: SwitcherSnapshot = {
    tabs,
    settings: { ...defaultSettings, delayMs: 0, ...settings },
    direction: 'next',
    fromIcon: false,
    waitForPicture: false,
    ...more,
  };
  const [moves, setMoves] = createSignal<{ direction: Direction; count: number }>({ direction: 'next', count: 0 });
  const [previews, setPreviews] = createSignal<Record<number, string>>({});
  const handlers = {
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCloseTab: vi.fn(),
    onSettings: vi.fn(),
    onSettingsChange: vi.fn(),
    onFrame: vi.fn(),
  };
  const host = document.createElement('div');
  document.body.append(host);
  disposeLast = render(
    () => (
      <Switcher
        snapshot={snapshot}
        moves={moves}
        canSeeRelease={more.canSeeRelease ?? true}
        previews={previews}
        pictureTaken={() => false}
        {...handlers}
      />
    ),
    host,
  );
  const press = (key: string, type: 'keydown' | 'keyup' = 'keydown') =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  const move = (direction: Direction) => setMoves((m) => ({ direction, count: m.count + 1 }));
  return { host, handlers, press, move, setPreviews, snapshot };
}

export const options = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[role="option"]')];
export const names = (host: HTMLElement) => options(host).map((option) => option.getAttribute('aria-label'));
export const option = (host: HTMLElement, name: string) =>
  host.querySelector(`[role="option"][aria-label="${name}"]`) as HTMLElement;
export const selectedName = (host: HTMLElement) =>
  host.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('aria-label');
export const listbox = (host: HTMLElement) => host.querySelector('[role="listbox"]') as HTMLElement;
export const searchField = (host: HTMLElement) =>
  host.querySelector('input[aria-label="Search tabs"]') as HTMLInputElement;
export const button = (host: HTMLElement, name: string) =>
  host.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
/** The panel: the box around the toolbar and the tabs. */
export const panel = (host: HTMLElement) => (host.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
export const columnsShown = (host: HTMLElement) =>
  getComputedStyle(listbox(host)).gridTemplateColumns.split(' ').length;

/** Clicks the search field and types `text` in it, as the user does. */
export function typeInSearch(host: HTMLElement, text: string): void {
  const field = searchField(host);
  field.focus();
  field.value = text;
  field.dispatchEvent(new InputEvent('input', { bubbles: true }));
}
