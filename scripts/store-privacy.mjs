// The stores' Privacy page asks a justification for each permission the uploaded package's manifest asks for (Chrome Web
// Store: developer.chrome.com/docs/webstore/cws-dashboard-privacy; Edge Add-ons: learn.microsoft.com, "Publish an
// extension", step 6). The fields come from the uploaded package, and neither store's API writes them: a release that
// asks for something new waits for them to be pasted by hand (publish_release, build-and-release.md).
//
//   node scripts/store-privacy.mjs <manifest.json> [<previous release's manifest.json>]
//
// prints, in Markdown, what the release asks for that the previous one didn't, with the text to paste for each; nothing
// when it asks for nothing new. Without a previous manifest (the first release) everything is new.
import { readFileSync } from 'node:fs';

/** Why the extension needs each permission of its manifest (wxt.config.ts), in the stores' Privacy page. */
export const PERMISSION_REASONS = {
  tabs: 'Reads the titles, addresses and icons of your open tabs to show them in the switcher, and switches to or closes the tab you choose.',
  activeTab:
    'When you press the shortcut or click the toolbar icon, shows the switcher over the page you are on. It gets no access to any other page, and none before you ask for the switcher.',
  scripting:
    'Puts the switcher into the page you are on when you open it there, with the access activeTab gives for that page.',
  storage:
    'Saves your settings in the browser, and keeps the pictures of the tabs for the grid’s previews in memory only (storage.session), never on disk.',
  favicon: 'Shows each tab’s site icon from the browser’s own icon cache, so nothing is downloaded from the internet.',
  tabGroups: 'Shows the color of each tab’s group in the switcher.',
  webNavigation:
    'Knows when a tab loads a new page, so the switcher is put into a page only once and not again when a site only changes its address. It keeps no record of the pages visited.',
};

/** The manifest's keys whose entries the stores' Privacy page asks a justification for. */
const ASKING_KEYS = ['permissions', 'optional_permissions', 'host_permissions', 'optional_host_permissions'];

/**
 * Everything a manifest asks for that needs a justification, sorted.
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function asks(manifest) {
  const all = ASKING_KEYS.flatMap((key) => /** @type {string[]} */ (manifest[key] ?? []));
  return [...new Set(all)].sort();
}

/**
 * What `manifest` asks for that `previous` didn't; everything without a previous manifest.
 * @param {Record<string, unknown>} manifest
 * @param {Record<string, unknown> | undefined} previous
 */
export function newAsks(manifest, previous) {
  const had = new Set(previous ? asks(previous) : []);
  return asks(manifest).filter((name) => !had.has(name));
}

/**
 * The justification to paste for one thing the manifest asks for. Fails when none is written here.
 * @param {string} name
 */
export function reasonOf(name) {
  const reason = /** @type {Record<string, string>} */ (PERMISSION_REASONS)[name];
  if (!reason) throw new Error(`scripts/store-privacy.mjs: write the stores' justification of ${name}.`);
  return reason;
}

/**
 * What to paste in both stores' Privacy page, in Markdown; empty when nothing is new.
 * @param {string[]} names
 */
export function pasteGuide(names) {
  if (names.length === 0) return '';
  return [
    `This release asks for ${names.map((name) => `\`${name}\``).join(', ')}, which the last release didn't.`,
    'Paste each justification into the Privacy page of both stores, once the package is uploaded there (the fields come',
    'from the uploaded package): Chrome Web Store, Developer Dashboard > Privacy; Microsoft Edge Add-ons, Partner Center >',
    'Privacy. Save, then approve the job confirm_privacy_answers of the publish_release run.',
    '',
    ...names.map((name) => `- \`${name}\`: ${reasonOf(name)}`),
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [current, previous] = process.argv.slice(2);
  if (!current) throw new Error('Usage: node scripts/store-privacy.mjs <manifest.json> [<previous manifest.json>]');
  /** @param {string} path */
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const guide = pasteGuide(newAsks(read(current), previous ? read(previous) : undefined));
  if (guide) console.log(guide);
}
