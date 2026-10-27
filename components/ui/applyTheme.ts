import type { Theme } from '../../lib/settings/settings';

/** Gives an element of the extension's UI the theme chosen in the settings (styles/theme.css). */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  element.dataset.theme = theme;
}
