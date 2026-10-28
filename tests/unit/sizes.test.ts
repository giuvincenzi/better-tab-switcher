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
  const emPx = DEFAULT_EM_PX;
  const grid = settings({ view: 'grid' });

  it('makes a rectangle a little wider than tall: about as many columns as rows', () => {
    expect(gridColumns(grid, 4, 2560, emPx)).toBe(2);
    expect(gridColumns(grid, 7, 2560, emPx)).toBe(3);
    expect(gridColumns(grid, 12, 2560, emPx)).toBe(4);
    expect(gridColumns(grid, 30, 2560, emPx)).toBe(6);
  });

  it('never has more columns than fit in 85% of the page', () => {
    expect(gridColumns(grid, 30, 1280, emPx)).toBe(4);
  });

  it('fits fewer tiles with a larger text size: the tiles grow with it', () => {
    expect(gridColumns(grid, 30, 1920, emPx * 1.25)).toBe(5);
  });

  it('has one column for one tab', () => {
    expect(gridColumns(grid, 1, 2560, emPx)).toBe(1);
  });

  it('makes the same rectangle of icons', () => {
    expect(gridColumns({ ...grid, gridShow: 'icons' }, 30, 1280, emPx)).toBe(6);
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
