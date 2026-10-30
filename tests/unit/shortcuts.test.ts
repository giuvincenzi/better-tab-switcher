import { describe, expect, it } from 'vitest';
import { shortcutMissing } from '../../lib/shortcuts';

// The shortcuts as the browser gives them, and the settings' dialog the install asks for, on the real browser:
// tests/e2e/extension.spec.ts and settings.spec.ts.
describe('a shortcut missing after the install', () => {
  it('is the next or the previous tab one without keys', () => {
    expect(shortcutMissing({ next: '', previous: 'Alt+Shift+S', icon: '' })).toBe(true);
    expect(shortcutMissing({ next: 'Alt+S', previous: '', icon: 'Alt+K' })).toBe(true);
  });

  it("is none when both have their keys, whatever the toolbar icon's", () => {
    expect(shortcutMissing({ next: 'Alt+S', previous: 'Alt+Shift+S', icon: '' })).toBe(false);
  });
});
