# Changelog

## Unreleased

### Added

- Tabs not opened yet: a tab opened in the background, like a link opened with Ctrl+click, shows “New” in the switcher
  until you open it. On by default; turn it off in Tab details.
- Copy address button: under the mouse, a button at the end of a tab's address copies it, and says “Address copied” for
  a moment. It takes no room of its own. On by default; turn it off in Tab details.
- Search settings: a search field at the top of the settings page finds settings in every section, by their name,
  their description or their choices, and highlights what it found.
- About, a new section of the settings: the version installed, and links to What's new, the user guide, Report an
  issue, the website, Rate this extension and Star on GitHub.
- Manage extension, in System: opens Better Tab Switcher's page in the browser's extensions page.

### Changed

- The settings page looks more like Chrome's settings: the sidebar sits at the left edge of the window, with an icon
  for each section, and the page shows only the section chosen in it (behind the Main menu button in a narrow window).
  The settings are as wide as the search field, right under it.
- Reset is now System, with About after it under a line.
- A setting that depends on another one is shown indented under it, and only while that one is on: Auto-select time
  under Auto-select, Full address and Long website addresses under Website address.

### Fixed

- A tab's preview in the grid never shows the switcher. Opening the switcher on a tab right after closing it there, or
  right after coming back to that tab, could take a preview with the old switcher in it.
- An arrow key pressed right after clicking a button of the switcher's toolbar moves the selected tab. It could change
  the toolbar's choice instead, such as switching from the grid back to the list.
- A tab that changes while the switcher is open, such as its title or its icon, no longer makes every tab of the
  switcher start over: the selected tab's long address keeps scrolling from where it was.
- The switcher always opens when the browser's memory for the extension is full of previews. It could stay closed when
  the page's preview was taken too late to make room for it.

## 1.0.0

### Added

- The switcher: Alt+S opens it on the next tab and Alt+Shift+S on the previous one (Control+S and Control+Shift+S on
  a Mac), the toolbar icon opens it too. It shows the tabs most recently used first, centered over the page; releasing
  the key held opens the selected tab.
- The list view, with Compact rows as an option, and the grid view, which fits the screen by itself: a preview of each
  tab, kept in memory only, or only each site's icon.
- The switcher's toolbar: the search field in the middle, buttons for the view, its options, the website address, the
  last used time and the settings. It can be turned off (Show toolbar).
- Auto-select, Stay open until you choose a tab, and tabs from all windows.
- Tabs shown before scrolling in the list: 6, 10 (the default), 15, or as many as fit the screen.
- Open the switcher in a window on Chrome's pages (Microsoft Edge's pages in Edge), on by default: where the browser keeps extensions
  out (its own pages, its web store), or a page keeps scripts out of its frames, the switcher opens in a small window
  of its own, in the middle of the current window.
- Sites never see your tabs: over a page, the switcher is drawn in the extension's own page, which the site can't
  read nor search for a tab's title.
- Works in Chrome and in Microsoft Edge: the settings name the browser they run in and open its shortcuts page.
- While the switcher is open, its tabs show their titles and addresses as they change, and the tabs closed, opened or
  moved to another window elsewhere leave or join the list, the selection staying on its tab.
- Close a tab from the switcher with its close button or with the mouse's middle button. Closing the tab you are on
  keeps the switcher open, in the tab the browser shows instead.
- Tab details: pinned, playing audio and inactive tab icons, tab group color, last used, and the website address,
  the page's whole address or only its site, scrolling on the selected tab and on the one under the mouse when it is
  long.
- The settings page, in the device's, light or dark theme. Restore default settings asks you to confirm it.
- Keyboard shortcuts in the settings, the toolbar icon's too, with a warning when one has no keys. Installed while
  another extension uses its keys, Better Tab Switcher opens its settings to let you choose others.
- The switcher shows over any page, also on sites that say they support dark mode and on sites that isolate
  themselves, like WhatsApp Web; it closes when you go to another window or another program.
