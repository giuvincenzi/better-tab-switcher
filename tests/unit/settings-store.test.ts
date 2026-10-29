import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser, storage } from '#imports';
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
    await saveSettings({ view: 'grid', details: { address: false } });
    const settings = await loadSettings();
    expect(settings.view).toBe('grid');
    expect(settings.details.address).toBe(false);
    expect(settings.details.pinnedIcon).toBe(defaultSettings.details.pinnedIcon);
    expect(settings.compact).toBe(defaultSettings.compact);
  });

  it('leaves a setting as it is when a change gives it an invalid value', async () => {
    await saveSettings({ delayMs: 200, theme: 'dark', details: { longAddress: 'cut' } });
    await saveSettings({ delayMs: -5, theme: 'sepia' as never, details: { longAddress: 'wrap' as never } });
    const settings = await loadSettings();
    expect([settings.delayMs, settings.theme, settings.details.longAddress]).toEqual([200, 'dark', 'cut']);
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

  it('reads the settings where every earlier version saved them', async () => {
    await storage.setItem('local:settings', { theme: 'dark', details: { address: false } });
    const settings = await loadSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.details.address).toBe(false);
  });

  it('never writes the defaults: a new install and a restore leave nothing saved', async () => {
    await loadSettings();
    expect(await storage.getItem('local:settings')).toBeNull();
    await saveSettings({ theme: 'dark' });
    await restoreDefaultSettings();
    expect(await storage.getItem('local:settings')).toBeNull();
  });

  it('keeps the tab details saved before when one more changes', async () => {
    await saveSettings({ details: { address: false } });
    await saveSettings({ details: { lastUsed: false } });
    await saveSettings({ theme: 'dark' });
    expect((await loadSettings()).details).toEqual({ ...defaultSettings.details, address: false, lastUsed: false });
  });

  it('writes no invalid value to the storage, for any page that reads it', async () => {
    await saveSettings({ delayMs: 200, theme: 'dark' });
    await saveSettings({ autoSelectSeconds: 99, theme: 'sepia' as never });
    expect(await storage.getItem('local:settings')).toEqual({ ...defaultSettings, delayMs: 200, theme: 'dark' });
  });

  it('gives back the settings it saved', async () => {
    await saveSettings({ view: 'grid' });
    const saved = await saveSettings({ delayMs: 200 });
    expect(saved).toEqual({ ...defaultSettings, view: 'grid', delayMs: 200 });
    expect(await loadSettings()).toEqual(saved);
  });

  it('keeps the valid settings of damaged saved data when a change is saved', async () => {
    await storage.setItem('local:settings', { theme: 'dark', view: 'mosaic', delayMs: 'slow', details: 'none' });
    await saveSettings({ compact: true });
    expect(await loadSettings()).toEqual({ ...defaultSettings, theme: 'dark', compact: true });
    expect(await storage.getItem('local:settings')).toEqual({ ...defaultSettings, theme: 'dark', compact: true });
  });

  it('tells the watchers the defaults when the settings are restored', async () => {
    await saveSettings({ theme: 'dark', details: { address: false } });
    const onChange = vi.fn();
    const stop = watchSettings(onChange);
    await restoreDefaultSettings();
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(defaultSettings));
    stop();
  });

  it('tells the watchers valid settings even when damaged data is saved by someone else', async () => {
    const onChange = vi.fn();
    const stop = watchSettings(onChange);
    await storage.setItem('local:settings', { theme: 'sepia', view: 'grid' });
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ ...defaultSettings, view: 'grid' }));
    stop();
  });

  it('stops telling a watcher once it is stopped', async () => {
    const onChange = vi.fn();
    const stop = watchSettings(onChange);
    stop();
    await saveSettings({ theme: 'dark' });
    await new Promise((done) => setTimeout(done, 20));
    expect(onChange).not.toHaveBeenCalled();
  });
});
