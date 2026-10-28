import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '#imports';
import { listenToSettingsChanges } from '../../lib/settings/service';
import { defaultSettings } from '../../lib/settings/settings';
import { loadSettings } from '../../lib/settings/store';

// The messages the settings page and the switcher send the background: the handlers it sets up, called as they are.
const messages = await vi.hoisted(async () => (await import('./background-world')).fakeMessages());
vi.mock('../../lib/messages', () => ({ sendMessage: messages.sendMessage, onMessage: messages.onMessage }));

beforeEach(() => {
  fakeBrowser.reset();
  messages.handlers.clear();
  listenToSettingsChanges();
});

describe('the settings changed from the pages', () => {
  it('keeps both of two changes saved at the same moment from two pages', async () => {
    await Promise.all([
      messages.ask('saveSettings', { compact: false }),
      messages.ask('saveSettings', { toolbar: false }),
      messages.ask('saveSettings', { details: { address: true } }),
      messages.ask('saveSettings', { details: { lastUsed: true } }),
    ]);
    const settings = await loadSettings();
    expect([settings.compact, settings.toolbar, settings.details.address, settings.details.lastUsed]).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('applies a change and a restore in the order they come', async () => {
    await Promise.all([
      messages.ask('saveSettings', { theme: 'dark' }),
      messages.ask('restoreDefaultSettings'),
      messages.ask('saveSettings', { compact: false }),
    ]);
    expect(await loadSettings()).toEqual({ ...defaultSettings, compact: false });
  });

  it('gives back the settings as saved', async () => {
    expect(await messages.ask('saveSettings', { view: 'grid' })).toEqual({ ...defaultSettings, view: 'grid' });
  });
});
