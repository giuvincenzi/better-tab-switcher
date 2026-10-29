import { defineConfig } from 'wxt';
import { licensesText } from './scripts/third-party.mjs';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  imports: false,
  hooks: {
    // The licenses of the third-party code in the extension, in every build (third-party.json, docs.md).
    'build:publicAssets': (_wxt, files) => {
      files.push({ relativeDest: 'third-party-licenses.txt', contents: licensesText() });
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
    commands: {
      'next-tab': {
        suggested_key: { default: 'Alt+Y', mac: 'Alt+Y' },
        description: '__MSG_Command_NextTab__',
      },
      'previous-tab': {
        suggested_key: { default: 'Alt+Shift+Y', mac: 'Alt+Shift+Y' },
        description: '__MSG_Command_PreviousTab__',
      },
    },
  }),
});
