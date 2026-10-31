---
paths:
  - "site/**"
  - "README.md"
  - "scripts/site.mjs"
  - "scripts/check-readme.mjs"
  - ".github/workflows/test.yml"
  - "scripts/languages.mjs"
---

# How people find Better Tab Switcher

## Title, description and slogan

- **The website is the one place where everything about Better Tab Switcher is said**; the README and the stores' pages
  are short and point to it.
- Better Tab Switcher has one **title**, one **description** and one **slogan**, each written once: the title in
  `site/home/en.json` (translated in `site/home/<code>.json`), the description in `locales/en.yml`
  (`Extension_Description`, translated in `locales/<locale>.yml`: it is also the extension's description in the stores),
  the slogan in `site/home/en.json` only.
- Who reads them:
  - the home page of every language (`scripts/site.mjs`): the page title ("Better Tab Switcher: " + title), the
    description for search engines, the link previews and the `SoftwareApplication` structured data;
  - `README.md`: title + ". " + description between its "Title and description" comments, and the slogan in its italic
    line under the name, checked by the test workflow (`site_test`, `scripts/check-readme.mjs`);
  - the stores' pages (Chrome Web Store, Edge Add-ons): under the name, the description from the extension's manifest;
    the page's own description and the rest of both dashboards (pictures, privacy answers) are written by
    `make store-listing` from the site and the manifest, never by hand, and pasted into each store's dashboard, one
    per language, whenever they change;
  - the repository's About on GitHub: title + ". " + description, set by hand
    (`gh repo edit --description "…"`) whenever they change: the workflows' token has no Administration permission, and a
    personal token with it would be a secret only for this.
- The slogan is not the title: it stays in English in every language (only `en.json` has it, `site.mjs` stops when a
  translation adds it).

## Search engines

- Google Search Console: a "Domain" property for `gviam.app` in the maintainer's account, verified by a TXT record in
  the domain's DNS. Never delete the record: the property stays verified only while Google finds it.
- Bing Webmaster Tools: the site imported from Search Console (no tag of its own).
- `scripts/site.mjs` writes, with the site's address from one constant (`SITE_URL`, `scripts/languages.mjs`):
  `sitemap.xml` (submitted in Search Console), a canonical link on every page (a guide page of any version points to
  the same page of the newest guide), `hreflang` links between the home pages (English as `x-default`), link previews
  and structured data.

## The home page's languages

- The home page is in the extension's languages: English at the site's root, the others in a folder each, listed in
  `scripts/languages.mjs` with their flag and writing direction. Arabic runs right to left. The guide stays in
  English: its pages have the English header and no language menu.
- Every text of the home is in `site/home/<code>.json`, the same keys as `en.json` (except the slogan): `site.mjs` stops
  when a key is missing or added. Translations follow `i18n.md`.
- The language menu in the header shows flags from flag-icons (MIT, copied in `site/assets/flags` with its license),
  the United Kingdom's for English; Arabic, spoken in many countries, shows the letter "ع".
- The English home offers the browser's preferred language in a banner (`site.js`); the choice is remembered in the
  browser. The page never changes language by itself: search engines read the English one.

## By hand

- When the title, the description, the slogan, the home's features or privacy, the views or the permissions change:
  the repository's About and what `make store-listing` writes, in both stores' dashboards (above).
