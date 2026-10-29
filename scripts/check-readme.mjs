// Checks that README.md says the slogan, the title and the description (discoverability.md): the slogan of
// site/home/en.json in its italic line under the name, and between its "Title and description" comments
// "<title>. <description>", the title of site/home/en.json and the description of locales/en.yml (Extension_Description).
// Also that it lists every third-party component of third-party.json (docs.md). Run by the test workflow (site_test).
import { readFileSync } from 'node:fs';
import { parseMessagesFile } from '@wxt-dev/i18n/build';
import { readThirdParty } from './third-party.mjs';

const { title, slogan } = JSON.parse(readFileSync('site/home/en.json', 'utf8'));
const messages = await parseMessagesFile('locales/en.yml');
const description = messages.find((message) => message.key.join('_') === 'Extension_Description');
if (!description || !('message' in description)) throw new Error('locales/en.yml has no Extension_Description.');
const expected = `${title}. ${description.message}`;

const readme = readFileSync('README.md', 'utf8');
const match = /<!-- Title and description:[^\n]*-->\s*([\s\S]*?)\s*<!-- End of title and description -->/.exec(readme);
if (!match) throw new Error('README.md has lost its "Title and description" comments.');
const actual = (match[1] ?? '').replace(/\s+/g, ' ').trim();
if (actual !== expected) {
  throw new Error(`README.md does not say the title and description. Write between its comments:\n${expected}`);
}
if (!readme.includes(`<p align="center"><i>${slogan}</i></p>`)) {
  throw new Error(`README.md does not say the slogan. Write under its name:\n<p align="center"><i>${slogan}</i></p>`);
}
const missing = readThirdParty().filter((component) => !readme.includes(`[${component.title}](${component.url})`));
if (missing.length) {
  throw new Error(
    `README.md doesn't list these third-party components (third-party.json):\n${missing
      .map((component) => `- [${component.title}](${component.url}) (${component.license})`)
      .join('\n')}`,
  );
}
console.log('README.md says the slogan, title and description, and lists the third-party components.');
