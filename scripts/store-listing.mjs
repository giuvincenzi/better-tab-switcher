// make store-listing: the description of the stores' pages (Chrome Web Store, Edge Add-ons), one per language, in
// .output/store-listing/<code>.txt, to paste into each store's dashboard (discoverability.md). Like the README: the
// slogan, the links to the website and to the guide, then the title and the description, each read from where it is
// written, so the stores never say anything the site doesn't. The release uploads only the extension, not this page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { HOME_LANGUAGES, readExtensionTexts, SITE_URL } from './languages.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);
const out = '.output/store-listing';

/** @param {string} code */
const homeTexts = (code) => JSON.parse(readFileSync(`site/home/${code}.json`, 'utf8'));

const { slogan } = homeTexts('en');
mkdirSync(out, { recursive: true });
for (const language of HOME_LANGUAGES) {
  const home = homeTexts(language.code);
  const { description } = await readExtensionTexts(language.locale);
  const page = [
    slogan,
    `🌐 ${home.website_label}: ${SITE_URL}${language.folder ? `${language.folder}/` : ''}\n📖 ${home.nav_guide}: ${SITE_URL}guide/latest/`,
    `${home.title}. ${description}`,
  ].join('\n\n');
  writeFileSync(join(out, `${language.code}.txt`), `${page}\n`);
}
console.log(`The stores' descriptions are in ${out}/, one per language.`);
