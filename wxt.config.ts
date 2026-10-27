import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  imports: false,
  manifest: {
    default_locale: 'en',
    name: '__MSG_Extension_Name__',
    // light-dark() in styles/theme.css needs Chrome 123.
    minimum_chrome_version: '123',
    permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'favicon', 'system.display', 'tabGroups'],
    // The toolbar icon opens the switcher: no popup.
    action: { default_title: '__MSG_Extension_Name__' },
    // The switcher in a page shows the tabs' icons from Chrome's cache.
    web_accessible_resources: [{ resources: ['_favicon/*'], matches: ['<all_urls>'], use_dynamic_url: true }],
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
  },
});
