/**
 * The unit every size of the extension's UI is written in: --bts-em, one em of the UI's root, whose font size is the
 * one the user chose in Chrome (font-size: medium). Registered as a length, it keeps the root's value in every element
 * (an unregistered custom property would take each element's own font size): calc(0.75 * var(--bts-em)) is the same
 * everywhere, and the whole UI grows with the user's text size.
 */
let registered = false;

export function registerEmUnit(): void {
  if (registered) return;
  registered = true;
  try {
    CSS.registerProperty({ name: '--bts-em', syntax: '<length>', inherits: true, initialValue: '16px' });
  } catch {
    // Registered already: by another copy of the extension's UI in the same page.
  }
}
