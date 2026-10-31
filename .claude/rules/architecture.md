# Architecture

## Stack

- TypeScript in strict mode.
- WXT (on Vite) builds the extension: the manifest, the development build and the zips for the stores.
- Solid for the switcher and the settings page (`@wxt-dev/module-solid`), with the extension's component library (`ui.md`).
- WXT's own parts where it has one: `@wxt-dev/i18n` for the texts (`i18n.md`), WXT's storage for the saved data
  (`data.md`).
- No auto-imports: every module is imported by name.
- Biome for lint and format.
- npm, with the lockfile committed.
- **A new npm package needs the user's approval.** The plan says its purpose, its license, its size in the extension
  (none when only for development), what it means for privacy, its upkeep, and why WXT and the browser don't do it.

## How the code is organized

- What exists comes first: WXT, then the browser's APIs, then our own code; a plan that writes its own says why.
- `entrypoints/` is what Chrome loads (the background, the switcher's frame and window, the settings page, the script
  put into pages): only glue. The logic is in `lib/`, without UI; the views in `components/`. One implementation of
  each thing.
- `lib/browser.ts` is the one place for what differs between Chrome and Microsoft Edge.
- The background is a service worker that Chrome stops when it is idle: no state lives only in its memory
  (`storage.session`, `storage.local`), and its listeners are added as soon as it starts. It is the one writer of the
  settings.
- Heavy work (the tabs' pictures) runs apart and never holds up the switcher.
- Never fail in silence: when the switcher can't show where it was asked, the background says why in its console
  (`console.info`: not an error for the user).

## The switcher in a page

The page must never reach the user's tabs. The switcher is an extension page in an iframe, inside a closed shadow root,
put in the page only when the switcher opens there and then reused. The frame is `credentialless` (pages that isolate
themselves accept it) and has `color-scheme: light dark` on both the element and its page: with different values on
the two sides Chrome paints the frame white, and inside a frame the device's theme follows the element's. Where a page
keeps the extension's scripts out (Chrome's pages, the stores, sandboxed and error pages) the switcher opens in a small
window of its own.

## Privacy and security

- The extension never connects to the network. No new permission without the user's approval.
- No `innerHTML`, no `eval`: texts go into the page as text.

## Repository layout

```
entrypoints/                    what Chrome loads (background, frame, own window, settings page, page script)
lib/                            logic;  components/  views (components/ui/ the component library);  styles/
locales/                        texts and translations (i18n.md);  public/  icons
scripts/                        scripts run by the Makefile
.github/workflows/              workflows (build-and-release.md)
site/                           website and user guide sources (docs.md)
tests/unit/                     unit tests;  tests/e2e/  end-to-end tests (testing.md)
```
