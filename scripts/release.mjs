// The release's version and CHANGELOG sections (build-and-release.md, "Releases"). Used by the create_release_pr workflow
// (the next version, the CHANGELOG section) and the publish_release workflow (the release notes):
//
//   node scripts/release.mjs next              the next version, from the release tags vX.Y.Z and "## Unreleased"
//   node scripts/release.mjs move <version>    "## Unreleased"'s entries under "## <version>", printed too
//   node scripts/release.mjs notes <version>   the release notes of <version>: its CHANGELOG section
//
// The next version is the latest tag vX.Y.Z plus a minor step (X.Y+1.0) when "## Unreleased" has entries under
// "### Added" or "### Changed", a patch step (X.Y.Z+1) when it has entries only under "### Fixed". The first release,
// with no tag yet, is 1.0.0.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @typedef {'Added' | 'Changed' | 'Fixed'} Subsection */
/** @typedef {[number, number, number]} Version */

/** @type {string[]} */
const SUBSECTIONS = ['Added', 'Changed', 'Fixed'];
const FIRST_VERSION = '1.0.0';
const CHANGELOG = 'CHANGELOG.md';

/**
 * The lines of a "## <title>" section, without its heading; null when there is none.
 * @param {string} changelog
 * @param {string} title
 */
export function section(changelog, title) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

/**
 * How many entries ("- " lines) each subsection has. Fails on an entry outside a known subsection.
 * @param {string[]} lines
 * @param {string} title
 */
export function countEntries(lines, title) {
  /** @type {Record<Subsection, number>} */
  const counts = { Added: 0, Changed: 0, Fixed: 0 };
  /** @type {Subsection | null} */
  let current = null;
  for (const line of lines) {
    const heading = /^### (.+)$/.exec(line);
    if (heading) {
      const name = (heading[1] ?? '').trim();
      if (!SUBSECTIONS.includes(name)) {
        throw new Error(`${CHANGELOG} "## ${title}": unknown subsection "### ${name}" (use Added, Changed or Fixed).`);
      }
      current = /** @type {Subsection} */ (name);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!current) throw new Error(`${CHANGELOG} "## ${title}": an entry outside Added, Changed and Fixed: ${line}`);
      counts[current]++;
    }
  }
  return counts;
}

/**
 * The lines of "## Unreleased"; fails when it is missing or has no entries (nothing to release).
 * @param {string} changelog
 */
export function unreleased(changelog) {
  const lines = section(changelog, 'Unreleased');
  if (!lines) throw new Error(`${CHANGELOG} has no "## Unreleased" section.`);
  const counts = countEntries(lines, 'Unreleased');
  if (counts.Added + counts.Changed + counts.Fixed === 0) {
    throw new Error(`${CHANGELOG} "## Unreleased" has no entries: nothing to release.`);
  }
  return lines;
}

/**
 * The newest release among the tag names ("v1.2.3" -> [1, 2, 3]); null when there is none.
 * @param {string[]} tags
 * @returns {Version | null}
 */
export function latestVersion(tags) {
  const versions = tags.flatMap((tag) => {
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    return match ? [/** @type {Version} */ ([Number(match[1]), Number(match[2]), Number(match[3])])] : [];
  });
  versions.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  return versions[0] ?? null;
}

/**
 * The version after the latest release for the entries of "## Unreleased".
 * @param {Version | null} latest
 * @param {string[]} entries
 */
export function nextVersion(latest, entries) {
  const counts = countEntries(entries, 'Unreleased');
  if (!latest) return FIRST_VERSION;
  const [major, minor, patch] = latest;
  return counts.Added + counts.Changed > 0 ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

/**
 * The CHANGELOG with "## Unreleased"'s entries under "## <version>", and an empty "## Unreleased" above it.
 * @param {string} changelog
 * @param {string} version
 */
export function moveUnreleased(changelog, version) {
  const entries = unreleased(changelog).join('\n').trim();
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === '## Unreleased');
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const after = end < 0 ? [] : lines.slice(end);
  const text = [...lines.slice(0, start), '## Unreleased', '', `## ${version}`, '', entries, '', ...after].join('\n');
  return { changelog: `${text.trimEnd()}\n`, entries };
}

/**
 * The release notes of a version: its CHANGELOG section. Fails when it is missing or has no entries.
 * @param {string} changelog
 * @param {string} version
 */
export function releaseNotes(changelog, version) {
  const lines = section(changelog, version);
  if (!lines?.some((line) => line.startsWith('- ')))
    throw new Error(`${CHANGELOG} has no entries under "## ${version}".`);
  return lines.join('\n').trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, version] = process.argv.slice(2);
  const changelog = readFileSync(CHANGELOG, 'utf8');
  if (command === 'next') {
    const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n');
    console.log(nextVersion(latestVersion(tags), unreleased(changelog)));
  } else if (command === 'move' && version) {
    const moved = moveUnreleased(changelog, version);
    writeFileSync(CHANGELOG, moved.changelog);
    console.log(moved.entries);
  } else if (command === 'notes' && version) {
    console.log(releaseNotes(changelog, version));
  } else {
    throw new Error('Usage: node scripts/release.mjs next | move <version> | notes <version>');
  }
}
