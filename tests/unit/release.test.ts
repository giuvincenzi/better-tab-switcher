import { describe, expect, it } from 'vitest';
import { latestVersion, moveUnreleased, nextVersion, releaseNotes, unreleased } from '../../scripts/release.mjs';

const changelog = (unreleasedEntries: string) =>
  `# Changelog\n\n## Unreleased\n${unreleasedEntries}\n## 1.2.0\n\n### Added\n\n- An older feature.\n`;

describe('the next version', () => {
  it('is 1.0.0 when nothing was released yet', () => {
    expect(nextVersion(latestVersion([]), unreleased(changelog('\n### Fixed\n\n- A fix.\n')))).toBe('1.0.0');
  });

  it('takes a minor step with Added or Changed entries, a patch step with Fixed only', () => {
    const latest = latestVersion(['v1.2.0']);
    expect(nextVersion(latest, unreleased(changelog('\n### Added\n\n- A feature.\n')))).toBe('1.3.0');
    expect(nextVersion(latest, unreleased(changelog('\n### Changed\n\n- A change.\n')))).toBe('1.3.0');
    expect(nextVersion(latest, unreleased(changelog('\n### Fixed\n\n- A fix.\n')))).toBe('1.2.1');
  });

  it('follows the newest release tag by number, not by name', () => {
    expect(latestVersion(['v1.9.0', 'v1.10.0', 'v1.2.3', 'draft', 'v2.0'])).toEqual([1, 10, 0]);
  });

  it('stops when there is nothing to release or an entry is outside Added, Changed and Fixed', () => {
    expect(() => unreleased(changelog('\n### Added\n\n'))).toThrow('nothing to release');
    expect(() => unreleased(changelog('\n- A loose entry.\n'))).toThrow('outside Added, Changed and Fixed');
    expect(() => unreleased(changelog('\n### Removed\n\n- Gone.\n'))).toThrow('unknown subsection');
    expect(() => unreleased('# Changelog\n')).toThrow('no "## Unreleased"');
  });
});

describe('the CHANGELOG of a release', () => {
  it('moves the Unreleased entries under the version and leaves an empty Unreleased above', () => {
    const moved = moveUnreleased(changelog('\n### Fixed\n\n- A fix.\n'), '1.2.1');
    expect(moved.entries).toBe('### Fixed\n\n- A fix.');
    expect(moved.changelog).toBe(
      '# Changelog\n\n## Unreleased\n\n## 1.2.1\n\n### Fixed\n\n- A fix.\n\n## 1.2.0\n\n### Added\n\n- An older feature.\n',
    );
  });

  it('gives a version its own section as release notes', () => {
    const moved = moveUnreleased(changelog('\n### Fixed\n\n- A fix.\n'), '1.2.1');
    expect(releaseNotes(moved.changelog, '1.2.1')).toBe('### Fixed\n\n- A fix.');
    expect(releaseNotes(moved.changelog, '1.2.0')).toBe('### Added\n\n- An older feature.');
    expect(() => releaseNotes(moved.changelog, '9.9.9')).toThrow('no entries under "## 9.9.9"');
  });
});
