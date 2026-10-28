import { describe, expect, it } from 'vitest';
import { defaultSettings, limits, parseSettings } from '../../lib/settings/settings';

describe('parseSettings', () => {
  it('gives the defaults when nothing is saved', () => {
    expect(parseSettings(undefined)).toEqual(defaultSettings);
    expect(parseSettings(null)).toEqual(defaultSettings);
  });

  it('gives the defaults when the saved value is not an object', () => {
    expect(parseSettings('dark')).toEqual(defaultSettings);
    expect(parseSettings([1, 2])).toEqual(defaultSettings);
  });

  it('keeps every valid value', () => {
    const saved = {
      ...defaultSettings,
      theme: 'dark',
      view: 'grid',
      compact: false,
      listRows: 'fit',
      gridShow: 'icons',
      scope: 'all',
      showPinned: false,
      delayMs: 250,
      stayOpen: true,
      autoSelect: true,
      autoSelectSeconds: 5,
      toolbar: false,
      details: { ...defaultSettings.details, address: true, longAddress: 'scroll', lastUsed: true },
    };
    expect(parseSettings(saved)).toEqual(saved);
  });

  it('gives only the unknown setting its default', () => {
    const settings = parseSettings({ theme: 'sepia', view: 'grid' });
    expect(settings.theme).toBe(defaultSettings.theme);
    expect(settings.view).toBe('grid');
  });

  it('refuses numbers outside their limits or not whole', () => {
    expect(parseSettings({ listRows: limits.listRows.max + 1 }).listRows).toBe(defaultSettings.listRows);
    expect(parseSettings({ listRows: 0 }).listRows).toBe(defaultSettings.listRows);
    expect(parseSettings({ delayMs: 99.5 }).delayMs).toBe(defaultSettings.delayMs);
    expect(parseSettings({ autoSelectSeconds: '3' }).autoSelectSeconds).toBe(defaultSettings.autoSelectSeconds);
  });

  it('accepts the limits themselves', () => {
    expect(parseSettings({ delayMs: limits.delayMs.min }).delayMs).toBe(limits.delayMs.min);
    expect(parseSettings({ listRows: limits.listRows.max }).listRows).toBe(limits.listRows.max);
  });

  it('keeps the details that are valid when others are not', () => {
    const settings = parseSettings({ details: { address: true, longAddress: 'wrap', audioIcon: 'yes' } });
    expect(settings.details).toEqual({ ...defaultSettings.details, address: true });
  });
});
