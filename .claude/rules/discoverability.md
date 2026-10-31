---
paths:
  - "site/**"
  - "README.md"
  - "scripts/site.mjs"
  - "scripts/check-readme.mjs"
  - ".github/workflows/test.yml"
  - "scripts/languages.mjs"
  - "scripts/store-listing.mjs"
  - "lib/links.ts"
  - "locales/**"
---

# How people find Better Tab Switcher

## Title, description and slogan

- **The website is the one place where everything about Better Tab Switcher is said**; the README is short and points
  to it.
- Better Tab Switcher has one **title**, one **description** and one **slogan**, each written once: the title in
  `site/home/en.json` (translated in `site/home/<code>.json`), the description in `locales/en.yml`
  (`Extension_Description`, translated in `locales/<locale>.yml`: it is also the manifest's description),
  the slogan in `site/home/en.json` only.
- Who reads them:
  - the home page of every language (`scripts/site.mjs`): the page title ("Better Tab Switcher: " + title), the
    description for search engines, the link previews and the `SoftwareApplication` structured data;
  - `README.md`: title + ". " + description between its "Title and description" comments, and the slogan in its italic
    line under the name, checked by the test workflow (`site_test`, `scripts/check-readme.mjs`).
- The stores' pages (Chrome Web Store, Edge Add-ons) are written by hand from `make store-listing`
  (`scripts/store-listing.mjs`): the descriptions in every language, Edge's search terms (`store_search_terms` in
  `site/home/<code>.json`), the pictures and the Privacy answers, all read from the site's and the extension's texts.
  The stores have no API for them, so a change to what they say is pasted into both dashboards, in every language it
  changes, in the same work as the pull request.
- The slogan is not the title: it stays in English in every language (only `en.json` has it, `site.mjs` stops when a
  translation adds it).

## Search engines

- Google Search Console and Bing Webmaster Tools know the site by its address (`SITE_URL`), and the Chrome Web Store
  shows it as the extension's Official URL: a change of the address is made there too, in the same work.
- The TXT record in the DNS of `gviam.app` verifies the site for Google: never delete it.

- `scripts/site.mjs` writes, with the site's address from one constant (`SITE_URL`, `lib/links.ts`):
  `sitemap.xml`, a canonical link on every page (a guide page of any version points to the same page of the newest
  guide), `hreflang` links between the home pages (English as `x-default`), link previews and structured data.

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
