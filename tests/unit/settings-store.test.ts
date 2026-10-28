import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '#imports';
import { defaultSettings } from '../../lib/settings/settings';
import { loadSettings, restoreDefaultSettings, saveSettings, watchSettings } from '../../lib/settings/store';

describe('settings store', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('loads the defaults on a new install', async () => {
    expect(await loadSettings()).toEqual(defaultSettings);
  });

  it('saves a change and keeps the other settings', async () => {
    await saveSettings({ view: 'grid', details: { address: true } });
    const settings = await loadSettings();
    expect(settings.view).toBe('grid');
    expect(settings.details.address).toBe(true);
    expect(settings.details.pinnedIcon).toBe(defaultSettings.details.pinnedIcon);
    expect(settings.compact).toBe(defaultSettings.compact);
  });

  it('never saves an invalid value', async () => {
    await saveSettings({ delayMs: -5 });
    expect((await loadSettings()).delayMs).toBe(defaultSettings.delayMs);
  });

  it('restores the defaults', async () => {
    await saveSettings({ theme: 'dark', toolbar: false });
    await restoreDefaultSettings();
    expect(await loadSettings()).toEqual(defaultSettings);
  });

  it('tells the watchers about a change', async () => {
    const onChange = vi.fn();
    const stop = watchSettings(onChange);
    await saveSettings({ theme: 'light' });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light' })));
    stop();
  });
});
