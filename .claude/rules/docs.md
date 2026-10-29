# Documentation and website

Website: `https://bettertabswitcher.gviam.app/`. Sources in `site/`, built by
`scripts/site.mjs`, published to GitHub Pages by the `publish_release` workflow (job `publish_site`).
The address is the repository's custom domain (Settings › Pages; a CNAME record `bettertabswitcher` →
`giuvincenzi.github.io` in the DNS of `gviam.app`, which is verified in the maintainer's GitHub account).

- `site/index.html`: the home page (features, privacy), a template filled once per language with the texts of
  `site/home/<code>.json` (placeholders: `scripts/site.mjs`). The home is translated, the guide only in English
  (`discoverability.md`).
- `site/_header.html`, `site/_footer.html`: shared header and footer, with the texts of the page's language. On phones
  the header stays on one line (brand, the language's flag, a menu button that opens the links and the install button);
  the header's popups open across the whole width, so they never leave the screen.
- The links to all releases and to open an issue (bug or idea, `.github/ISSUE_TEMPLATE/`) are one piece,
  in `scripts/site.mjs`, shown under the home's buttons and in the footer of every page.
- `site/guide/sections.txt`: guide sections in order (`file|Title`). One file per section,
  `site/guide/<file>.html`, with the section content only; `site/guide/_page.html` is the
  page around it (sticky sidebar, version select, previous/next).
- `site/guide/img/`: guide screenshots. `site/assets/`: style, script, logo, home screenshot, the language menu's flags
  (`flags/`).

## Versions and publishing

- GitHub Pages is set to "GitHub Actions". The site is published only by releases: `publish_release` runs its job
  `publish_site` after the GitHub Release (`build-and-release.md`). Pushing to `main` does not change the published
  site.
- Each guide version is built from `site/guide/` at the tag `vX.Y.Z` of that release, so a
  released guide never changes. Home, template and style come from the latest release.
  `guide/latest/` redirects to the newest version.
- `make docs` builds a preview in `site-preview/` with the guide of the current code as
  version "next". `make docs serve=1` builds it and serves it at `http://localhost:8080/`,
  so links work as on the real site.

## README

`README.md` is short: it presents Better Tab Switcher and links to the website, the user guide and the stores' pages,
and never repeats what the website or the guide already say. Its title and description come from `site/home/en.json`
and are checked by the test workflow (`discoverability.md`). It ends with "Feedback" (a link to open an issue),
"Development" (see `.claude/rules/`) and "License", with the third-party components the extension ships (npm packages in the built extension and their
dependencies, assets) and the attribution their licenses ask for.

## Every user-visible change updates the documentation

The extension and the home page are translated (`i18n.md`); the guide is only in English and uses the English UI texts.

In the same change as the code, for a new feature, changed behavior, new or renamed setting
or UI text:

- translate every new or changed UI text into every language (`locales/<code>.yml`, `i18n.md`);

- update the matching file in `site/guide/` (new feature: new file and a line in
  `sections.txt`);
- update the feature cards in `site/index.html` when the feature list changes; a new or changed text of the home goes
  in `site/home/en.json` and every translation in the same change;
- when what Better Tab Switcher does changes, check that the title and description still say it (`discoverability.md`);
- add a line under `## Unreleased` in `CHANGELOG.md`, in the right subsection (see
  `build-and-release.md`);
- screenshots: every release retakes all of them (below); a **new** screenshot is added to the screenshots script
  in the same change, so the next release takes it.

The plan given to the user before implementing (`working-rules.md`) lists every item of this
checklist, each marked as needed or not needed with the reason: the guide file, the feature
cards in `site/index.html`, the `CHANGELOG.md` line and a new screenshot by file name. The plan also lists the rule
changes (`working-rules.md`).

## Accuracy

- Describe only what the code does. Check the code before writing a sentence about
  behavior, defaults or limits.
- Use the exact UI texts from `locales/en.yml` (button, setting and page names).
- Screenshots: taken only by the `create_release_pr` workflow, for every release, on a GitHub machine, and checked by
  the user in the release pull request: no pull request retakes them (`screenshots_test` only checks that they can be
  taken, `testing.md`) and there is no `make` for them. The screenshots script holds the list and takes them from the
  development build built for the screenshots: the sample data, no development marks, so every screenshot looks like a
  release. Never show personal data, user names or other windows. A new screenshot is added there, taken the same way.
- A screenshot in the guide is a `<figure class="shot">` (the image with `alt`, a `<figcaption>`): centered, as wide as
  the text. Every guide screenshot opens at full size with a click, Enter or Space (`site.js`); every guide version uses
  the latest `site.js`, so the older guides get it too. The home's pictures do not zoom (the user's decision).
- The install links are the extension's pages on the Chrome Web Store and Edge Add-ons: keep them stable.
