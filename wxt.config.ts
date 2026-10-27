import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  imports: false,
  hooks: {
    // The switcher's content script has no matches: it is injected only where the user opens the switcher (activeTab),
    // and WXT would turn a runtime content script's matches into host_permissions, asking for every site at install.
    // Its styles still have to be readable from any page, where the switcher shows in a shadow root.
    'build:manifestGenerated': (_wxt, manifest) => {
      for (const entry of manifest.web_accessible_resources ?? []) {
        if (typeof entry !== 'string' && entry.resources.includes('content-scripts/switcher.css')) {
          entry.matches = ['<all_urls>'];
        }
      }
    },
  },
  manifest: ({ mode }) => ({
    default_locale: 'en',
    name: '__MSG_Extension_Name__',
    // light-dark() in styles/theme.css needs Chrome 123.
    minimum_chrome_version: '123',
    permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'favicon', 'system.display', 'tabGroups'],
    // Asked for in the settings, for Previews: a picture of each tab whenever it is used, not only in the switcher.
    optional_host_permissions: ['<all_urls>'],
    // The end-to-end tests can't press the shortcut, which gives the extension the page (activeTab): their build has
    // the permission for all sites already, to take the pictures.
    ...(mode === 'e2e' ? { host_permissions: ['<all_urls>'] } : {}),
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
  }),
});
