// The third-party components the extension ships (third-party.json, docs.md): the text of their licenses, written into
// the extension as third-party-licenses.txt by the build (wxt.config.ts). The MIT license asks for its notice in every
// copy of the code, and the stores' zip is one.
import { readFileSync } from 'node:fs';

/** @typedef {{ name: string, title: string, url: string, license: string, copyright: string }} ThirdParty */

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

/** @returns {ThirdParty[]} */
export function readThirdParty() {
  return JSON.parse(readFileSync(new URL('../third-party.json', import.meta.url), 'utf8')).packages;
}

/** The text of third-party-licenses.txt: each component with its copyright and its license. */
export function licensesText() {
  const parts = readThirdParty().map((component) => {
    // Only MIT is written here: a component under another license needs its own text, decided when it is added.
    if (component.license !== 'MIT') throw new Error(`${component.name} is not MIT: add its license text here.`);
    return `${component.name} (${component.url})\n\nMIT License\n\n${component.copyright}\n\n${MIT}`;
  });
  return `Better Tab Switcher includes these third-party components.\n\n${parts.join(`\n\n${'-'.repeat(80)}\n\n`)}\n`;
}
