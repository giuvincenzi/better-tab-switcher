import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { closeAll, listbox, openSwitcher, typeInSearch } from './switcher-harness';

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
