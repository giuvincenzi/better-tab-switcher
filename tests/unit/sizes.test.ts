import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { ADDRESS_TUCK, gridColumns, sizes, tileHeight, tileWidth, visibleRows } from '../../lib/switcher/sizes';

const settings = (change: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...change });

describe('visibleRows', () => {
  it('shows the rows the setting says, fewer with fewer tabs', () => {
    expect(visibleRows(settings({ listRows: 6 }), 20)).toBe(6);
    expect(visibleRows(settings({ listRows: 6 }), 4)).toBe(4);
    expect(visibleRows(settings({ listRows: 'all' }), 20)).toBe(20);
  });

  it('counts the grid in rows of tiles', () => {
    const grid = settings({ view: 'grid', gridColumns: 5, gridRows: 3 });
    expect(visibleRows(grid, 40)).toBe(3);
    expect(visibleRows(grid, 7)).toBe(2);
    expect(visibleRows({ ...grid, gridRows: 'all' }, 40)).toBe(8);
  });

  it('keeps one row with no tabs', () => {
    expect(visibleRows(settings(), 0)).toBe(1);
  });
});

describe('gridColumns', () => {
  it('has fewer columns than the setting only with fewer tabs', () => {
    expect(gridColumns(settings({ gridColumns: 5 }), 12)).toBe(5);
    expect(gridColumns(settings({ gridColumns: 5 }), 3)).toBe(3);
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
