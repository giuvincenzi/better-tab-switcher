import '../../styles/theme.css';
import './options.css';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { i18n } from '#i18n';
import { browser } from '#imports';
import { SettingsPage } from '../../components/settings/SettingsPage';
import { applyTheme } from '../../components/ui/applyTheme';
import { registerEmUnit } from '../../components/ui/emUnit';
import { shortcutsPageUrl } from '../../lib/browser';
import { applyLanguage, languageInUse } from '../../lib/i18n/language';
import { CTRL_TAB_GUIDE_URL } from '../../lib/links';
import { loadSettings, restoreDefaultSettings, saveSettings, watchSettings } from '../../lib/settings/store';

// The settings page: every change is saved at once, and the page follows changes made elsewhere (another settings
// page, Restore) and the shortcuts changed in chrome://extensions/shortcuts.
const root = document.documentElement;
registerEmUnit();
applyLanguage(root);
document.title = i18n.t('Settings_Title');

const [settings, setSettings] = createSignal(await loadSettings());
const [shortcuts, setShortcuts] = createSignal(await readShortcuts());
applyTheme(root, settings().theme);
watchSettings((saved) => {
  setSettings(saved);
  applyTheme(root, saved.theme);
});
// Back from chrome://extensions/shortcuts, the page shows the new keys.
window.addEventListener('focus', async () => setShortcuts(await readShortcuts()));

async function readShortcuts() {
  const commands = await browser.commands.getAll();
  const keys = (name: string) => commands.find((command) => command.name === name)?.shortcut ?? '';
  return { next: keys('next-tab'), previous: keys('previous-tab') };
}

render(
  () => (
    <SettingsPage
      settings={settings()}
      save={(change) => void saveSettings(change)}
      shortcuts={shortcuts()}
      language={languageInUse()}
      now={Date.now()}
      iconUrl={browser.runtime.getURL('/icon/128.png')}
      guideUrl={CTRL_TAB_GUIDE_URL}
      onChangeShortcut={() => void browser.tabs.create({ url: shortcutsPageUrl() })}
      onRestore={() => void restoreDefaultSettings()}
    />
  ),
  document.getElementById('settings') as HTMLElement,
);
