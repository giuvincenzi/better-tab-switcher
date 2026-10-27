# UI

- Before a UI change, follow "UI changes" in `working-rules.md` (ask whether the user wants
  visual proposals as a Design artifact, wait for approval, then implement).
- Every list whose items are not plain text gives its rows an accessible name: what the row shows, joined with the
  language's list format.

## Texts

Every text of the UI comes from `locales/en.yml` and is translated into every language in the same change
(`i18n.md`). Layouts must hold longer texts (German, Russian) and right to left (Arabic): no fixed widths for text, let
cards and buttons grow.

## Standard components only (strict)

- The extension has its own small component library, in the project: the switcher and the settings page use only its
  components, as they are. A new component, or a change to how one looks or behaves, is designed first as a visual
  proposal and approved by the user (`working-rules.md`).
- The settings page looks like Chrome's own settings (`chrome://settings`).
- Light and dark themes come from CSS custom properties, following the system or the user's choice.
- Approved by the user (custom on purpose): none yet.
