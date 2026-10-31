// Builds the website: the home page in every language and one user guide per released version (docs.md).
//
//   make docs             -> node scripts/site.mjs --preview   preview in site-preview/, the guide of the current code
//                                                              added as version "next"
//   publish_release       -> node scripts/site.mjs             published site in _site/, released versions only
//
// Each guide version comes from site/guide/ at the git tag vX.Y.Z of that release, so the guide of an old version never
// changes. Home page, page template, style and the visuals come from the latest release (or from the current code with
// --preview), so every version has the same look.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { HOME_LANGUAGES, readExtensionTexts, SITE_URL } from './languages.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const preview = process.argv.includes('--preview');
const output = preview ? 'site-preview' : '_site';

const REPOSITORY = 'https://github.com/giuvincenzi/better-tab-switcher';

/**
 * The extension's pages on the stores, the install buttons' links (also in the README). Null for a store the extension
 * isn't on: the preview links nowhere, a release can't be built.
 */
/** @type {Record<Store, string | null>} */
const STORE_PAGES = {
  chrome: 'https://chromewebstore.google.com/detail/fkalmlegojojpcjdfndipmnakgakokei',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/kkoilicikefpkggldhpdeabmgnpngelg',
};

/** @typedef {'chrome' | 'edge'} Store */

/** @typedef {import('./languages.mjs').HomeLanguageDefinition} HomeLanguageDefinition */
/**
 * The texts of site/home/<code>.json: the keys read by name are in every file, the slogan only in en.json.
 * @typedef {Record<string, string> & { fine_print: string, language_name: string, language_menu: string }} HomeTexts
 */
/** @typedef {Awaited<ReturnType<typeof readExtensionTexts>>} ExtensionTexts */
/**
 * A home language with what the build reads for it: its texts, the extension's texts and its page's address.
 * @typedef {HomeLanguageDefinition & { texts: HomeTexts, extension: ExtensionTexts, url: string }} HomeLanguage
 */
/** @typedef {{ slug: string, title: string | undefined }} Section */
/** @typedef {{ name: string, tag: string, numbers: [number, number, number], dir: string }} Version */
/** @typedef {{ name: string, label: string, dir: string, sections: Section[] }} Guide */
/**
 * A scene of site/visuals/visuals.json: its page, and the keys of its name and sentence in the home's texts.
 * @typedef {{ scene: string, name: string, text: string }} Scene
 */

/** HOME_LANGUAGES with their texts and addresses, filled when the build reads them. */
/** @type {HomeLanguage[]} */
const homeLanguages = [];

/** @param {string} path */
const read = (path) => readFileSync(path, 'utf8');
/**
 * @param {string} path
 * @param {string} text
 */
function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, path.endsWith('.html') ? otherSitesInNewTab(text) : text);
}

/**
 * Links to other sites (GitHub, the stores, the programs the guide points to) open in a new tab, so the site stays open; the site's own links
 * open in the same tab.
 * @param {string} html
 */
const otherSitesInNewTab = (html) =>
  html.replace(/<a (?![^>]*\btarget=)([^>]*\bhref="https?:\/\/[^"]*")/g, (tag, attributes) =>
    attributes.includes(`href="${SITE_URL}`) ? tag : `<a target="_blank" rel="noopener" ${attributes}`,
  );
/** Only the characters HTML needs escaped: accented letters and other scripts stay readable in the pages. */
/** @param {unknown} text */
const encode = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
/**
 * git, for the questions whose answer is its success.
 * @param {...string} args
 */
function gitSucceeds(...args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
/** @param {string} target */
const redirect = (target) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Better Tab Switcher guide</title>` +
  // The script keeps the link's section (#ctrl-tab), which the refresh, there for browsers without scripts, drops.
  `<script>location.replace(${JSON.stringify(target)} + location.hash);</script>` +
  `<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"></head>` +
  `<body><a href="${target}">Better Tab Switcher guide</a></body></html>`;

/**
 * Sections of one guide version: the "file|Title" lines of sections.txt.
 * @param {string} guideDir
 * @returns {Section[]}
 */
function readSections(guideDir) {
  return read(join(guideDir, 'sections.txt'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [slug, title] = line.split('|', 2).map((part) => part.trim());
      // split always gives a first part: the slug is there even on a line without "|".
      return { slug: /** @type {string} */ (slug), title };
    });
}

/**
 * The texts of one language's home page. Every language has exactly the keys of en.json, except the slogan: it stays
 * in English, so only en.json has it (discoverability.md).
 * @param {string} siteDir
 * @param {string} code
 * @returns {HomeTexts}
 */
function readHomeTexts(siteDir, code) {
  const path = join(siteDir, `home/${code}.json`);
  if (!existsSync(path))
    throw new Error(`site/home/${code}.json is missing: every language of the home needs its texts.`);
  const texts = JSON.parse(read(path));
  if (code !== 'en') {
    const englishKeys = Object.keys(JSON.parse(read(join(siteDir, 'home/en.json'))));
    if ('slogan' in texts)
      throw new Error(`site/home/${code}.json has the slogan: it stays in English, only en.json has it.`);
    const missing = englishKeys.filter((key) => key !== 'slogan' && !(key in texts));
    if (missing.length) throw new Error(`site/home/${code}.json misses ${missing.join(', ')}.`);
    const extra = Object.keys(texts).filter((key) => !englishKeys.includes(key));
    if (extra.length) throw new Error(`site/home/${code}.json has ${extra.join(', ')}, which en.json does not have.`);
  }
  if (!texts.fine_print?.includes('{version}')) throw new Error(`site/home/${code}.json: fine_print lost {version}.`);
  return texts;
}

/**
 * A language's flag: its round flag, or its letter.
 * @param {HomeLanguageDefinition} language
 * @param {string} rootPath
 */
function flag(language, rootPath) {
  if (language.flag) return `<img class="flag" src="${rootPath}assets/flags/${language.flag}.svg" alt="">`;
  return `<span class="flag flag-letter" aria-hidden="true">${language.letter}</span>`;
}

/**
 * The header's language menu on one home page: the current language in the bar, every language in a grid, by its name.
 * @param {HomeLanguage} current
 * @param {string} rootPath
 */
function languageMenu(current, rootPath) {
  const sorted = [...homeLanguages].sort((a, b) =>
    a.texts.language_name < b.texts.language_name ? -1 : a.texts.language_name > b.texts.language_name ? 1 : 0,
  );
  const label = encode(current.texts.language_menu);
  const name = encode(current.texts.language_name);
  const links = sorted.map((language) => {
    const href = language.folder ? `${rootPath}${language.folder}/` : rootPath || './';
    const currentMark = language.code === current.code ? ' aria-current="true"' : '';
    return `            <a href="${href}" hreflang="${language.code}" lang="${language.code}" data-language="${language.code}"${currentMark}>${flag(language, rootPath)}<span>${encode(language.texts.language_name)}</span></a>`;
  });
  return [
    '      <details class="language-menu">',
    `        <summary aria-label="${label}: ${name}">${flag(current, rootPath)}<span class="language-name">${name}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>`,
    '        <div class="language-popup">',
    `          <p>${label}</p>`,
    '          <div class="language-grid">',
    ...links,
    '          </div>',
    '        </div>',
    '      </details>',
  ].join('\n');
}

/** The English home's banner, filled by site.js with the texts of the browser's language: each language's offer. */
function languageBanner() {
  /** @type {Record<string, object>} */
  const offers = {};
  for (const language of homeLanguages.filter((other) => other.code !== 'en')) {
    offers[language.code] = {
      text: language.texts.banner_text,
      switch: language.texts.banner_switch,
      stay: language.texts.banner_stay,
      url: `${language.folder}/`,
      dir: language.rtl ? 'rtl' : 'ltr',
      flag: language.flag ? `assets/flags/${language.flag}.svg` : null,
      letter: language.letter ?? null,
    };
  }
  return [
    '<div class="language-banner" id="language-banner" hidden>',
    '  <div class="wrap">',
    '    <span class="flag"></span>',
    '    <span class="language-banner-text"></span>',
    '    <a class="button button-primary button-small" href="./"></a>',
    '    <button type="button" class="button button-secondary button-small"></button>',
    '  </div>',
    '</div>',
    `<script type="application/json" id="language-offers">${JSON.stringify(offers).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n');
}

/**
 * @param {string} html
 * @param {HomeTexts} texts
 */
const setNavTexts = (html, texts) =>
  html
    .replaceAll('{{NAV_LABEL}}', encode(texts.nav_label))
    .replaceAll('{{NAV_FEATURES}}', encode(texts.nav_features))
    .replaceAll('{{NAV_GUIDE}}', encode(texts.nav_guide))
    .replaceAll('{{NAV_PRIVACY}}', encode(texts.nav_privacy))
    .replaceAll('{{NAV_MENU}}', encode(texts.nav_menu))
    .replaceAll('{{NAV_INSTALL}}', encode(texts.install_button));

/**
 * @param {string} html
 * @param {string} home the home page from the page
 */
const setStorePages = (html, home) =>
  html
    .replaceAll('{{CHROME_STORE_PAGE}}', storePage('chrome', home))
    .replaceAll('{{EDGE_STORE_PAGE}}', storePage('edge', home));

/**
 * The links under the home's buttons and in the footer: the same ones in both places.
 * @param {HomeTexts} texts
 */
const projectLinks = (texts) =>
  `<a href="${REPOSITORY}/releases">${encode(texts.footer_releases)}</a> &middot; ` +
  `<a href="${REPOSITORY}/issues/new/choose">${encode(texts.feedback_link)}</a>`;

/**
 * @param {string} html
 * @param {HomeTexts} texts
 */
const setFooterTexts = (html, texts) =>
  html
    .replaceAll('{{FOOTER_LICENSE}}', encode(texts.footer_license))
    .replaceAll('{{PROJECT_LINKS}}', projectLinks(texts));

/**
 * A store's page, or the home's store buttons in a preview made before the extension is on that store.
 * @param {Store} store
 * @param {string} home the home page from the page that links
 */
function storePage(store, home) {
  if (STORE_PAGES[store]) return STORE_PAGES[store];
  if (preview) return `${home}#install`;
  throw new Error(
    `STORE_PAGES.${store} is not set in scripts/site.mjs: the site needs the extension's page on that store.`,
  );
}

/**
 * The pictures of the switcher on the home (site/visuals/visuals.json, docs.md): each scene's page in site/visuals/,
 * drawn at twice its size for sharp screens, into assets/visuals/<scene>.png.
 * @param {string} siteDir
 * @param {string} target
 */
async function drawVisuals(siteDir, target) {
  /** @type {Scene[]} */
  const scenes = JSON.parse(read(join(siteDir, 'visuals/visuals.json')));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    for (const scene of scenes) {
      await page.goto(`file://${resolve(siteDir, 'visuals', `${scene.scene}.html`)}`);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      mkdirSync(target, { recursive: true });
      await page.screenshot({ path: join(target, `${scene.scene}.png`) });
    }
  } finally {
    await browser.close();
  }
  return scenes;
}

/**
 * The home's carousel: a tab and a slide for each scene, with its name and its sentence in the page's language.
 * @param {Scene[]} scenes
 * @param {HomeTexts} texts
 * @param {string} rootPath
 */
function visualParts(scenes, texts, rootPath) {
  const [first] = scenes;
  if (!first) throw new Error('site/visuals/visuals.json lists no scene: the home needs at least one view.');
  const tabs = scenes.map(
    (scene, index) =>
      `          <button type="button" role="tab" id="view-tab-${scene.scene}" aria-controls="view-${scene.scene}" aria-selected="${index === 0}"${index === 0 ? '' : ' tabindex="-1"'}>${encode(texts[scene.name])}</button>`,
  );
  const slides = scenes.map(
    (scene) =>
      `          <figure class="view" role="tabpanel" id="view-${scene.scene}" aria-labelledby="view-tab-${scene.scene}" data-caption="${encode(texts[scene.text])}">` +
      `<img src="${rootPath}assets/visuals/${scene.scene}.png" width="1280" height="800" alt="${encode(texts[scene.name])}" loading="lazy"></figure>`,
  );
  const dots = scenes.map((_, index) => `        <span${index === 0 ? ' class="current"' : ''}></span>`);
  return {
    tabs: tabs.join('\n'),
    slides: slides.join('\n'),
    dots: dots.join('\n'),
    firstName: encode(texts[first.name]),
    firstCaption: encode(texts[first.text]),
  };
}

const work = mkdtempSync(join(tmpdir(), 'better-tab-switcher-site-'));
try {
  // Released versions that have the site: tags vX.Y.Z with site/guide/sections.txt, newest first.
  const hasGit = gitSucceeds('--version');
  if (!hasGit && !preview) throw new Error('git is required to build the released guide versions.');
  if (hasGit) gitSucceeds('fetch', '--tags', '--quiet');
  /** @type {Version[]} */
  const versions = (hasGit ? execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n') : [])
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag) && gitSucceeds('cat-file', '-e', `${tag}:site/guide/sections.txt`))
    .map((tag) => ({
      name: tag.slice(1),
      tag,
      // Three numbers: the tag matched vX.Y.Z above.
      numbers: /** @type {[number, number, number]} */ (tag.slice(1).split('.').map(Number)),
      dir: join(work, tag.slice(1), 'site'),
    }))
    .sort((a, b) => b.numbers[0] - a.numbers[0] || b.numbers[1] - a.numbers[1] || b.numbers[2] - a.numbers[2]);
  for (const version of versions) {
    const archive = join(work, `${version.name}.tar`);
    execFileSync('git', ['archive', '--format=tar', '-o', archive, version.tag, 'site']);
    mkdirSync(join(work, version.name));
    execFileSync('tar', ['-xf', archive, '-C', join(work, version.name)]);
  }

  /** @type {Guide[]} */
  const guides = [];
  if (preview) {
    const dir = join(root, 'site');
    guides.push({ name: 'next', label: 'next (unreleased)', dir, sections: readSections(join(dir, 'guide')) });
  }
  versions.forEach((version, index) => {
    guides.push({
      name: version.name,
      label: index === 0 ? `${version.name} (latest)` : version.name,
      dir: version.dir,
      sections: readSections(join(version.dir, 'guide')),
    });
  });
  if (guides.length === 0) throw new Error('No release has site/guide yet. Use make docs to preview.');

  // Look and home page: the current code for a preview, else the latest release.
  // Not a preview: guides is not empty, so there is a release.
  const look = preview ? join(root, 'site') : /** @type {Version} */ (versions[0]).dir;
  const latest = versions[0]?.name ?? 'next';

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(join(look, 'assets'), join(output, 'assets'), { recursive: true });
  // The extension's own icons: the site's logo and the browser tab's icon.
  cpSync('public/icon/128.png', join(output, 'assets/logo.png'));
  cpSync('public/icon/32.png', join(output, 'favicon.png'));
  const scenes = await drawVisuals(look, join(output, 'assets/visuals'));

  const header = read(join(look, '_header.html'));
  const footer = read(join(look, '_footer.html'));
  const guidePage = read(join(look, 'guide/_page.html'));

  // Home pages, one per language (discoverability.md): the texts of site/home/<code>.json filled into index.html.
  const homeTemplate = read(join(look, 'index.html'));
  const english = readHomeTexts(look, 'en');
  for (const language of HOME_LANGUAGES) {
    homeLanguages.push({
      ...language,
      texts: language.code === 'en' ? english : readHomeTexts(look, language.code),
      extension: await readExtensionTexts(language.locale),
      url: SITE_URL + (language.folder ? `${language.folder}/` : ''),
    });
  }
  const alternates = [
    ...homeLanguages.map((language) => `<link rel="alternate" hreflang="${language.code}" href="${language.url}">`),
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}">`,
  ].join('\n');
  for (const language of homeLanguages) {
    const { texts, extension } = language;
    const rootPath = language.folder ? '../' : '';
    const homeHeader = setStorePages(header, '')
      .replaceAll('{{LANGUAGE_MENU}}', languageMenu(language, rootPath))
      .replaceAll('{{HOME}}', './')
      .replaceAll('{{GUIDE_CURRENT}}', '');
    const visuals = visualParts(scenes, texts, rootPath);
    let page = setStorePages(homeTemplate, '')
      .replaceAll('{{HEADER}}', setNavTexts(homeHeader, texts))
      .replaceAll('{{BANNER}}', language.code === 'en' ? languageBanner() : '')
      .replaceAll('{{FOOTER}}', setFooterTexts(footer, texts))
      .replaceAll('{{PROJECT_LINKS}}', projectLinks(texts))
      .replaceAll('{{VISUAL_TABS}}', visuals.tabs)
      .replaceAll('{{VISUAL_SLIDES}}', visuals.slides)
      .replaceAll('{{VISUAL_DOTS}}', visuals.dots)
      .replaceAll('{{VISUAL_FIRST_NAME}}', visuals.firstName)
      .replaceAll('{{VISUAL_FIRST_CAPTION}}', visuals.firstCaption)
      .replaceAll('{{ALTERNATES}}', alternates)
      .replaceAll('{{PAGE_URL}}', language.url)
      .replaceAll('{{LANG}}', language.code)
      .replaceAll('{{DIR}}', language.rtl ? 'rtl' : 'ltr')
      .replaceAll('{{ROOT}}', rootPath)
      .replaceAll('{{VERSION}}', latest)
      .replaceAll('{{SITE_URL}}', SITE_URL)
      .replaceAll('{{REPOSITORY}}', REPOSITORY);
    const values = {
      ...texts,
      slogan: english.slogan,
      description: extension.description,
      chrome_store: extension.chromeStore,
      edge_store: extension.edgeStore,
      fine_print: texts.fine_print.replace('{version}', latest),
    };
    for (const [key, value] of Object.entries(values)) {
      page = page
        .replaceAll(`{{attr:${key}}}`, encode(value))
        .replaceAll(`{{json:${key}}}`, JSON.stringify(value))
        .replaceAll(`{{${key}}}`, String(value));
    }
    const left = /\{\{[^}]+\}\}/.exec(page);
    if (left) throw new Error(`index.html has no text for ${left[0]} in site/home/${language.code}.json`);
    write(join(output, language.folder ? `${language.folder}/index.html` : 'index.html'), page);
  }

  // The newest guide: guide/latest/ opens it, every version's page points to its page as the canonical one (so search
  // engines show the newest guide, not an older copy of it) and sitemap.xml lists its pages.
  // There is always one: guides is not empty, and without a preview latest is one of its versions.
  const newest = /** @type {Guide} */ (preview ? guides[0] : guides.find((guide) => guide.name === latest));

  // The guide is only in English: the English texts, no language menu, links to the English home.
  const guideHeader = setNavTexts(
    setStorePages(header, '../../')
      .replaceAll('{{LANGUAGE_MENU}}', '')
      .replaceAll('{{HOME}}', '../../')
      .replaceAll('{{GUIDE_CURRENT}}', ' aria-current="page"'),
    english,
  );
  const guideFooter = setFooterTexts(footer, english);
  for (const guide of guides) {
    const out = join(output, 'guide', guide.name);
    const images = join(guide.dir, 'guide/img');
    if (existsSync(images)) cpSync(images, join(out, 'img'), { recursive: true });
    guide.sections.forEach((section, index) => {
      const options = guides.map((other) => {
        const target = other.sections.some((s) => s.slug === section.slug)
          ? section.slug
          : /** @type {Section} */ (other.sections[0]).slug;
        const selected = other.name === guide.name ? ' selected' : '';
        return `        <option value="../${other.name}/${target}.html"${selected}>${encode(other.label)}</option>`;
      });
      const links = guide.sections.map(
        (link) =>
          `      <a href="${link.slug}.html"${link.slug === section.slug ? ' aria-current="page"' : ''}>${encode(link.title)}</a>`,
      );
      const pager = [];
      const previous = guide.sections[index - 1];
      const next = guide.sections[index + 1];
      if (previous)
        pager.push(
          `      <a class="prev" href="${previous.slug}.html"><span>Previous</span>${encode(previous.title)}</a>`,
        );
      if (next) pager.push(`      <a class="next" href="${next.slug}.html"><span>Next</span>${encode(next.title)}</a>`);
      const canonicalVersion = newest.sections.some((s) => s.slug === section.slug) ? newest.name : guide.name;
      const content = read(join(guide.dir, `guide/${section.slug}.html`))
        .trimEnd()
        .split('\n')
        .map((line) => (line.trim() ? `    ${line}` : ''))
        .join('\n');
      const page = guidePage
        .replaceAll('{{HEADER}}', guideHeader.replaceAll('{{ROOT}}', '../../'))
        .replaceAll('{{FOOTER}}', guideFooter)
        .replaceAll('{{VERSION_OPTIONS}}', options.join('\n'))
        .replaceAll('{{SECTION_LINKS}}', links.join('\n'))
        .replaceAll('{{PAGER}}', pager.join('\n'))
        .replaceAll('{{CONTENT}}', content)
        .replaceAll('{{CANONICAL}}', `${SITE_URL}guide/${canonicalVersion}/${section.slug}.html`)
        .replaceAll('{{SITE_URL}}', SITE_URL)
        .replaceAll('{{TITLE}}', encode(section.title))
        .replaceAll('{{VERSION}}', guide.name);
      write(join(out, `${section.slug}.html`), page);
    });
    write(join(out, 'index.html'), redirect(`${/** @type {Section} */ (guide.sections[0]).slug}.html`));
  }

  // guide/latest/ always opens the newest released guide (the preview opens "next").
  for (const section of newest.sections) {
    write(join(output, `guide/latest/${section.slug}.html`), redirect(`../${newest.name}/${section.slug}.html`));
  }
  write(join(output, 'guide/latest/index.html'), redirect(`../${newest.name}/`));
  write(join(output, 'guide/index.html'), redirect('latest/'));

  // sitemap.xml: the pages search engines should read, the home in every language and the newest guide (submitted in
  // Google Search Console, discoverability.md).
  const urls = [
    ...homeLanguages.map((language) => language.url),
    ...newest.sections.map((section) => `${SITE_URL}guide/${newest.name}/${section.slug}.html`),
  ];
  write(
    join(output, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${encode(url)}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
  );

  console.log(`Site built in ${join(root, output)}: guide versions ${guides.map((guide) => guide.name).join(', ')}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
