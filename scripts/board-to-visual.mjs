// make visual board=<file> name=<scene>: turns one board of the Design canvas (its .dc.html source, as the Artifact tool
// or the canvas's export gives it) into the static page site/visuals/<scene>.html, the source of that scene's picture on
// the website (docs.md, "The website's pictures"). The board's template is filled with its own values, as the canvas
// shows it: the page needs nothing of the canvas to be drawn.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const [boardPath, name] = process.argv.slice(2);
if (!boardPath || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Usage: make visual board=<board.dc.html> name=<scene> (scene: lowercase letters, digits and dashes).');
  process.exit(1);
}

const source = readFileSync(boardPath, 'utf8');
const markup = /<x-dc>([\s\S]*)<\/x-dc>/.exec(source)?.[1];
const code = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1];
const title = /<title>([\s\S]*?)<\/title>/.exec(source)?.[1] ?? name;
if (!markup || !code) throw new Error(`${boardPath} is not a Design canvas board: it has no <x-dc> or no x-dc script.`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const { head, body } = await page.evaluate(
    ({ markup, code }) => {
      // The board's logic, as the canvas runs it: its values with no property changed (the board's own).
      class DCLogic {
        /** @param {object} props */
        constructor(props) {
          this.props = props;
          this.state = {};
        }
        setState() {}
        forceUpdate() {}
      }
      const Component = new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic);
      const values = new Component({}).renderVals();

      const hole = /\{\{\s*([^}]+?)\s*\}\}/g;
      /**
       * @param {string} path
       * @param {Record<string, unknown>} scope
       * @returns {unknown}
       */
      const lookup = (path, scope) => {
        if (path === 'true' || path === 'false') return path === 'true';
        if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
        return path
          .split('.')
          .reduce(
            (/** @type {unknown} */ value, key) =>
              value == null ? undefined : /** @type {Record<string, unknown>} */ (value)[key],
            /** @type {unknown} */ (scope),
          );
      };
      /**
       * @param {string} text
       * @param {Record<string, unknown>} scope
       */
      const fill = (text, scope) => text.replace(hole, (_, path) => String(lookup(path, scope) ?? ''));

      /** @type {Node[]} */
      const headParts = [];
      /**
       * @param {Node} node
       * @param {Record<string, unknown>} scope
       * @returns {Node[]}
       */
      const render = (node, scope) => {
        if (node.nodeType === Node.TEXT_NODE) return [document.createTextNode(fill(node.textContent ?? '', scope))];
        if (node.nodeType !== Node.ELEMENT_NODE) return [];
        const element = /** @type {Element} */ (node);
        /**
         * @param {Node} from
         * @param {Record<string, unknown>} inScope
         * @returns {Node[]}
         */
        const children = (from, inScope) => [...from.childNodes].flatMap((child) => render(child, inScope));
        const tag = element.localName;
        /** @param {string} attribute */
        const whole = (attribute) =>
          lookup(/^\{\{\s*([^}]+?)\s*\}\}$/.exec(element.getAttribute(attribute) ?? '')?.[1] ?? '', scope);
        if (tag === 'helmet') {
          for (const part of children(element, scope)) headParts.push(part);
          return [];
        }
        if (tag === 'sc-if') return whole('value') ? children(element, scope) : [];
        if (tag === 'sc-for') {
          const as = element.getAttribute('as') ?? 'item';
          return /** @type {unknown[]} */ (whole('list') ?? []).flatMap((item, index) =>
            children(element, { ...scope, [as]: item, $index: index }),
          );
        }
        const copy = document.createElement(tag);
        for (const { name: attribute, value } of [...element.attributes]) {
          if (attribute.startsWith('hint-')) continue;
          const only = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(value);
          const filled = only ? lookup(/** @type {string} */ (only[1]), scope) : fill(value, scope);
          // Handlers and missing values have nothing to draw.
          if (typeof filled === 'function' || filled === undefined || filled === null) continue;
          copy.setAttribute(attribute, String(filled));
        }
        for (const child of children(element, scope)) copy.append(child);
        return [copy];
      };

      const template = document.createElement('template');
      template.innerHTML = markup;
      const body = document.createElement('div');
      for (const part of [...template.content.childNodes].flatMap((node) => render(node, values))) body.append(part);
      const head = document.createElement('div');
      for (const part of headParts) head.append(part);
      return { head: head.innerHTML.trim(), body: body.innerHTML.trim() };
    },
    { markup, code },
  );

  const target = resolve('site/visuals', `${name}.html`);
  writeFileSync(
    target,
    [
      '<!doctype html>',
      `<!-- Made by scripts/board-to-visual.mjs from the Design canvas board "${title}" (${basename(boardPath)}).`,
      '     To change it, change the board on the canvas and run make visual again (docs.md). -->',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${title}</title>`,
      head,
      '</head>',
      '<body>',
      body,
      '</body>',
      '</html>',
      '',
    ].join('\n'),
  );
  console.log(`site/visuals/${name}.html made from ${boardPath}.`);
} finally {
  await browser.close();
}
