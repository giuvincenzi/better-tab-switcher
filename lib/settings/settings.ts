export type Theme = 'device' | 'light' | 'dark';
export type View = 'list' | 'grid';
export type Scope = 'window' | 'all';
export type LongAddress = 'cut' | 'scroll';
/** A number of rows, or every row that fits on the screen. */
export type RowCount = number | 'all';

export interface TabDetails {
  address: boolean;
  longAddress: LongAddress;
  pinnedIcon: boolean;
  audioIcon: boolean;
  sleeping: boolean;
  groupColor: boolean;
  lastUsed: boolean;
}

export interface Settings {
  theme: Theme;
  view: View;
  compact: boolean;
  listRows: RowCount;
  gridColumns: number;
  gridRows: RowCount;
  previews: boolean;
  scope: Scope;
  showPinned: boolean;
  delayMs: number;
  stayOpen: boolean;
  autoSelect: boolean;
  autoSelectSeconds: number;
  search: boolean;
  details: TabDetails;
}

export const defaultSettings: Readonly<Settings> = Object.freeze({
  theme: 'device',
  view: 'list',
  compact: false,
  listRows: 6,
  gridColumns: 5,
  gridRows: 3,
  previews: true,
  scope: 'window',
  showPinned: true,
  delayMs: 50,
  stayOpen: false,
  autoSelect: false,
  autoSelectSeconds: 3,
  search: false,
  details: Object.freeze({
    address: false,
    longAddress: 'cut',
    pinnedIcon: true,
    audioIcon: true,
    sleeping: true,
    groupColor: true,
    lastUsed: false,
  }),
});

/** The values each number setting accepts. */
export const limits = Object.freeze({
  listRows: { min: 1, max: 30 },
  gridColumns: { min: 1, max: 8 },
  gridRows: { min: 1, max: 10 },
  delayMs: { min: 0, max: 1000 },
  autoSelectSeconds: { min: 1, max: 10 },
});

type Range = { min: number; max: number };

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function whole(value: unknown, range: Range, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= range.min && (value as number) <= range.max
    ? (value as number)
    : fallback;
}

function rows(value: unknown, range: Range, fallback: RowCount): RowCount {
  return value === 'all' ? 'all' : whole(value, range, fallback === 'all' ? range.max : fallback);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Reads settings saved by any version: a value this version doesn't know, or a damaged one, gives that setting its
 * default instead of failing all the settings.
 */
export function parseSettings(value: unknown): Settings {
  const saved = record(value);
  const details = record(saved.details);
  const d = defaultSettings;
  return {
    theme: oneOf(saved.theme, ['device', 'light', 'dark'], d.theme),
    view: oneOf(saved.view, ['list', 'grid'], d.view),
    compact: flag(saved.compact, d.compact),
    listRows: rows(saved.listRows, limits.listRows, d.listRows),
    gridColumns: whole(saved.gridColumns, limits.gridColumns, d.gridColumns),
    gridRows: rows(saved.gridRows, limits.gridRows, d.gridRows),
    previews: flag(saved.previews, d.previews),
    scope: oneOf(saved.scope, ['window', 'all'], d.scope),
    showPinned: flag(saved.showPinned, d.showPinned),
    delayMs: whole(saved.delayMs, limits.delayMs, d.delayMs),
    stayOpen: flag(saved.stayOpen, d.stayOpen),
    autoSelect: flag(saved.autoSelect, d.autoSelect),
    autoSelectSeconds: whole(saved.autoSelectSeconds, limits.autoSelectSeconds, d.autoSelectSeconds),
    search: flag(saved.search, d.search),
    details: {
      address: flag(details.address, d.details.address),
      longAddress: oneOf(details.longAddress, ['cut', 'scroll'], d.details.longAddress),
      pinnedIcon: flag(details.pinnedIcon, d.details.pinnedIcon),
      audioIcon: flag(details.audioIcon, d.details.audioIcon),
      sleeping: flag(details.sleeping, d.details.sleeping),
      groupColor: flag(details.groupColor, d.details.groupColor),
      lastUsed: flag(details.lastUsed, d.details.lastUsed),
    },
  };
}
