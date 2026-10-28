import type { Settings } from '../settings/settings';

/** The switcher's sizes in px, written once: the components draw it with them (as CSS variables). */
export const sizes = {
  list: { width: 560, padding: 8, row: 48 },
  compactList: { width: 440, padding: 6, row: 36 },
  /** Between two rows or two tiles. */
  gap: 2,
  /**
   * A tile: its border and padding, its title line, the space between its lines, and the line of the address or of
   * the last used time (each one when it is on).
   */
  grid: { padding: 14, tileGap: 8, tileBorder: 2, tilePadding: 8, tileHeader: 22, tileSpace: 6, tileLine: 14 },
  /** The preview in a tile; pictures are taken twice as big, for screens with twice the pixels. */
  preview: { width: 188, height: 118 },
} as const;

/** The pictures of the tabs are this wide: the preview's width on a screen with twice the pixels. */
export const PICTURE_WIDTH = sizes.preview.width * 2;

const tileFrame = 2 * (sizes.grid.tileBorder + sizes.grid.tilePadding);

export const tileWidth = sizes.preview.width + tileFrame;

/** A tile's height: taller with the address (tucked under the title) and with the last used time. */
export function tileHeight(settings: Settings): number {
  const { tileHeader, tileSpace, tileLine } = sizes.grid;
  const address = settings.details.address ? tileSpace + tileLine - ADDRESS_TUCK : 0;
  const lastUsed = settings.details.lastUsed ? tileSpace + tileLine : 0;
  return tileFrame + tileHeader + tileSpace + sizes.preview.height + address + lastUsed;
}

/** How far the address goes up under the title, in a tile. */
export const ADDRESS_TUCK = 4;

/** The grid's columns: as many as the setting says, fewer when there are fewer tabs. */
export function gridColumns(settings: Settings, count: number): number {
  return Math.max(1, Math.min(settings.gridColumns, count));
}

/** The rows shown before the list or the grid scrolls. */
export function visibleRows(settings: Settings, count: number): number {
  const grid = settings.view === 'grid';
  const all = grid ? Math.ceil(count / gridColumns(settings, count)) : count;
  const setting = grid ? settings.gridRows : settings.listRows;
  return Math.max(1, setting === 'all' ? all : Math.min(setting, all));
}
