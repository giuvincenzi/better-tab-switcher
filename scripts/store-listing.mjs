// make store-listing: everything the stores' dashboards (Chrome Web Store, Edge Add-ons) ask for besides the extension,
// in .output/store-listing/, to paste or upload by hand (discoverability.md). The release uploads only the extension.
// - <code>.txt: the page's description in each language, laid out like the README (the slogan, the links to the website
//   and to the guide, title + ". " + description), then the home's features and privacy: Edge asks for at least 250
//   characters describing every feature. Every text is read from where it is written, so the stores never say anything
//   the site doesn't.
// - icon-128.png, logo-300.png: the extension's icon (Chrome's store icon, Edge's logo, 300×300 recommended).
// - screenshot-<n>-<scene>.png: the site's views (site/visuals/), at the 1280×800 both stores take.
// - privacy.txt: the answers of both stores' Privacy page, one per permission of the manifest.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { HOME_LANGUAGES, readExtensionTexts, SITE_URL } from './languages.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const out = '.output/store-listing';
/** Edge's least description. */
const EDGE_MINIMUM = 250;

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
/** The text of the home's HTML values (the privacy list), for a plain text field. @param {string} html */
const plain = (html) =>
  html
    .replace(/<li>/g, '\n• ')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

mkdirSync(out, { recursive: true });

// The descriptions.
const { slogan } = homeTexts('en');
for (const language of HOME_LANGUAGES) {
  const home = homeTexts(language.code);
  const { description } = await readExtensionTexts(language.locale);
  const features = ['recent', 'search', 'views', 'pages', 'language', 'open']
    .map((key) => `• ${home[`${key}_title`]}: ${home[`${key}_text`]}`)
    .join('\n');
  const page = [
    slogan,
    `🌐 ${home.website_label}: ${SITE_URL}${language.folder ? `${language.folder}/` : ''}\n📖 ${home.nav_guide}: ${SITE_URL}guide/latest/`,
    `${home.title}. ${description}`,
    `${home.features_title}\n${features}`,
    `${home.privacy_title}\n${plain(home.privacy_text)}`,
  ].join('\n\n');
  if ([...page].length < EDGE_MINIMUM)
    throw new Error(`${language.code}: the description is under ${EDGE_MINIMUM} characters.`);
  writeFileSync(join(out, `${language.code}.txt`), `${page}\n`);
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
${homeTexts('en').title}: a keyboard shortcut (Alt+Y by default) or the toolbar icon shows your open tabs, the most recently used first, in a list or a grid, to switch to one, search them or close them.

Permission justification
${asked.map((/** @type {keyof typeof PERMISSIONS} */ name) => `${name}: ${PERMISSIONS[name]}`).join('\n')}

Remote code
No, I am not using remote code.

Data usage
Collected data: none (leave every type unchecked). Tick the certifications: no selling or transfer of user data, no use unrelated to the single purpose, no use for creditworthiness or lending.

Privacy policy URL
${SITE_URL}guide/latest/privacy.html (not required: the extension collects no data)
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
