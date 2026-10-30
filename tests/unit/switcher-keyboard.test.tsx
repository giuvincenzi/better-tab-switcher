import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import {
  button,
  closeAll,
  listbox,
  openSwitcher,
  options,
  searchField,
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

// What the keys do on the real browser (opening, going round, the search, the grid's rows):
// tests/e2e/switcher.spec.ts, shortcut.spec.ts, tabs.spec.ts, search.spec.ts and grid.spec.ts; the moves themselves:
// tests/unit/machine.test.ts and keys.test.ts.

describe('Switcher keyboard in the list', () => {
  it('ignores the release of Shift, which goes back with Alt held', () => {
    const { press, handlers } = openSwitcher();
    press('Shift', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('points screen readers to the selected tab as it moves, and to none while the search field is selected', () => {
    const { host, press } = openSwitcher();
    const list = listbox(host);
    const selectedId = () => (host.querySelector('[aria-selected="true"]') as HTMLElement).id;
    expect(list.getAttribute('aria-activedescendant')).toBe(selectedId());
    press('ArrowDown');
    expect(list.getAttribute('aria-activedescendant')).toBe(selectedId());
    expect(list.getAttribute('aria-label')).toBe('Open tabs, most recent first');
    typeInSearch(host, 'plan');
    expect(list.hasAttribute('aria-activedescendant')).toBe(false);
  });
});

describe('Switcher keyboard while searching', () => {
  it('leaves Enter, Esc and the arrows to text being composed in the search field (Japanese, Chinese, Korean)', () => {
    const { host, press, handlers } = openSwitcher();
    typeInSearch(host, 'plan');
    for (const key of ['Enter', 'Escape', 'ArrowDown']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true }));
    }
    expect(handlers.onOpen).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
    press('Enter');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[2]);
  });

  it('goes from the search field down to the first match, and back up to the field', () => {
    const { host, press } = openSwitcher();
    typeInSearch(host, 'plan');
    press('ArrowDown');
    expect(selectedName(host)).toBe('Q4 planning, example.com/3');
    expect(document.activeElement).toBe(listbox(host));
    press('ArrowUp');
    expect(selectedName(host)).toBeUndefined();
    expect(document.activeElement).toBe(searchField(host));
  });

  it('does nothing on Enter when nothing matches', () => {
    const { host, press, handlers } = openSwitcher();
    typeInSearch(host, 'passport');
    press('Enter');
    expect(handlers.onOpen).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it('leaves left and right to the search field in the grid', () => {
    const { host, press } = openSwitcher({ view: 'grid' });
    typeInSearch(host, 'plan');
    press('ArrowRight');
    expect(selectedName(host)).toBeUndefined();
    press('ArrowLeft');
    expect(selectedName(host)).toBeUndefined();
  });
});

describe('Switcher keyboard in the toolbar', () => {
  const keyOn = (target: HTMLElement, key: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));

  it("leaves the arrows and Enter to a toolbar button reached with Tab: the tabs don't move", () => {
    const { host, handlers } = openSwitcher();
    const compact = button(host, 'Compact');
    compact.focus();
    keyOn(compact, 'ArrowDown');
    keyOn(compact, 'Enter');
    expect(selectedName(host)).toBe('Inbox (3), example.com/2');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('still closes on Esc from a toolbar button', () => {
    const { host, handlers } = openSwitcher();
    const settingsButton = button(host, 'All settings');
    settingsButton.focus();
    keyOn(settingsButton, 'Escape');
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it('keeps the tabs selected after the view is changed, and the keys working on them', () => {
    const { host, press } = openSwitcher();
    (host.querySelector('input[type="radio"][value="grid"]') as HTMLInputElement).click();
    expect(options(host)).toHaveLength(4);
    expect(selectedName(host)).toBe('Inbox (3), example.com/2');
    press('ArrowLeft');
    expect(selectedName(host)).toBe('Pull request #12, example.com/1');
  });
});
