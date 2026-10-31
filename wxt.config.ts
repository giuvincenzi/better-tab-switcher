import { defineConfig } from 'wxt';
import { licensesText } from './scripts/third-party.mjs';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  imports: false,
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      // The licenses of the third-party code in the extension, in every build (third-party.json, docs.md).
      files.push({ relativeDest: 'third-party-licenses.txt', contents: licensesText() });
      // Every language gets the texts only English has: the global words (i18n.md), the extension's name among them.
      // Chrome would show the English ones by itself, but the stores want the name in every language of the manifest.
      // The i18n module writes them (contents), never copies them from a file.
      const languages = files.flatMap((file) =>
        'contents' in file && /^_locales[\\/][^\\/]+[\\/]messages\.json$/.test(file.relativeDest) ? [file] : [],
      );
      const english = languages.find((file) => /[\\/]en[\\/]/.test(file.relativeDest));
      if (!english) throw new Error('No English texts (_locales/en) in the build.');
      const englishTexts = JSON.parse(String(english.contents));
      for (const language of languages) {
        if (language === english) continue;
        language.contents = JSON.stringify({ ...englishTexts, ...JSON.parse(String(language.contents)) }, null, 2);
      }
    },
  },
  manifest: ({ mode }) => ({
    default_locale: 'en',
    name: '__MSG_Extension_Name__',
    description: '__MSG_Extension_Description__',
    // light-dark() in styles/theme.css needs Chrome 123.
    minimum_chrome_version: '123',
    permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'favicon', 'tabGroups'],
    // The end-to-end tests can't press the shortcut, which gives the extension the page (activeTab): their build has
    // the permission for all sites already, to take the pictures.
    ...(mode === 'e2e' ? { host_permissions: ['<all_urls>'] } : {}),
    // The toolbar icon opens the switcher: no popup.
    action: { default_title: '__MSG_Extension_Name__' },
    // The switcher in a page is drawn in this extension page, in a frame (entrypoints/switcher.content.ts). With a
    // dynamic URL, which changes each time Chrome starts, a site can't load it to find out the extension is installed.
    web_accessible_resources: [{ resources: ['switcher-frame.html'], matches: ['<all_urls>'], use_dynamic_url: true }],
    // One hand: S beside the modifier, free in Chrome and Edge on Windows, Linux and macOS. On the Mac Control
    // (MacCtrl): Option with a letter types a character there, and Command is the Mac's own shortcuts' key.
    commands: {
      'next-tab': {
        suggested_key: { default: 'Alt+S', mac: 'MacCtrl+S' },
        description: '__MSG_Command_NextTab__',
      },
      'previous-tab': {
        suggested_key: { default: 'Alt+Shift+S', mac: 'MacCtrl+Shift+S' },
        description: '__MSG_Command_PreviousTab__',
      },
    },
  }),
});
