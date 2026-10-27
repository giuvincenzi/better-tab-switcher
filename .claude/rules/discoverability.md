---
paths:
  - "site/**"
  - "README.md"
  - "scripts/site.mjs"
  - "scripts/check-readme.mjs"
  - ".github/workflows/test.yml"
  - ".github/workflows/publish_release.yml"
---

# How people find Better Tab Switcher

## Title and description

- Better Tab Switcher has one **title** and one **description**, written once in `site/home/en.json` and translated in
  `site/home/<code>.json`.
- Who reads them:
  - the home page of every language (`scripts/site.mjs`): the page title ("Better Tab Switcher: " + title), the
    description for search engines, the link previews and the `SoftwareApplication` structured data;
  - `README.md`: title + ". " + description between its "Title and description" comments, checked by the test workflow
    (`readme_test`, `scripts/check-readme.mjs`);
  - the repository's About on GitHub: title + ". " + description, set by hand
    (`gh repo edit --description "…"`) whenever they change: the workflows' token has no Administration permission, and a
    personal token with it would be a secret only for this.
- The slogan is not the title: it stays in English in every language (only `en.json` has it, `site.mjs` stops when a
  translation adds it).

## Search engines

- Google Search Console: a "Domain" property for `gviam.app` in the maintainer's account, verified by a TXT record in
  the domain's DNS. Never delete the record: the property stays verified only while Google finds it.
- Bing Webmaster Tools: the site imported from Search Console (no tag of its own).
- `scripts/site.mjs` writes, with one constant as the one place the site's address is written: `sitemap.xml` (submitted
  in Search Console), a canonical link on every page (a
  guide page of any version points to the same page of the newest guide), `hreflang` links between the home pages
  (English as `x-default`), link previews and structured data.

## The home page's languages

- The home page is in the extension's languages: English at the site's root, the others in a folder each, listed in
  `scripts/site.mjs` with their flag and writing direction. Arabic runs right to left. The guide stays in
  English: its pages have the English header and no language menu.
- Every text of the home is in `site/home/<code>.json`, the same keys as `en.json` (except the slogan): `site.mjs` stops
  when a key is missing or added. Translations follow `i18n.md`.
- The language menu in the header shows flags from flag-icons (MIT, copied in `site/assets/flags` with its license),
  the United Kingdom's for English; Arabic, spoken in many countries, shows the letter "ع".
- The English home offers the browser's preferred language in a banner (`site.js`); the choice is remembered in the
  browser. The page never changes language by itself: search engines read the English one.

## By hand, after a release

- The first release: in Search Console, submit `sitemap.xml` and request indexing of the home; in Bing Webmaster Tools,
  import the site from Search Console.
- When the title or description change: the repository's About (above).
