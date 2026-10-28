import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { ADDRESS_TUCK, gridColumns, listRows, sizes, tileHeight, tileWidth } from '../../lib/switcher/sizes';

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
  const across = (n: number, cell: number, gap: number) =>
    n * cell + (n - 1) * gap + 2 * (sizes.margin + sizes.grid.padding);

  it('fits as many tiles as the page is wide', () => {
    expect(gridColumns(grid, 40, across(5, tileWidth, sizes.grid.tileGap))).toBe(5);
    expect(gridColumns(grid, 40, across(5, tileWidth, sizes.grid.tileGap) - 1)).toBe(4);
  });

  it('never squeezes the tiles: one column on a page narrower than a tile', () => {
    expect(gridColumns(grid, 40, 100)).toBe(1);
  });

  it('has no more columns than tabs', () => {
    expect(gridColumns(grid, 3, 4000)).toBe(3);
  });

  it('fits more icons than tiles', () => {
    const icons = { ...grid, gridShow: 'icons' } as const;
    expect(gridColumns(icons, 40, across(12, sizes.icons.cell, sizes.icons.gap))).toBe(12);
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

  it('makes a tile 208 px wide: the preview, its padding and its border', () => {
    expect(tileWidth).toBe(208);
  });
});
