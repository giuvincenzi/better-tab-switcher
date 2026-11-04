/** The website's address, where GitHub Pages publishes it: the extension's links and the site's own (scripts/site.mjs). */
export const SITE_URL = 'https://bettertabswitcher.gviam.app/';

/** The user guide's page about the keyboard shortcuts, at the part on Ctrl+Tab. */
export const CTRL_TAB_GUIDE_URL = `${SITE_URL}guide/latest/using-the-switcher.html#ctrl-tab`;

/** The user guide, at its newest version. */
export const GUIDE_URL = `${SITE_URL}guide/latest/`;

/** The project on GitHub: its code, its releases and its issues (scripts/site.mjs links the same). */
export const REPOSITORY_URL = 'https://github.com/giuvincenzi/better-tab-switcher';

/** Where a bug or an idea is reported: the choice of the issue forms (.github/ISSUE_TEMPLATE/). */
export const NEW_ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`;

/** The release notes of a version, on GitHub: publish_release tags each release vX.Y.Z. */
export function releaseUrl(version: string): string {
  return `${REPOSITORY_URL}/releases/tag/v${version}`;
}
