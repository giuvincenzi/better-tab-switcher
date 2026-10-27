import type { Settings } from '../settings/settings';

/**
 * The switcher's sizes in px, written once: the components draw it with them (as CSS variables) and its own window
 * is made as big as the switcher it shows.
 */
export const sizes = {
  list: { width: 560, padding: 8, row: 48 },
  compactList: { width: 440, padding: 6, row: 36 },
  /** Between two rows or two tiles. */
  gap: 2,
  /** A tile: its title line, and the line with the address or last used time when one of them is on. */
  grid: { padding: 10, tileGap: 8, tilePadding: 6, tileHeader: 28, tileMeta: 18 },
  /** The preview in a tile; pictures are taken twice as big, for screens with twice the pixels. */
  preview: { width: 188, height: 118 },
  searchField: { height: 48, compactHeight: 36, below: 4 },
  footer: { height: 32, compactHeight: 26, above: 5 },
} as const;

/** The pictures of the tabs are this wide: the preview's width on a screen with twice the pixels. */
export const PICTURE_WIDTH = sizes.preview.width * 2;

export const tileWidth = sizes.preview.width + 2 * sizes.grid.tilePadding;

/** A tile's height: taller with the address or the last used time. */
export function tileHeight(settings: Settings): number {
  const meta = hasTileMeta(settings) ? sizes.grid.tileMeta : 0;
  return sizes.grid.tileHeader + meta + sizes.preview.height + 2 * sizes.grid.tilePadding;
}

export function hasTileMeta(settings: Settings): boolean {
  return settings.details.address || settings.details.lastUsed;
}

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

/** The switcher's panel, with every row (or tile row) the settings show for `count` tabs. */
export function switcherSize(settings: Settings, count: number): { width: number; height: number } {
  const compact = settings.view === 'list' && settings.compact;
  const field = settings.search
    ? (compact ? sizes.searchField.compactHeight : sizes.searchField.height) + sizes.searchField.below
    : 0;
  const footer = (compact ? sizes.footer.compactHeight : sizes.footer.height) + sizes.footer.above;
  if (settings.view === 'grid') {
    const columns = gridColumns(settings, count);
    const rows = visibleRows(settings, count);
    const { padding, tileGap } = sizes.grid;
    return {
      width: columns * tileWidth + (columns - 1) * tileGap + 2 * padding,
      height: rows * tileHeight(settings) + (rows - 1) * tileGap + field + footer + 2 * padding,
    };
  }
  const list = compact ? sizes.compactList : sizes.list;
  const rows = visibleRows(settings, count);
  return {
    width: list.width,
    height: rows * (list.row + sizes.gap) + field + footer + 2 * list.padding,
  };
}
