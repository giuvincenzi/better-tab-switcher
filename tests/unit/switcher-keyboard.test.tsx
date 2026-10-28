import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { defaultSettings } from '../../lib/settings/settings';
import { DEFAULT_EM_PX, gridColumns } from '../../lib/switcher/sizes';
import {
  button,
  closeAll,
  columnsShown,
  listbox,
  manyTabs,
  names,
  openSwitcher,
  options,
  searchField,
  selectedName,
  tab,
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

describe('Switcher keyboard in the list', () => {
  it('selects the last tab when opened going back', () => {
    const { host } = openSwitcher({}, { direction: 'previous' });
    expect(selectedName(host)).toBe('Running plan');
  });

  it('selects the only tab when there is one, and opens it on release', () => {
    const { host, press, handlers } = openSwitcher({}, { tabs: [tabs[0] as (typeof tabs)[0]] });
    expect(selectedName(host)).toBe('Pull request #12');
    press('Alt', 'keyup');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[0]);
  });

  it('goes round: down from the last tab to the first, up from the first to the last', () => {
    const { host, press } = openSwitcher({}, { direction: 'previous' });
    press('ArrowDown');
    expect(selectedName(host)).toBe('Pull request #12');
    press('ArrowUp');
    expect(selectedName(host)).toBe('Running plan');
  });

  it('ignores left and right in the list', () => {
    const { host, press } = openSwitcher();
    press('ArrowRight');
    press('ArrowLeft');
    expect(selectedName(host)).toBe('Inbox (3)');
  });

  it('ignores the release of Shift, which goes back with Alt held', () => {
    const { press, handlers } = openSwitcher();
    press('Shift', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('keeps the selected tab in sight when it is below the rows shown', () => {
    const { host } = openSwitcher({ listRows: 6 }, { tabs: manyTabs(30), direction: 'previous' });
    const list = listbox(host).getBoundingClientRect();
    const selected = host.querySelector('[aria-selected="true"]') as HTMLElement;
    expect(selected.getAttribute('aria-label')).toBe('Tab 30');
    const row = selected.getBoundingClientRect();
    expect(row.top).toBeGreaterThanOrEqual(list.top);
    expect(row.bottom).toBeLessThanOrEqual(list.bottom + 0.5);
  });

  it('points screen readers to the selected tab as it moves', () => {
    const { host, press } = openSwitcher();
    const list = listbox(host);
    const selectedId = () => (host.querySelector('[aria-selected="true"]') as HTMLElement).id;
    expect(list.getAttribute('aria-activedescendant')).toBe(selectedId());
    press('ArrowDown');
    expect(list.getAttribute('aria-activedescendant')).toBe(selectedId());
    expect(list.getAttribute('aria-label')).toBe('Open tabs, most recent first');
  });
});

describe('Switcher keyboard while searching', () => {
  it('selects the search field while typing: no tab is selected and the field has the focus', () => {
    const { host } = openSwitcher();
    typeInSearch(host, 'plan');
    expect(selectedName(host)).toBeUndefined();
    expect(document.activeElement).toBe(searchField(host));
    expect(listbox(host).hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('opens the first match with Enter in the search field', () => {
    const { host, press, handlers } = openSwitcher();
    typeInSearch(host, 'plan');
    press('Enter');
    expect(handlers.onOpen).toHaveBeenCalledWith(tabs[2]);
  });

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
    expect(selectedName(host)).toBe('Q4 planning');
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

  it('stays open when Alt is released while searching', () => {
    const { host, press, handlers } = openSwitcher();
    typeInSearch(host, 'plan');
    press('ArrowDown');
    press('Alt', 'keyup');
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('shows every tab again when the search is cleared', () => {
    const { host } = openSwitcher();
    typeInSearch(host, 'plan');
    typeInSearch(host, '');
    expect(names(host)).toEqual(tabs.map((t) => t.title));
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

describe('Switcher keyboard in the grid', () => {
  // Five tabs in three columns: a full row of three, then a row of two.
  const five = [tab(1, 'A'), tab(2, 'B'), tab(3, 'C'), tab(4, 'D'), tab(5, 'E')];
  const gridSettings = { ...defaultSettings, view: 'grid' as const };

  async function openFive() {
    await page.viewport(1280, 800);
    expect(gridColumns(gridSettings, five.length, window.innerWidth, DEFAULT_EM_PX)).toBe(3);
    const opened = openSwitcher({ view: 'grid' }, { tabs: five });
    expect(columnsShown(opened.host)).toBe(3);
    return opened;
  }

  it('stays put going down where the last row has no tab under it', async () => {
    const { host, press } = await openFive();
    press('ArrowRight');
    expect(selectedName(host)).toBe('C');
    press('ArrowDown');
    expect(selectedName(host)).toBe('C');
  });

  it('goes down onto the shorter last row, then no further', async () => {
    const { host, press } = await openFive();
    press('ArrowDown');
    expect(selectedName(host)).toBe('E');
    press('ArrowDown');
    expect(selectedName(host)).toBe('E');
    press('ArrowUp');
    expect(selectedName(host)).toBe('B');
  });

  it('stays in the first row going up, when not searching', async () => {
    const { host, press } = await openFive();
    press('ArrowUp');
    expect(selectedName(host)).toBe('B');
  });

  it('goes up from the first row to the search field while searching', async () => {
    const { host, press } = await openFive();
    typeInSearch(host, ' ');
    press('ArrowDown');
    expect(selectedName(host)).toBe('B');
    press('ArrowUp');
    expect(selectedName(host)).toBeUndefined();
    expect(document.activeElement).toBe(searchField(host));
  });

  it('goes on to the next row with right at the end of a row, and round from the last tab to the first', async () => {
    const { host, press } = await openFive();
    press('ArrowRight');
    press('ArrowRight');
    expect(selectedName(host)).toBe('D');
    press('ArrowRight');
    press('ArrowRight');
    expect(selectedName(host)).toBe('A');
    press('ArrowLeft');
    expect(selectedName(host)).toBe('E');
  });

  it("moves a whole row of the grid's columns in the grid of icons too", async () => {
    await page.viewport(1280, 800);
    const many = manyTabs(12);
    const iconSettings = { ...defaultSettings, view: 'grid' as const, gridShow: 'icons' as const };
    const columns = gridColumns(iconSettings, many.length, window.innerWidth, DEFAULT_EM_PX);
    const { host, press } = openSwitcher({ view: 'grid', gridShow: 'icons' }, { tabs: many });
    expect(columnsShown(host)).toBe(columns);
    press('ArrowDown');
    expect(selectedName(host)).toBe(`Tab ${2 + columns}`);
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
    expect(selectedName(host)).toBe('Inbox (3)');
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
    expect(selectedName(host)).toBe('Inbox (3)');
    press('ArrowLeft');
    expect(selectedName(host)).toBe('Pull request #12');
  });
});
