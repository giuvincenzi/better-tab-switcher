import type { Settings } from '../settings/settings';

/**
 * The switcher's sizes in em of its root, whose font size is the user's text size in Chrome (16 px by default):
 * written once, the components draw it with them (as CSS variables, em()), so it grows with the user's text size.
 */
export const sizes = {
  list: { padding: 0.5, row: 3 },
  compactList: { padding: 0.375, row: 2.25 },
  /**
   * The list's width: its share of the page (%), between min and max (500 and 1000 px at the default text size), never
   * wider than the page. min is also the narrowest the grid ever is (then its tiles are in the middle).
   */
  listWidth: { share: 40, min: 31.25, max: 62.5 },
  /** The grid is as wide as its columns, never wider than this share of the page (%). */
  gridMaxShare: 85,
  /** Between two rows or two tiles. */
  gap: 0.125,
  /**
   * A tile: its border and padding, its title line, the space between its lines, and the line of the address or of
   * the last used time (each one when it is on).
   */
  grid: {
    padding: 0.875,
    tileGap: 0.5,
    tileBorder: 0.125,
    tilePadding: 0.5,
    tileHeader: 1.375,
    tileSpace: 0.375,
    tileLine: 0.875,
  },
  /** The grid of icons: a square cell per tab, the site's icon in its middle. */
  icons: { cell: 5, gap: 0.375 },
  /** The toolbar's search field is never wider than this: in a wide switcher it stays in the middle. */
  searchMaxWidth: 35,
  /** The space the switcher leaves around itself, inside the page. */
  margin: 1,
  /** The preview in a tile. */
  preview: { width: 11.75, height: 7.375 },
} as const;

/** A size of the switcher for its CSS: so many em of its root (--bts-em, components/ui/emUnit.ts). */
export function em(value: number): string {
  return `calc(${value} * var(--bts-em))`;
}

/** An em in pixels at Chrome's default text size: until the switcher is in the page and can measure its own. */
export const DEFAULT_EM_PX = 16;

/**
 * The pictures of the tabs are this many pixels wide: the preview's width at the default text size on a screen with
 * twice the pixels. A picture's own size, in pixels: not a size of the UI.
 */
export const PICTURE_WIDTH = sizes.preview.width * DEFAULT_EM_PX * 2;

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
export const ADDRESS_TUCK = 0.25;

/**
 * The grid's columns: about as many as its rows, so that the tiles make a rectangle a little wider than tall (4 tabs:
 * 2 by 2, 12 tabs: 4 by 3, 30 tabs: 6 by 5); never more than fit in its share of the page, nor more than the tabs. The
 * page's width is in pixels, and so is an em of the switcher (emPx): the user's text size. The grid's height is the
 * CSS's: never taller than the page, then it scrolls.
 */
export function gridColumns(settings: Settings, count: number, pageWidth: number, emPx: number): number {
  const { cell, gap } = settings.gridShow === 'icons' ? sizes.icons : { cell: tileWidth, gap: sizes.grid.tileGap };
  const page = pageWidth / emPx;
  const room = Math.min((page * sizes.gridMaxShare) / 100, page - 2 * sizes.margin) - 2 * sizes.grid.padding;
  const fit = Math.floor((room + gap) / (cell + gap));
  return Math.max(1, Math.min(count, fit, Math.ceil(Math.sqrt(count))));
}

/** The list's rows shown before it scrolls: the setting's, or all of them to fit the page (then it scrolls). */
export function listRows(settings: Settings, count: number): number | undefined {
  return settings.listRows === 'fit' ? undefined : Math.max(1, Math.min(settings.listRows, count));
}
