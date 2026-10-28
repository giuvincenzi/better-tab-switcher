import { describe, expect, it } from 'vitest';
import { FIELD, type Start, type SwitcherEvent, start, step } from '../../lib/switcher/machine';

const list: Start = { count: 5, stayOpen: false, direction: 'next' };
const openSearch = { type: 'openSearch' } as const;

function run(from: Start, ...events: SwitcherEvent[]) {
  let current = { state: start(from) } as ReturnType<typeof step>;
  for (const event of events) current = step(current.state, event);
  return current;
}

/** The user clicked the search field. */
function searching(from: Start, ...events: SwitcherEvent[]) {
  return run(from, openSearch, ...events);
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

  it('never starts on the search field', () => {
    expect(start(list)).toMatchObject({ selected: 1, searching: false });
  });
});

describe('moving', () => {
  it('moves forward and back, going round', () => {
    expect(run(list, { type: 'next' }).state.selected).toBe(2);
    expect(run(list, { type: 'next' }, { type: 'next' }, { type: 'next' }, { type: 'next' }).state.selected).toBe(0);
    expect(run(list, { type: 'previous' }, { type: 'previous' }).state.selected).toBe(4);
  });

  it('never passes through the search field before the user searches', () => {
    expect(run(list, { type: 'previous' }, { type: 'previous' }).state.selected).toBe(4);
  });

  it('starts searching from a click on the search field: selected, and the switcher stays open', () => {
    const state = searching(list).state;
    expect(state).toMatchObject({ searching: true, stayOpen: true, selected: FIELD });
    expect(step(state, { type: 'release' }).effect).toBeUndefined();
  });

  it('goes from the search field to the previous tab, or to the first result once something is typed', () => {
    expect(searching(list, { type: 'next' }).state.selected).toBe(1);
    expect(searching(list, { type: 'results', count: 2, filtered: true }, { type: 'next' }).state.selected).toBe(0);
  });

  it('passes through the search field going round, while searching', () => {
    expect(searching(list, { type: 'previous' }).state.selected).toBe(4);
    const lastTab = searching(list, { type: 'previous' }).state;
    expect(step(lastTab, { type: 'next' }).state.selected).toBe(FIELD);
    const firstTab = searching(list, { type: 'results', count: 2, filtered: true }, { type: 'next' }).state;
    expect(step(firstTab, { type: 'previous' }).state.selected).toBe(FIELD);
  });

  it('never passes through the search field when the user only works in the switcher (no search)', () => {
    expect(run(list, { type: 'hold' }, { type: 'previous' }, { type: 'previous' }).state.selected).toBe(4);
    const last = run(list, { type: 'hold' }, { type: 'previous' }, { type: 'previous' }).state;
    expect(step(last, { type: 'next' }).state.selected).toBe(0);
  });

  it('selects the search field again when what was typed changes the tabs shown', () => {
    const typed = { type: 'results', count: 2, filtered: true } as const;
    const state = searching(list, { type: 'next' }, { type: 'next' }, typed).state;
    expect(state).toMatchObject({ count: 2, selected: FIELD, filtered: true });
  });

  it('goes from the search field to the previous tab again once what was typed is erased', () => {
    const typed = { type: 'results', count: 2, filtered: true } as const;
    const erased = { type: 'results', count: 5, filtered: false } as const;
    expect(searching(list, typed, erased, { type: 'next' }).state.selected).toBe(1);
  });

  it('stays on the search field when nothing matches', () => {
    const typed = { type: 'results', count: 0, filtered: true } as const;
    expect(searching(list, typed, { type: 'next' }).state.selected).toBe(FIELD);
  });
});

describe('moving in the grid', () => {
  const grid: Start = { ...list, count: 12 };

  it('goes up and down a row without going round', () => {
    expect(run(grid, { type: 'jump', by: 5 }).state.selected).toBe(6);
    expect(run(grid, { type: 'jump', by: 5 }, { type: 'jump', by: 5 }).state.selected).toBe(11);
    expect(run(grid, { type: 'jump', by: 5 }, { type: 'jump', by: 5 }, { type: 'jump', by: 5 }).state.selected).toBe(
      11,
    );
    expect(run(grid, { type: 'jump', by: -5 }).state.selected).toBe(1);
  });

  it('goes up from the first row to the search field while searching, and down from it to the tabs', () => {
    expect(searching(grid, { type: 'jump', by: 5 }).state.selected).toBe(1);
    expect(searching(grid, { type: 'jump', by: 5 }, { type: 'jump', by: -5 }).state.selected).toBe(FIELD);
    expect(run(grid, { type: 'jump', by: -5 }).state.selected).toBe(1);
  });

  it('stays on the search field going up from it, and goes down to the first result once something is typed', () => {
    expect(searching(grid, { type: 'jump', by: -5 }).state.selected).toBe(FIELD);
    const typed = { type: 'results', count: 8, filtered: true } as const;
    expect(searching(grid, typed, { type: 'jump', by: 4 }).state.selected).toBe(0);
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

  it('stays open on release once the user works in it (its Display menu)', () => {
    expect(run(list, { type: 'hold' }, { type: 'release' }).effect).toBeUndefined();
    expect(run(list, { type: 'hold' }, { type: 'confirm' }).effect).toEqual({ type: 'open', index: 1 });
  });

  it('stays open on release while searching, also on a tab, until Enter or a click', () => {
    expect(searching(list, { type: 'next' }, { type: 'release' }).effect).toBeUndefined();
    expect(searching(list, { type: 'next' }, { type: 'confirm' }).effect).toEqual({ type: 'open', index: 1 });
  });

  it('opens the first result on Enter in the search field', () => {
    const typed = { type: 'results', count: 3, filtered: true } as const;
    expect(searching(list, typed, { type: 'confirm' }).effect).toEqual({ type: 'open', index: 0 });
    const none = { type: 'results', count: 0, filtered: true } as const;
    expect(searching(list, none, { type: 'confirm' }).effect).toBeUndefined();
  });

  it('opens the selected tab when the auto-select line runs out, never from the search field', () => {
    expect(run(list, { type: 'next' }, { type: 'autoSelect' }).effect).toEqual({ type: 'open', index: 2 });
    expect(searching(list, { type: 'autoSelect' }).effect).toBeUndefined();
  });

  it('ignores a click outside the tabs shown', () => {
    expect(run(list, { type: 'choose', index: 9 }).effect).toBeUndefined();
  });

  it('opens a clicked tab from the first to the last, and ignores one past the last or the search field', () => {
    expect(run(list, { type: 'choose', index: 0 }).effect).toEqual({ type: 'open', index: 0 });
    expect(run(list, { type: 'choose', index: 4 }).effect).toEqual({ type: 'open', index: 4 });
    expect(run(list, { type: 'choose', index: 5 }).effect).toBeUndefined();
    expect(run(list, { type: 'choose', index: FIELD }).effect).toBeUndefined();
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

  it('closes on Esc also while searching or with Stay open', () => {
    expect(searching(list, { type: 'cancel' }).effect).toEqual({ type: 'close' });
    expect(run({ ...list, stayOpen: true }, { type: 'cancel' }).effect).toEqual({ type: 'close' });
  });

  it('keeps the same tab selected when a tab below it is closed', () => {
    const state = run(list, { type: 'next' }, { type: 'removed', index: 4 }).state;
    expect(state).toMatchObject({ count: 4, selected: 2 });
  });

  it('stays open on the search field when the last result is closed while searching', () => {
    const typed = { type: 'results', count: 1, filtered: true } as const;
    const fromField = searching(list, typed, { type: 'removed', index: 0 });
    expect(fromField.effect).toBeUndefined();
    expect(fromField.state).toMatchObject({ count: 0, selected: FIELD });
    const fromTab = searching(list, typed, { type: 'next' }, { type: 'removed', index: 0 });
    expect(fromTab.effect).toBeUndefined();
    expect(fromTab.state).toMatchObject({ count: 0, selected: FIELD });
  });
});

describe('state', () => {
  it('never changes the state it is given', () => {
    const events: SwitcherEvent[] = [
      { type: 'next' },
      { type: 'previous' },
      { type: 'release' },
      { type: 'confirm' },
      { type: 'cancel' },
      { type: 'jump', by: 5 },
      { type: 'choose', index: 2 },
      { type: 'autoSelect' },
      { type: 'results', count: 2, filtered: true },
      { type: 'removed', index: 0 },
      { type: 'openSearch' },
      { type: 'hold' },
    ];
    for (const event of events) {
      const state = Object.freeze(start(list));
      const before = { ...state };
      step(state, event);
      expect(state, event.type).toEqual(before);
    }
  });
});
