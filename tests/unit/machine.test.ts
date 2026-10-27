import { describe, expect, it } from 'vitest';
import { FIELD, type Start, type SwitcherEvent, start, step } from '../../lib/switcher/machine';

const list: Start = { count: 5, hasField: false, stayOpen: false, direction: 'next' };
const withSearch: Start = { ...list, hasField: true };

function run(from: Start, ...events: SwitcherEvent[]) {
  let current = { state: start(from) } as ReturnType<typeof step>;
  for (const event of events) current = step(current.state, event);
  return current;
}

describe('opening', () => {
  it('selects the previous tab going forward (the current one is first)', () => {
    expect(start(list).selected).toBe(1);
  });

  it('selects the last tab going back', () => {
    expect(start({ ...list, direction: 'previous' }).selected).toBe(4);
  });

  it('selects the only tab when there is one', () => {
    expect(start({ ...list, count: 1 }).selected).toBe(0);
    expect(start({ ...list, count: 1, direction: 'previous' }).selected).toBe(0);
  });

  it('selects the search field when there is one', () => {
    expect(start(withSearch).selected).toBe(FIELD);
  });
});

describe('moving', () => {
  it('moves forward and back, going round', () => {
    expect(run(list, { type: 'next' }).state.selected).toBe(2);
    expect(run(list, { type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' }).state.selected).toBe(0);
    expect(run(list, { type: 'previous' }, { type: 'previous' }).state.selected).toBe(4);
  });

  it('goes from the search field to the previous tab, or to the first result once something is typed', () => {
    expect(run(withSearch, { type: 'next' }).state.selected).toBe(1);
    expect(run(withSearch, { type: 'results', count: 2, filtered: true }, { type: 'next' }).state.selected).toBe(0);
  });

  it('passes through the search field going round', () => {
    expect(run(withSearch, { type: 'previous' }).state.selected).toBe(4);
    const lastTab = run(withSearch, { type: 'previous' }).state;
    expect(step(lastTab, { type: 'next' }).state.selected).toBe(FIELD);
    const firstTab = run(withSearch, { type: 'results', count: 2, filtered: true }, { type: 'next' }).state;
    expect(step(firstTab, { type: 'previous' }).state.selected).toBe(FIELD);
  });

  it('stays on the search field when nothing matches', () => {
    expect(run(withSearch, { type: 'results', count: 0, filtered: true }, { type: 'next' }).state.selected).toBe(FIELD);
  });
});

describe('opening a tab', () => {
  it('opens the selected tab when Alt is released', () => {
    expect(run(list, { type: 'next' }, { type: 'release' }).effect).toEqual({ type: 'open', index: 2 });
  });

  it('opens the previous tab on a quick tap (released right away)', () => {
    expect(run(list, { type: 'release' }).effect).toEqual({ type: 'open', index: 1 });
  });

  it('stays open on release with Stay open, until Enter or a click', () => {
    const stay = { ...list, stayOpen: true };
    expect(run(stay, { type: 'release' }).effect).toBeUndefined();
    expect(run(stay, { type: 'release' }, { type: 'confirm' }).effect).toEqual({ type: 'open', index: 1 });
    expect(run(stay, { type: 'release' }, { type: 'choose', index: 3 }).effect).toEqual({ type: 'open', index: 3 });
  });

  it('stays open on release while the search field is selected', () => {
    expect(run(withSearch, { type: 'release' }).effect).toBeUndefined();
  });

  it('opens the selected tab on release once Alt+Y moved from the search field to the tabs', () => {
    expect(run(withSearch, { type: 'next' }, { type: 'release' }).effect).toEqual({ type: 'open', index: 1 });
  });

  it('opens the first result on Enter in the search field', () => {
    const typed = { type: 'results', count: 3, filtered: true } as const;
    expect(run(withSearch, typed, { type: 'confirm' }).effect).toEqual({ type: 'open', index: 0 });
    expect(run(withSearch, { type: 'results', count: 0, filtered: true }, { type: 'confirm' }).effect).toBeUndefined();
  });

  it('opens the selected tab when the auto-select line runs out, never from the search field', () => {
    expect(run(list, { type: 'next' }, { type: 'autoSelect' }).effect).toEqual({ type: 'open', index: 2 });
    expect(run(withSearch, { type: 'autoSelect' }).effect).toBeUndefined();
  });

  it('ignores a click outside the tabs shown', () => {
    expect(run(list, { type: 'choose', index: 9 }).effect).toBeUndefined();
  });
});

describe('closing', () => {
  it('closes on Esc', () => {
    expect(run(list, { type: 'cancel' }).effect).toEqual({ type: 'close' });
  });

  it('keeps the same tab selected when a tab above it is closed', () => {
    const state = run(list, { type: 'next' }, { type: 'removed', index: 0 }).state;
    expect(state).toMatchObject({ count: 4, selected: 1 });
  });

  it('keeps the same position when the selected tab is closed, or the one before at the end', () => {
    expect(run(list, { type: 'removed', index: 1 }).state).toMatchObject({ count: 4, selected: 1 });
    const last = run({ ...list, direction: 'previous' }, { type: 'removed', index: 4 }).state;
    expect(last).toMatchObject({ count: 4, selected: 3 });
  });

  it('closes when the last tab shown is closed', () => {
    expect(run({ ...list, count: 1 }, { type: 'removed', index: 0 }).effect).toEqual({ type: 'close' });
  });
});
