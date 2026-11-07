import { describe, expect, it } from 'vitest';
import { asks, newAsks, PERMISSION_REASONS, pasteGuide, reasonOf } from '../../scripts/store-privacy.mjs';

describe('what a manifest asks the stores to justify', () => {
  it('lists the permissions and host permissions, optional or not, once each and sorted', () => {
    expect(
      asks({
        permissions: ['tabs', 'storage'],
        optional_permissions: ['tabs', 'downloads'],
        host_permissions: ['https://example.com/*'],
        optional_host_permissions: ['<all_urls>'],
        name: 'Not asked',
      }),
    ).toEqual(['<all_urls>', 'downloads', 'https://example.com/*', 'storage', 'tabs']);
  });

  it('asks nothing of a manifest without permissions', () => {
    expect(asks({ name: 'Nothing' })).toEqual([]);
  });
});

describe('what a release asks for that the previous one did not', () => {
  it('lists only what is new', () => {
    const previous = { permissions: ['tabs', 'storage'] };
    expect(newAsks({ permissions: ['tabs', 'storage', 'webNavigation'] }, previous)).toEqual(['webNavigation']);
  });

  it('lists nothing when the release asks for the same or less', () => {
    const previous = { permissions: ['tabs', 'storage'] };
    expect(newAsks({ permissions: ['storage'] }, previous)).toEqual([]);
  });

  it('lists everything on the first release, without a previous manifest', () => {
    expect(newAsks({ permissions: ['tabs', 'storage'] }, undefined)).toEqual(['storage', 'tabs']);
  });
});

describe('the justifications to paste', () => {
  it('gives each new permission with its justification', () => {
    const guide = pasteGuide(['webNavigation']);
    expect(guide).toContain('`webNavigation`');
    expect(guide).toContain(`- \`webNavigation\`: ${PERMISSION_REASONS.webNavigation}`);
  });

  it('says nothing when nothing is new', () => {
    expect(pasteGuide([])).toBe('');
  });

  it('fails on a permission whose justification is not written', () => {
    expect(() => reasonOf('downloads')).toThrow('write the stores');
  });
});
