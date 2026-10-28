import type { Settings } from '../settings/settings';

/** The switcher's sizes in px, written once: the components draw it with them (as CSS variables). */
export const sizes = {
  list: { padding: 8, row: 48 },
  compactList: { padding: 6, row: 36 },
  /**
   * The list's width: a share of the page's width (%), never narrower than minWidth, nor wider than the page. Medium is
   * also the narrowest the switcher ever is, in every view.
   */
  listWidth: { medium: 50, large: 80, minWidth: 360 },
  /** Between two rows or two tiles. */
  gap: 2,
  /**
   * A tile: its border and padding, its title line, the space between its lines, and the line of the address or of
   * the last used time (each one when it is on).
   */
  grid: { padding: 14, tileGap: 8, tileBorder: 2, tilePadding: 8, tileHeader: 22, tileSpace: 6, tileLine: 14 },
  /** The grid of icons: a square cell per tab, the site's icon in its middle. */
  icons: { cell: 80, gap: 6 },
  /** The toolbar's search field is never wider than this: in a wide switcher it stays in the middle. */
  searchMaxWidth: 560,
  /** The space the switcher leaves around itself, inside the page. */
  margin: 16,
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

/**
 * The grid's columns: as many tiles (or icons) as fit across the page, fewer when there are fewer tabs. The grid's
 * height is the CSS's: never taller than the page, then it scrolls.
 */
export function gridColumns(settings: Settings, count: number, pageWidth: number): number {
  const { cell, gap } = settings.gridShow === 'icons' ? sizes.icons : { cell: tileWidth, gap: sizes.grid.tileGap };
  const room = pageWidth - 2 * (sizes.margin + sizes.grid.padding);
  return Math.max(1, Math.min(count, Math.floor((room + gap) / (cell + gap))));
}

/** The list's rows shown before it scrolls: the setting's, or all of them to fit the page (then it scrolls). */
export function listRows(settings: Settings, count: number): number | undefined {
  return settings.listRows === 'fit' ? undefined : Math.max(1, Math.min(settings.listRows, count));
}
