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
import { sendMessage } from '../../lib/messages';
import { loadSettings, watchSettings } from '../../lib/settings/store';
import { readShortcuts } from '../../lib/shortcuts';

// The settings page: every change is saved at once by the background, the one writer of the settings
// (lib/settings/service.ts), and the page follows changes made elsewhere (another settings page, Restore) and the
// shortcuts changed in chrome://extensions/shortcuts.
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

render(
  () => (
    <SettingsPage
      settings={settings()}
      save={(change) => void sendMessage('saveSettings', change)}
      shortcuts={shortcuts()}
      askShortcuts={new URLSearchParams(location.search).has('shortcuts')}
      language={languageInUse()}
      now={Date.now()}
      iconUrl={browser.runtime.getURL('/icon/128.png')}
      guideUrl={CTRL_TAB_GUIDE_URL}
      onChangeShortcut={() => void browser.tabs.create({ url: shortcutsPageUrl() })}
      onRestore={() => void sendMessage('restoreDefaultSettings')}
    />
  ),
  document.getElementById('settings') as HTMLElement,
);
