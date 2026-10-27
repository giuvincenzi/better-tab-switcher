import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import { gridColumns, sizes, switcherSize, tileHeight, tileWidth, visibleRows } from '../../lib/switcher/sizes';

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

describe('switcherSize', () => {
  it('fits the grid: its columns and rows of tiles', () => {
    const grid = settings({ view: 'grid', gridColumns: 5, gridRows: 3 });
    const { width, height } = switcherSize(grid, 40);
    expect(width).toBe(5 * tileWidth + 4 * sizes.grid.tileGap + 2 * sizes.grid.padding);
    expect(height).toBeGreaterThan(3 * tileHeight(grid));
  });

  it('makes tiles taller for the address or the last used time', () => {
    const grid = settings({ view: 'grid' });
    expect(tileHeight({ ...grid, details: { ...grid.details, lastUsed: true } })).toBe(
      tileHeight(grid) + sizes.grid.tileMeta,
    );
  });

  it('makes the compact list narrower and lower', () => {
    const normal = switcherSize(settings({ compact: false }), 10);
    const compact = switcherSize(settings({ compact: true }), 10);
    expect(compact.width).toBeLessThan(normal.width);
    expect(compact.height).toBeLessThan(normal.height);
  });

  it('makes room for the search field', () => {
    expect(switcherSize(settings({ search: true }), 10).height).toBeGreaterThan(switcherSize(settings(), 10).height);
  });
});
