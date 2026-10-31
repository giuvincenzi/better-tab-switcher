// make store-listing: everything the stores' dashboards (Chrome Web Store, Edge Add-ons) ask for besides the extension,
// in .output/store-listing/, to paste or upload by hand (discoverability.md). The release uploads only the extension.
// - <code>.txt: the page's description in each language, laid out like the README (the slogan, the links to the website
//   and to the guide, title + ". " + description), then the home's features and privacy: Edge asks for at least 250
//   characters describing every feature. Every text is read from where it is written, so the stores never say anything
//   the site doesn't; the features and the privacy are the ones of the home's template (site/index.html), in its order,
//   so a box added to the home is in the stores too.
// - <code>-search-terms.txt: Edge's search terms in each language, one per line (store_search_terms of
//   site/home/<code>.json, comma-separated), within Edge's limits.
// - icon-128.png, logo-300.png: the extension's icon (Chrome's store icon, Edge's logo, 300×300 recommended).
// - screenshot-<n>-<scene>.png: the site's views (site/visuals/), at the 1280×800 both stores take.
// - privacy.txt: the answers of both stores' Privacy page, one per permission of the manifest.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { HOME_LANGUAGES, readExtensionTexts, SITE_URL } from './languages.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const out = '.output/store-listing';
/** Edge's least description. */
const EDGE_MINIMUM = 250;
/** Edge's limits on the search terms: how many, the characters of each, the words of all. */
const SEARCH_TERMS = { terms: 7, characters: 30, words: 21 };

/** Why the extension needs each permission of its manifest (wxt.config.ts), in the stores' Privacy page. */
const PERMISSIONS = {
  tabs: 'Reads the titles, addresses and icons of your open tabs to show them in the switcher, and switches to or closes the tab you choose.',
  activeTab:
    'When you press the shortcut or click the toolbar icon, shows the switcher over the page you are on. It gets no access to any other page, and none before you ask for the switcher.',
  scripting:
    'Puts the switcher into the page you are on when you open it there, with the access activeTab gives for that page.',
  storage:
    'Saves your settings in the browser, and keeps the pictures of the tabs for the grid’s previews in memory only (storage.session), never on disk.',
  favicon: 'Shows each tab’s site icon from the browser’s own icon cache, so nothing is downloaded from the internet.',
  tabGroups: 'Shows the color of each tab’s group in the switcher.',
};

/** @param {string} code */
const homeTexts = (code) => JSON.parse(readFileSync(`site/home/${code}.json`, 'utf8'));

/**
 * The keys of a section of the home's template (site/index.html), in its order: its heading, then each box's title and
 * text (`<h3>{{x_title}}</h3><p>{{x_text}}</p>`), or its one text (`<div class="privacy-text">{{privacy_text}}</div>`).
 * @param {string} id
 */
function homeSection(id) {
  const template = readFileSync('site/index.html', 'utf8');
  const section = new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(template)?.[0];
  const heading = section && /<h2>\{\{(\w+)\}\}<\/h2>/.exec(section)?.[1];
  if (!section || !heading) throw new Error(`site/index.html has no section "${id}" with a heading.`);
  const boxes = [...section.matchAll(/<h3>\{\{(\w+)\}\}<\/h3><p>\{\{(\w+)\}\}<\/p>/g)].map(([, title, text]) => ({
    title: /** @type {string} */ (title),
    text: /** @type {string} */ (text),
  }));
  const text = /<div class="privacy-text">\{\{(\w+)\}\}<\/div>/.exec(section)?.[1];
  return { heading, boxes, text };
}

/**
 * A text of a language's home, or an error naming the file and the key: never "undefined" in a store's page.
 * @param {Record<string, string>} home
 * @param {string} code
 * @param {string} key
 */
function textOf(home, code, key) {
  const value = home[key];
  if (typeof value !== 'string' || !value) throw new Error(`site/home/${code}.json has no ${key}.`);
  return value;
}
/** The text of the home's HTML values (the privacy list), for a plain text field. @param {string} html */
const plain = (html) =>
  html
    .replace(/<li>/g, '\n• ')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Emptied first: a file the kit no longer has (a view renamed or removed) must not stay there to be uploaded.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The descriptions.
const features = homeSection('features');
const privacy = homeSection('privacy');
if (!features.boxes.length) throw new Error('site/index.html has no feature box in its "features" section.');
if (!privacy.text) throw new Error('site/index.html has no privacy text in its "privacy" section.');
const slogan = textOf(homeTexts('en'), 'en', 'slogan');
for (const language of HOME_LANGUAGES) {
  const home = homeTexts(language.code);
  /** @param {string} key */
  const text = (key) => textOf(home, language.code, key);
  const { description } = await readExtensionTexts(language.locale);
  if (!description) throw new Error(`locales/${language.locale}.yml has no Extension_Description.`);
  const boxes = features.boxes.map((box) => `• ${text(box.title)}: ${text(box.text)}`).join('\n');
  const page = [
    slogan,
    `🌐 ${text('website_label')}: ${SITE_URL}${language.folder ? `${language.folder}/` : ''}\n📖 ${text('nav_guide')}: ${SITE_URL}guide/latest/`,
    `${text('title')}. ${description}`,
    `${text(features.heading)}\n${boxes}`,
    `${text(privacy.heading)}\n${plain(text(/** @type {string} */ (privacy.text)))}`,
  ].join('\n\n');
  if ([...page].length < EDGE_MINIMUM)
    throw new Error(`${language.code}: the description is under ${EDGE_MINIMUM} characters.`);
  writeFileSync(join(out, `${language.code}.txt`), `${page}\n`);
  const terms = text('store_search_terms')
    .split(',')
    .map((term) => term.trim());
  const words = terms.join(' ').split(/\s+/).length;
  const long = terms.filter((term) => !term || [...term].length > SEARCH_TERMS.characters);
  if (terms.length > SEARCH_TERMS.terms || words > SEARCH_TERMS.words || long.length)
    throw new Error(
      `site/home/${language.code}.json: store_search_terms takes up to ${SEARCH_TERMS.terms} terms of ${SEARCH_TERMS.characters} characters, ${SEARCH_TERMS.words} words in all (${terms.length} terms, ${words} words${long.length ? `, too long or empty: ${long.join(', ')}` : ''}).`,
    );
  writeFileSync(join(out, `${language.code}-search-terms.txt`), `${terms.join('\n')}\n`);
}

// The Privacy page: a reason for each permission the manifest asks for, no more and no fewer.
const config = readFileSync('wxt.config.ts', 'utf8');
const asked = JSON.parse((/permissions: (\[[^\]]*\])/.exec(config)?.[1] ?? '[]').replaceAll("'", '"'));
const reasons = Object.keys(PERMISSIONS);
const unexplained = asked.filter((/** @type {string} */ name) => !reasons.includes(name));
const unused = reasons.filter((name) => !asked.includes(name));
if (unexplained.length || unused.length)
  throw new Error(
    `scripts/store-listing.mjs: give a reason for ${unexplained.join(', ') || '-'}; remove ${unused.join(', ') || '-'}.`,
  );
writeFileSync(
  join(out, 'privacy.txt'),
  `Privacy page of the Chrome Web Store and of Edge Add-ons

Single purpose
${textOf(homeTexts('en'), 'en', 'title')}. ${(await readExtensionTexts('en')).description}

Permission justification
${asked.map((/** @type {keyof typeof PERMISSIONS} */ name) => `${name}: ${PERMISSIONS[name]}`).join('\n')}

Remote code
No, I am not using remote code.

Data usage
Collected data: none (leave every type unchecked). Tick the certifications: no selling or transfer of user data, no use unrelated to the single purpose, no use for creditworthiness or lending.

Privacy policy URL
${SITE_URL}guide/latest/privacy.html (required: the extension reads the titles and addresses of the tabs, though it never sends them anywhere)
`,
);

// The pictures.
copyFileSync('public/icon/128.png', join(out, 'icon-128.png'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:300px;height:300px}</style>${readFileSync('assets/icon.svg', 'utf8')}`,
  );
  await page.screenshot({ path: join(out, 'logo-300.png'), omitBackground: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  /** @type {{ scene: string }[]} */
  const scenes = JSON.parse(readFileSync('site/visuals/visuals.json', 'utf8'));
  for (const [index, scene] of scenes.entries()) {
    await page.goto(`file://${resolve('site/visuals', `${scene.scene}.html`)}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, `screenshot-${index + 1}-${scene.scene}.png`) });
  }
} finally {
  await browser.close();
}
console.log(`The stores' descriptions, pictures and Privacy answers are in ${out}/.`);
