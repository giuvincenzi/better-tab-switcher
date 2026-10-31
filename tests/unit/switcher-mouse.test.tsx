import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  autoSelectLine,
  button,
  closeAll,
  names,
  openSwitcher,
  option,
  selectedName,
  tabs,
  typeInSearch,
} from './switcher-harness';

// Every test starts on the same page size, also when it runs alone.
beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  closeAll();
  await page.viewport(1280, 800);
});

// What the mouse does on the real browser (opening a tab, pressing inside the switcher, closing tabs with the middle
// button or the close button, the selection after a tab is closed, Auto-select): tests/e2e/switcher.spec.ts,
// tabs.spec.ts, grid.spec.ts, search.spec.ts and switching.spec.ts; the selection itself: tests/unit/machine.test.ts.

describe('Switcher with the mouse', () => {
  it("keeps the browser's auto-scroll from starting on a middle press over a tab, never on a left press", () => {
    const { host } = openSwitcher();
    const middle = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });
    const left = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
    option(host, 'Q4 planning, example.com/3').dispatchEvent(middle);
    option(host, 'Q4 planning, example.com/3').dispatchEvent(left);
    expect(middle.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
  });

  it('shows the close button only under the mouse', async () => {
    const { host } = openSwitcher();
    const row = option(host, 'Q4 planning, example.com/3');
    const close = row.querySelector('button[aria-label="Close tab"]') as HTMLElement;
    expect(getComputedStyle(close).visibility).toBe('hidden');
    await userEvent.hover(row);
    expect(getComputedStyle(close).visibility).toBe('visible');
  });

  it('shows the close button only under the mouse, in the grid', async () => {
    const { host } = openSwitcher({ view: 'grid' });
    const tile = option(host, 'Q4 planning, example.com/3');
    const close = tile.querySelector('button[aria-label="Close tab"]') as HTMLElement;
    expect(getComputedStyle(close).visibility).toBe('hidden');
    await userEvent.hover(tile);
    expect(getComputedStyle(close).visibility).toBe('visible');
  });
});

describe('Switcher closing tabs', () => {
  const closeButton = (host: HTMLElement, name: string) =>
    option(host, name).querySelector('button[aria-label="Close tab"]') as HTMLButtonElement;

  it('closes a tab from the search results, leaving the other matches', () => {
    const { host, handlers } = openSwitcher();
    typeInSearch(host, 'plan');
    closeButton(host, 'Running plan, example.com/4').click();
    expect(handlers.onCloseTab).toHaveBeenCalledWith(tabs[3], expect.anything());
    expect(names(host)).toEqual(['Q4 planning, example.com/3']);
  });
});

describe('Switcher auto-select', () => {
  /** The auto-select line's animation, on the selected tab. */
  const line = (host: HTMLElement) =>
    autoSelectLine(host.querySelector('[aria-selected="true"]') as HTMLElement) as Animation;

  it('runs no line with Auto-select off', () => {
    const { host } = openSwitcher({ autoSelect: false });
    expect(autoSelectLine(host.querySelector('[aria-selected="true"]') as HTMLElement)).toBeUndefined();
  });

  it('starts the line again when the mouse moves onto another tab, not onto the selected one', () => {
    const { host } = openSwitcher({ autoSelect: true, autoSelectSeconds: 10 });
    const animation = line(host);
    animation.currentTime = 4000;
    option(host, 'Inbox (3), example.com/2').dispatchEvent(new PointerEvent('pointerenter'));
    expect(Number(animation.currentTime)).toBeGreaterThanOrEqual(4000);
    option(host, 'Q4 planning, example.com/3').dispatchEvent(new PointerEvent('pointerenter'));
    expect(Number(animation.currentTime)).toBeLessThan(1000);
  });

  it('moves the line with the selection', () => {
    const { host, press } = openSwitcher({ autoSelect: true, autoSelectSeconds: 10 });
    press('ArrowDown');
    expect(selectedName(host)).toBe('Q4 planning, example.com/3');
    expect(line(host)).toBeDefined();
    expect(autoSelectLine(option(host, 'Inbox (3), example.com/2'))).toBeUndefined();
  });

  it('stops while the search field is selected', () => {
    const { host } = openSwitcher({ autoSelect: true, autoSelectSeconds: 10 });
    typeInSearch(host, 'plan');
    expect(host.querySelector('[role="listbox"]')?.getAnimations({ subtree: true })).toEqual([]);
  });

  it('keeps the switcher open after a toolbar button, but auto-select still opens the selected tab', async () => {
    const { host, handlers, press } = openSwitcher({ autoSelect: true, autoSelectSeconds: 0.2 });
    button(host, 'Compact').click();
    press('Alt', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
    await expect.poll(() => handlers.onOpen.mock.calls.length).toBe(1);
  });
});
