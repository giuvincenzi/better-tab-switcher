import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// The components' tests in Chromium (vitest.config.ts): the extension APIs are WXT's fake browser, as in the logic's
// tests, with Chrome's i18n added, which the fake browser doesn't have: the English texts of locales/en.yml.

declare const __ENGLISH_MESSAGES__: Record<string, { message: string }>;

const i18n = {
  getMessage(name: string, substitutions?: string | string[]): string {
    const values = typeof substitutions === 'string' ? [substitutions] : (substitutions ?? []);
    const message = __ENGLISH_MESSAGES__[name]?.message ?? '';
    return message.replace(/\$(\d)/g, (_, n: string) => values[Number(n) - 1] ?? '');
  },
  getUILanguage: () => 'en',
};

vi.stubGlobal('chrome', { ...fakeBrowser, i18n });
vi.stubGlobal('browser', { ...fakeBrowser, i18n });
