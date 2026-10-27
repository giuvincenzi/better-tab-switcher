import { storage } from '#imports';
import { parseSettings, type Settings, type TabDetails } from './settings';

/** A change to some settings; details can change one at a time too. */
export type SettingsChange = Partial<Omit<Settings, 'details'>> & { details?: Partial<TabDetails> };

const settingsItem = storage.defineItem<unknown>('local:settings', { version: 1 });

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await settingsItem.getValue());
}

export async function saveSettings(change: SettingsChange): Promise<Settings> {
  const current = await loadSettings();
  const next = parseSettings({ ...current, ...change, details: { ...current.details, ...change.details } });
  await settingsItem.setValue(next);
  return next;
}

export async function restoreDefaultSettings(): Promise<void> {
  await settingsItem.removeValue();
}

/** Calls `onChange` with the new settings whenever they change, from any page; returns the function that stops it. */
export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(parseSettings(value)));
}
