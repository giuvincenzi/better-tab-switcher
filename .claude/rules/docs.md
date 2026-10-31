# Documentation and website

Website: `https://bettertabswitcher.gviam.app/`. Sources in `site/`, built by `scripts/site.mjs`.

- `site/index.html`: the home page (features, privacy), a template filled once per language with the texts of
  `site/home/<code>.json` (placeholders: `scripts/site.mjs`).
- `site/_header.html`, `site/_footer.html`: shared header and footer, with the texts of the page's language. On phones
  the header stays on one line (brand, the language's flag, a menu button that opens the links and the install button);
  the header's popups open across the whole width, so they never leave the screen.
- The links to all releases and to open an issue (bug or idea, `.github/ISSUE_TEMPLATE/`) are one piece,
  in `scripts/site.mjs`, shown under the home's buttons and in the footer of every page.
- `site/guide/sections.txt`: guide sections in order (`file|Title`). One file per section,
  `site/guide/<file>.html`, with the section content only; `site/guide/_page.html` is the
  page around it (sticky sidebar, version select, previous/next).
- `site/assets/`: style, script, the language menu's flags (`flags/`); the logo comes from `public/icon/`.
- `site/visuals/`: the home's pictures of the switcher's views, one page each (`visuals.json`: their order and the
  keys of their captions), drawn as images by `make docs`. They are copied from the approved design with
  `make visual`, in the same pull request as a UI change.

## Versions and preview

- Each guide version is built from `site/guide/` at the tag `vX.Y.Z` of that release, so a
  released guide never changes. Home, template and style come from the latest release.
  `guide/latest/` redirects to the newest version.
- `make docs` builds a preview in `site-preview/` with the guide of the current code as
  version "next". `make docs serve=1` builds it and serves it at `http://localhost:8080/`,
  so links work as on the real site.

## README

`README.md` is short: the logo, the name, the slogan, the badges (version, license, CI), then
the links to the website, the user guide and the extension's pages on the stores, and never repeats
what the website or the guide already say. Its slogan, title and description come from `site/home/en.json` and
`locales/en.yml` and are checked by the test workflow (`discoverability.md`). It ends with "Feedback" (a link to open an
issue), "Development" (see `.claude/rules/`) and "License", with the third-party components the extension ships.

## Third-party components

The code of some npm packages ends up in the extension: the ones we chose and their own dependencies. Their licenses ask
for their notice in every copy of that code, and the stores' zip is one.

- **`third-party.json` lists them**, one entry each: package, name, repository, license and its copyright line (from
  the package's license file, or its repository's when the package has none). It is the one list.
- **The build writes `third-party-licenses.txt`** into the extension from that list (`wxt.config.ts`,
  `scripts/third-party.mjs`); the README's "License" lists the same components (checked by `site_test`).
- **`make third-party` checks the list against the build** (`scripts/check-third-party.mjs`): it builds the published
  extension with source maps and reads which packages the code comes from. On GitHub it runs in `build_extension`, so a
  dependency added or dropped without updating the list fails the pull request (`testing.md`).
- A new package (`architecture.md`) with a license other than MIT gets its text added to `scripts/third-party.mjs` in
  the same change. Assets (images, fonts) from others shipped in the extension get their entry the same way.

## Every user-visible change updates the documentation

The guide uses the English UI texts.

In the same change as the code, for a new feature, changed behavior, new or renamed setting
or UI text:

- translate every new or changed UI text into every language (`locales/<locale>.yml`, `i18n.md`);
- update the matching file in `site/guide/` (new feature: new file and a line in
  `sections.txt`);
- update the feature cards in `site/index.html` when the feature list changes: short, saying what the user gets, not
  how it works; a new or changed text of the home goes in `site/home/en.json` and every translation in the same change;
- when what Better Tab Switcher does changes, check that the title and description still say it (`discoverability.md`);
- add a line under `## Unreleased` in `CHANGELOG.md`, in the right subsection (see
  `build-and-release.md`).

The plan given to the user before implementing (`working-rules.md`) lists every item of this
checklist, each marked as needed or not needed with the reason: the guide file, the feature
cards in `site/index.html`, the `CHANGELOG.md` line, the home's pictures, and the title, description and slogan
(`discoverability.md`). The plan also lists the rule changes (`working-rules.md`).

## Accuracy

- Describe only what the code does. Check the code before writing a sentence about
  behavior, defaults or limits.
- Privacy above all: the guide's Privacy page and the home's privacy always say what the code does, changed in the
  same pull request as the code.
- Use the exact UI texts from `locales/en.yml` (button, setting and page names).
- Pictures never show personal data, user names or other windows.
- A screenshot in the guide is a `<figure class="shot">` (the image with `alt`, a `<figcaption>`): centered, as wide as
  the text. Every guide screenshot opens at full size with a click, Enter or Space (`site.js`); every guide version uses
  the latest `site.js`, so the older guides get it too. The home's pictures do not zoom (the user's decision).
