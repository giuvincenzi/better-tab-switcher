// Checks that third-party.json lists exactly the npm packages whose code is in the extension (docs.md): it builds the
// published extension with source maps in a temporary folder, reads from the maps which packages the code comes from,
// and compares. Also checks that the build wrote third-party-licenses.txt with every one of them. Run by the test
// workflow (build_extension) and by `make third-party`.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'wxt';
import { readThirdParty } from './third-party.mjs';

const outDir = mkdtempSync(join(tmpdir(), 'better-tab-switcher-third-party-'));
try {
  await build({ outDir, vite: () => ({ build: { sourcemap: true } }) });
  const extension = join(outDir, 'chrome-mv3');

  /** @type {Set<string>} */
  const shipped = new Set();
  for (const file of readdirSync(extension, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.map')) continue;
    /** @type {{ sources: string[] }} */
    const map = JSON.parse(readFileSync(join(extension, file), 'utf8'));
    for (const source of map.sources) {
      // The package a file comes from: the last node_modules/<name> of its path.
      const found = [...source.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].pop();
      if (found?.[1]) shipped.add(found[1]);
    }
  }
  const listed = new Set(readThirdParty().map((component) => component.name));
  const problems = [
    ...[...shipped]
      .filter((name) => !listed.has(name))
      .map((name) => `${name} is in the extension but not in third-party.json.`),
    ...[...listed]
      .filter((name) => !shipped.has(name))
      .map((name) => `${name} is in third-party.json but not in the extension.`),
  ];
  const licenses = readFileSync(join(extension, 'third-party-licenses.txt'), 'utf8');
  for (const name of listed) {
    if (!licenses.includes(`${name} (`)) problems.push(`third-party-licenses.txt doesn't have ${name}.`);
  }
  if (problems.length) {
    throw new Error(`Third-party components (docs.md):\n- ${problems.join('\n- ')}`);
  }
  console.log(
    `third-party.json lists the ${shipped.size} packages in the extension, and the build writes their licenses.`,
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
