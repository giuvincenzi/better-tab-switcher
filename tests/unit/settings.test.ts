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
      compact: true,
      listRows: 'fit',
      gridShow: 'icons',
      scope: 'all',
      showPinned: false,
      delayMs: 250,
      stayOpen: true,
      autoSelect: true,
      autoSelectSeconds: 5,
      toolbar: false,
      chromePagesWindow: false,
      details: { ...defaultSettings.details, address: false, fullAddress: false, longAddress: 'cut', lastUsed: false },
    };
    expect(parseSettings(saved)).toEqual(saved);
  });

  it('gives only the unknown setting its default', () => {
    const settings = parseSettings({ theme: 'sepia', view: 'grid' });
    expect(settings.theme).toBe(defaultSettings.theme);
    expect(settings.view).toBe('grid');
  });

  it('refuses numbers outside their limits or not whole', () => {
    expect(parseSettings({ delayMs: 99.5 }).delayMs).toBe(defaultSettings.delayMs);
    expect(parseSettings({ autoSelectSeconds: '3' }).autoSelectSeconds).toBe(defaultSettings.autoSelectSeconds);
  });

  it('accepts the limits themselves', () => {
    expect(parseSettings({ delayMs: limits.delayMs.min }).delayMs).toBe(limits.delayMs.min);
    expect(parseSettings({ delayMs: limits.delayMs.max }).delayMs).toBe(limits.delayMs.max);
  });

  it('keeps only the numbers of rows there are to choose from', () => {
    for (const rows of [6, 10, 15, 'fit']) expect(parseSettings({ listRows: rows }).listRows).toBe(rows);
    for (const rows of [8, 0, 16, '10']) expect(parseSettings({ listRows: rows }).listRows).toBe(10);
  });

  it('keeps the details that are valid when others are not', () => {
    const settings = parseSettings({ details: { address: false, longAddress: 'wrap', audioIcon: 'yes' } });
    expect(settings.details).toEqual({ ...defaultSettings.details, address: false });
  });
});

/** Every setting with a valid value that is not its default, so a value falling back to its default shows. */
const notDefaults = {
  theme: 'dark',
  view: 'grid',
  compact: true,
  listRows: 6,
  gridShow: 'icons',
  scope: 'all',
  showPinned: false,
  delayMs: 400,
  stayOpen: true,
  autoSelect: true,
  autoSelectSeconds: 7,
  toolbar: false,
  chromePagesWindow: false,
  details: {
    address: false,
    fullAddress: false,
    longAddress: 'cut',
    pinnedIcon: false,
    audioIcon: false,
    sleeping: false,
    groupColor: false,
    lastUsed: false,
  },
} as const;

describe('parseSettings with settings saved by another version', () => {
  it('gives each damaged setting its own default and keeps all the others', () => {
    const topKeys = Object.keys(notDefaults).filter((key) => key !== 'details') as Exclude<
      keyof typeof notDefaults,
      'details'
    >[];
    for (const key of topKeys) {
      for (const damaged of [undefined, null, 'unknown', 12.5, {}, [true]]) {
        const settings = parseSettings({ ...notDefaults, [key]: damaged });
        expect(settings, `${key} saved as ${JSON.stringify(damaged)}`).toEqual({
          ...notDefaults,
          [key]: defaultSettings[key],
        });
      }
    }
  });

  it('gives each damaged tab detail its own default and keeps all the others', () => {
    for (const key of Object.keys(notDefaults.details) as (keyof typeof notDefaults.details)[]) {
      for (const damaged of [undefined, null, 'unknown', 1, {}]) {
        const settings = parseSettings({ ...notDefaults, details: { ...notDefaults.details, [key]: damaged } });
        expect(settings, `details.${key} saved as ${JSON.stringify(damaged)}`).toEqual({
          ...notDefaults,
          details: { ...notDefaults.details, [key]: defaultSettings.details[key] },
        });
      }
    }
  });

  it('gives the default tab details when they are damaged, keeping the other settings', () => {
    for (const damaged of ['address', [true, false], null, 3]) {
      expect(parseSettings({ ...notDefaults, details: damaged })).toEqual({
        ...notDefaults,
        details: defaultSettings.details,
      });
    }
  });

  it('gives the defaults to the settings an older version did not save, keeping the saved ones', () => {
    const older = { theme: 'dark', view: 'grid', delayMs: 400, details: { address: false } };
    expect(parseSettings(older)).toEqual({
      ...defaultSettings,
      theme: 'dark',
      view: 'grid',
      delayMs: 400,
      details: { ...defaultSettings.details, address: false },
    });
  });

  it('gives Full address its default to the tab details saved before it existed, keeping the saved ones', () => {
    const older = { details: { address: true, longAddress: 'cut', lastUsed: false } };
    expect(parseSettings(older).details).toEqual({
      ...defaultSettings.details,
      address: true,
      fullAddress: defaultSettings.details.fullAddress,
      longAddress: 'cut',
      lastUsed: false,
    });
  });

  it('drops the settings a newer version added and keeps the known ones', () => {
    const newer = { ...notDefaults, sortBy: 'title', details: { ...notDefaults.details, favicon: false } };
    expect(parseSettings(newer)).toEqual(notDefaults);
  });

  it('refuses numbers just outside their limits, not numbers and numbers written as text', () => {
    const delays = [limits.delayMs.min - 1, limits.delayMs.max + 1, Number.NaN, Number.POSITIVE_INFINITY, '400'];
    for (const delayMs of delays) {
      expect(parseSettings({ ...notDefaults, delayMs }).delayMs).toBe(defaultSettings.delayMs);
    }
    const { min, max } = limits.autoSelectSeconds;
    for (const autoSelectSeconds of [min - 1, max + 1, 2.5, '7']) {
      expect(parseSettings({ ...notDefaults, autoSelectSeconds }).autoSelectSeconds).toBe(
        defaultSettings.autoSelectSeconds,
      );
    }
    expect(parseSettings({ autoSelectSeconds: min }).autoSelectSeconds).toBe(min);
    expect(parseSettings({ autoSelectSeconds: max }).autoSelectSeconds).toBe(max);
  });

  it('reads a switch only from true or false, never from a value that looks like one', () => {
    for (const looksLikeOne of [0, 1, 'true', 'false']) {
      expect(parseSettings({ compact: looksLikeOne }).compact).toBe(defaultSettings.compact);
      expect(parseSettings({ stayOpen: looksLikeOne }).stayOpen).toBe(defaultSettings.stayOpen);
    }
  });
});

describe('defaultSettings', () => {
  it('can never be changed by the code that reads it', () => {
    const before = structuredClone(defaultSettings);
    expect(() => {
      (defaultSettings as { theme: string }).theme = before.theme === 'dark' ? 'light' : 'dark';
    }).toThrow();
    expect(() => {
      (defaultSettings.details as { address: boolean }).address = !before.details.address;
    }).toThrow();
    expect(defaultSettings).toEqual(before);
  });

  it('gives settings that can be changed without changing the defaults', () => {
    const settings = parseSettings(undefined);
    settings.details.address = !settings.details.address;
    settings.theme = 'dark';
    expect(parseSettings(undefined)).toEqual(defaultSettings);
  });
});
