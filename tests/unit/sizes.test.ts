import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../lib/settings/settings';
import {
  ADDRESS_TUCK,
  DEFAULT_EM_PX,
  gridColumns,
  listRows,
  sizes,
  switcherWidth,
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

describe('switcherWidth', () => {
  const emPx = DEFAULT_EM_PX;

  it('takes its share of the page: Small 35%, Medium 55%, Large 80%', () => {
    expect(switcherWidth(settings({ width: 'small' }), 1920, emPx) * emPx).toBe(672);
    expect(switcherWidth(settings({ width: 'medium' }), 1920, emPx) * emPx).toBe(1056);
    expect(switcherWidth(settings({ width: 'large' }), 1920, emPx) * emPx).toBe(1536);
  });

  it('is never narrower than 500 px at the default text size', () => {
    expect(switcherWidth(settings({ width: 'small' }), 1280, emPx) * emPx).toBe(500);
  });

  it('is never wider than the page, less its margins', () => {
    expect(switcherWidth(settings({ width: 'small' }), 400, emPx) * emPx).toBe(400 - 2 * sizes.margin * emPx);
  });
});

describe('gridColumns', () => {
  const emPx = DEFAULT_EM_PX;
  const grid = (width: Settings['width']) => settings({ view: 'grid', width });

  it('fits as many tiles as its width holds', () => {
    expect(gridColumns(grid('small'), 40, 1280, emPx)).toBe(2);
    expect(gridColumns(grid('small'), 40, 1920, emPx)).toBe(3);
    expect(gridColumns(grid('medium'), 40, 1920, emPx)).toBe(4);
    expect(gridColumns(grid('large'), 40, 1920, emPx)).toBe(7);
  });

  it('always fits two tiles at the narrowest width', () => {
    expect(gridColumns(grid('small'), 40, 600, emPx)).toBe(2);
  });

  it('fits fewer tiles with a larger text size: the tiles grow with it', () => {
    expect(gridColumns(grid('large'), 40, 1920, emPx * 1.25)).toBe(5);
  });

  it('has no more columns than tabs', () => {
    expect(gridColumns(grid('large'), 3, 4000, emPx)).toBe(3);
  });

  it('fits more icons than tiles', () => {
    const icons = { ...grid('small'), gridShow: 'icons' } as const;
    expect(gridColumns(icons, 40, 1920, emPx)).toBe(7);
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
