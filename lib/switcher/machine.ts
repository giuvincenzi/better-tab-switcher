/**
 * The switcher's rules, without UI: what is selected, and when a tab is opened or the switcher closes. The items are
 * the tabs shown, by index. Once the user starts searching (a click on the search field, or the footer's search
 * button), the search field is one more item before them, at index -1, and the switcher stays open.
 */

/** The search field, as a selected item. */
export const FIELD = -1;

export interface SwitcherState {
  /** How many tabs are shown. */
  count: number;
  /** The selected tab's index, or FIELD. */
  selected: number;
  /** The user is searching: the search field is an item, and the switcher stays open. */
  searching: boolean;
  /** Something is typed in the search field (the tabs shown are the ones that match). */
  filtered: boolean;
  /** Releasing the shortcut's modifier doesn't open the selected tab. */
  stayOpen: boolean;
}

export type SwitcherEvent =
  | { type: 'next' }
  | { type: 'previous' }
  /** The shortcut's modifier (Alt) was released. */
  | { type: 'release' }
  /** Enter. */
  | { type: 'confirm' }
  /** Esc, or a click outside. */
  | { type: 'cancel' }
  /** Up or down a row of the grid: `by` tabs, without going round; up from the first row goes to the search field. */
  | { type: 'jump'; by: number }
  /** A click on a tab. */
  | { type: 'choose'; index: number }
  /** The auto-select line ran out. */
  | { type: 'autoSelect' }
  /** What was typed changed which tabs are shown. */
  | { type: 'results'; count: number; filtered: boolean }
  /** A tab was closed from the switcher. */
  | { type: 'removed'; index: number }
  /** A click on the search field, or the footer's search button: the user starts searching. */
  | { type: 'openSearch' };

export type SwitcherEffect = { type: 'open'; index: number } | { type: 'close' };

export interface Step {
  state: SwitcherState;
  effect?: SwitcherEffect;
}

export interface Start {
  count: number;
  stayOpen: boolean;
  direction: 'next' | 'previous';
}

/**
 * The state when the switcher opens: the previous tab (the current one is first) going forward, or the last one going
 * back. The search field, also when it is shown, is not selected: the user clicks it to search.
 */
export function start({ count, stayOpen, direction }: Start): SwitcherState {
  const selected = direction === 'next' ? Math.min(1, count - 1) : count - 1;
  return { count, selected, searching: false, filtered: false, stayOpen };
}

export function step(state: SwitcherState, event: SwitcherEvent): Step {
  switch (event.type) {
    case 'next':
      return { state: { ...state, selected: following(state, 1) } };
    case 'previous':
      return { state: { ...state, selected: following(state, -1) } };
    case 'jump':
      return { state: { ...state, selected: jumped(state, event.by) } };
    case 'release':
      return state.stayOpen || state.selected === FIELD ? { state } : open(state, state.selected);
    case 'confirm':
      if (state.selected !== FIELD) return open(state, state.selected);
      return state.count > 0 ? open(state, 0) : { state };
    case 'cancel':
      return { state, effect: { type: 'close' } };
    case 'choose':
      return event.index >= 0 && event.index < state.count ? open(state, event.index) : { state };
    case 'autoSelect':
      return state.selected === FIELD ? { state } : open(state, state.selected);
    case 'results':
      return { state: { ...state, count: event.count, filtered: event.filtered, selected: FIELD } };
    case 'removed':
      return removed(state, event.index);
    case 'openSearch':
      return { state: { ...state, searching: true, stayOpen: true, selected: FIELD } };
  }
}

function open(state: SwitcherState, index: number): Step {
  return { state: { ...state, selected: index }, effect: { type: 'open', index } };
}

/** The item after (1) or before (-1) the selected one, going round; the search field is the first item. */
function following(state: SwitcherState, by: 1 | -1): number {
  if (state.count === 0) return state.searching ? FIELD : 0;
  if (state.selected === FIELD) {
    if (by === -1) return state.count - 1;
    return state.filtered ? 0 : Math.min(1, state.count - 1);
  }
  const target = state.selected + by;
  if (target >= state.count) return state.searching ? FIELD : 0;
  if (target < 0) return state.searching ? FIELD : state.count - 1;
  return target;
}

function jumped(state: SwitcherState, by: number): number {
  if (state.selected === FIELD) return by > 0 ? following(state, 1) : FIELD;
  const target = state.selected + by;
  if (target < 0) return state.searching ? FIELD : state.selected;
  return target < state.count ? target : state.selected;
}

function removed(state: SwitcherState, index: number): Step {
  const count = state.count - 1;
  if (count <= 0 && !state.searching) return { state: { ...state, count: 0 }, effect: { type: 'close' } };
  let selected = state.selected;
  if (selected !== FIELD && (selected > index || selected >= count)) selected = Math.max(selected - 1, 0);
  if (count <= 0) selected = FIELD;
  return { state: { ...state, count, selected } };
}
