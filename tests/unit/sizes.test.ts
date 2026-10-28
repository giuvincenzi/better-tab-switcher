import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import {
  ADDRESS_TUCK,
  DEFAULT_EM_PX,
  gridColumns,
  listRows,
  sizes,
  tileHeight,
  tileWidth,
} from '../../lib/switcher/sizes';

const settings = (change: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...change });

describe('listRows', () => {
  it('shows the rows the setting says, fewer with fewer tabs', () => {
    expect(listRows(settings({ listRows: 6 }), 20)).toBe(6);
    expect(listRows(settings({ listRows: 6 }), 4)).toBe(4);
  });

  it('leaves the height to the page with Fit the screen', () => {
    expect(listRows(settings({ listRows: 'fit' }), 20)).toBeUndefined();
  });

  it('keeps one row with no tabs', () => {
    expect(listRows(settings(), 0)).toBe(1);
  });
});

describe('gridColumns', () => {
  const grid = settings({ view: 'grid' });
  const emPx = DEFAULT_EM_PX;
  /** The page's width, in pixels, that fits n cells: the cells, their gaps, the margins and the padding (in em). */
  const across = (n: number, cell: number, gap: number, px = emPx) =>
    (n * cell + (n - 1) * gap + 2 * (sizes.margin + sizes.grid.padding)) * px;

  it('fits as many tiles as the page is wide', () => {
    expect(gridColumns(grid, 40, across(5, tileWidth, sizes.grid.tileGap), emPx)).toBe(5);
    expect(gridColumns(grid, 40, across(5, tileWidth, sizes.grid.tileGap) - 1, emPx)).toBe(4);
  });

  it('fits fewer tiles with a larger text size: the tiles grow with it', () => {
    const page = across(5, tileWidth, sizes.grid.tileGap);
    expect(gridColumns(grid, 40, page, emPx * 1.25)).toBe(3);
  });

  it('never squeezes the tiles: one column on a page narrower than a tile', () => {
    expect(gridColumns(grid, 40, 100, emPx)).toBe(1);
  });

  it('has no more columns than tabs', () => {
    expect(gridColumns(grid, 3, 4000, emPx)).toBe(3);
  });

  it('fits more icons than tiles', () => {
    const icons = { ...grid, gridShow: 'icons' } as const;
    expect(gridColumns(icons, 40, across(12, sizes.icons.cell, sizes.icons.gap), emPx)).toBe(12);
  });
});

describe('tiles', () => {
  it('makes tiles taller for the address and for the last used time', () => {
    const grid = settings({ view: 'grid' });
    const { tileSpace, tileLine } = sizes.grid;
    const withDetails = (address: boolean, lastUsed: boolean) =>
      tileHeight({ ...grid, details: { ...grid.details, address, lastUsed } });
    expect(withDetails(false, true)).toBe(tileHeight(grid) + tileSpace + tileLine);
    expect(withDetails(true, false)).toBe(tileHeight(grid) + tileSpace + tileLine - ADDRESS_TUCK);
    expect(withDetails(true, true)).toBe(tileHeight(grid) + 2 * (tileSpace + tileLine) - ADDRESS_TUCK);
  });

  it('makes a tile 208 px wide at the default text size: the preview, its padding and its border', () => {
    expect(tileWidth * DEFAULT_EM_PX).toBe(208);
  });
});
