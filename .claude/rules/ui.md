---
paths:
  - "components/**"
  - "styles/**"
  - "lib/switcher/**"
  - "entrypoints/options/**"
  - "entrypoints/switcher-frame/**"
  - "entrypoints/switcher-window/**"
  - "entrypoints/switcher.content.ts"
---

# UI

- Before a UI change, follow "UI changes" in `working-rules.md` (ask whether the user wants
  visual proposals as a Design artifact, wait for approval, then implement).
- Every list whose items are not plain text gives its rows an accessible name: what the row shows, joined with the
  language's list format.

## Texts

Every text of the UI comes from `locales/en.yml` (`i18n.md`). Layouts must hold longer texts (German, Russian) and right to left (Arabic): no fixed widths for text, let
cards and buttons grow.

## Standard components only (strict)

- The extension has its own small component library, `components/ui/`: the switcher and the settings page use only its
  components, as they are. A new component, or a change to how one looks or behaves, is designed first as a visual
  proposal and approved by the user (`working-rules.md`).
- The settings page looks like Chrome's own settings (`chrome://settings`).
- Light and dark themes come from CSS custom properties, following the system or the user's choice.
- Approved by the user (custom on purpose):
  - **The switcher** (approved: the Design canvas "Better Tab Switcher UI", boards 1–30): centered over the page, in
    the theme in use, the selection in the primary color, a toolbar at the top (Show toolbar): the search field in the
    middle, buttons for the view, its options and the settings.
    - **List** (boards 1–18): favicon and title; **Compact**, off by default, lowers the rows.
    - **Grid** (boards 19–30): tiles with the title above and the preview below; with **Show** set to **Icons**, the
      site's icon instead of the preview, never larger than its real size.
    - Optional details, all on by default: pinned, audio, sleeping (also greyed) and tab group icons; the website
      address, whole (Full address) and listed last, long ones scrolling on the selected tab and on the one under the
      mouse, or cut with "…"; the last used time; "New" in its place on the tabs not opened yet; the Copy address
      button under the mouse, over the end of the address's place (the title's without the address), taking no room,
      "Address copied" in place of the address for a moment (approved: the Design canvas "Better Tab Switcher · Not
      opened yet and Copy address", variant B and the Copy address page).
    - The toolbar: a button reached with Tab keeps the keyboard when pressed; a click of the mouse on it leaves the
      keyboard on the tabs.
  - **The settings page** (boards 31–34, the page "Settings redesign" of the same canvas, options A, and the Design
    canvas "Settings: sidebar icons and System"): Chrome's settings look, in the theme in use: a search field in the
    header that finds settings in every section and marks what it found; header and body on the same three columns,
    the search field and the sections as wide as each other in the middle one; the sidebar at the window's left edge,
    an icon for each section, behind a menu button (a drawer) in a narrow window; only the section chosen in it shown,
    named in the page's address; System and About last, under a line. System: Restart Better Tab Switcher (it only
    restarts the extension) and Restore default settings. About: the version, and links in rows that open a new tab. A
    setting that depends on another one is indented under it, in the same block, and shown only while that one is on
    (to a search, faded). Show pinned tabs is in Tab details. The options of the list or the grid only for the view
    chosen. Keyboard shortcuts: next tab, previous tab and the toolbar icon, with a warning when one of the first two
    has no keys; installed with a shortcut left without keys, the extension opens its settings on a dialog with that
    section alone. Restore default settings asks to confirm, in the same dialog component.
