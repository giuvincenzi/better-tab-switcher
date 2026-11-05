import { createSignal, For, type JSX, onCleanup, onMount, Show } from 'solid-js';
import { i18n } from '#i18n';
import { searchTerm } from '../../lib/settings/search';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import type { Shortcuts } from '../../lib/shortcuts';
import { Drawer } from '../ui/Drawer';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { SearchBox } from '../ui/SearchBox';
import styles from './SettingsPage.module.css';
import {
  AboutSection,
  AppearanceSection,
  DetailsSection,
  type SectionId,
  ShortcutsDialog,
  ShortcutsSection,
  SwitchingSection,
  SystemSection,
  sectionIds,
  sectionTitle,
} from './SettingsSections';
import { createSearchScope, SearchProvider } from './search';

export interface SettingsPageProps {
  settings: Settings;
  save: (change: SettingsChange) => void;
  /** The shortcuts as Chrome writes them, "" when one has none. */
  shortcuts: Shortcuts;
  /** Opened after the install because a shortcut has no keys: the shortcuts' dialog shows first (lib/shortcuts.ts). */
  askShortcuts?: boolean;
  language: string;
  /** Now, for the example of "last used", in milliseconds since 1970. */
  now: number;
  /** The extension's icon, for the header and About. */
  iconUrl: string;
  guideUrl: string;
  /** The version installed. */
  version: string;
  /** The browser's page of the extension (Manage extension in System), its address. */
  extensionPage: string;
  /** Opens a browser's own page (chrome://), which a page can't open as a link, in a new tab. */
  onOpenBrowserPage: (url: string) => void;
  onChangeShortcut: () => void;
  onRestore: () => void;
}

/** Each section's icon in the sidebar, as Chrome's settings have them. */
const SECTION_ICON: Record<SectionId, IconName> = {
  appearance: 'palette',
  switching: 'swap',
  details: 'bullets',
  shortcuts: 'keyboard',
  system: 'settings',
  about: 'info',
};

/** The section the page's address names (#switching), so that Back and a reload keep it; the first one otherwise. */
function sectionInAddress(): SectionId {
  const id = location.hash.slice(1);
  return (sectionIds as readonly string[]).includes(id) ? (id as SectionId) : 'appearance';
}

/**
 * The settings page, as Chrome's settings: a search in the header, the sections in a sidebar at the left (behind a
 * menu button in a narrow window), and the section chosen there alone. A search shows every section with settings
 * that match, whichever is chosen.
 */
export function SettingsPage(props: SettingsPageProps): JSX.Element {
  const [current, setCurrent] = createSignal<SectionId>(sectionInAddress());
  const [query, setQuery] = createSignal('');
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [askingShortcuts, setAskingShortcuts] = createSignal(props.askShortcuts ?? false);
  const term = () => searchTerm(query(), props.language);

  onMount(() => {
    const follow = () => setCurrent(sectionInAddress());
    window.addEventListener('popstate', follow);
    onCleanup(() => window.removeEventListener('popstate', follow));
  });

  const choose = (id: SectionId, event: MouseEvent) => {
    event.preventDefault();
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    setCurrent(id);
    setQuery('');
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const links = () => (
    <ul class={styles.links}>
      <For each={sectionIds}>
        {(id) => (
          <li classList={{ [styles.apart as string]: id === 'system' }}>
            <a
              href={`#${id}`}
              class={styles.link}
              aria-current={term() === '' && current() === id ? 'page' : undefined}
              onClick={(event) => choose(id, event)}
            >
              <Icon name={SECTION_ICON[id]} size={1.25} />
              <span>{sectionTitle(id)}</span>
            </a>
          </li>
        )}
      </For>
    </ul>
  );

  return (
    <SearchProvider value={{ term, language: props.language }}>
      <div class={styles.page}>
        <header class={styles.header}>
          <div class={styles.brand}>
            <IconButton
              class={styles.menu}
              icon="menu"
              size="large"
              label={i18n.t('Settings_Menu')}
              onClick={() => setMenuOpen(true)}
            />
            <img class={styles.logo} src={props.iconUrl} alt="" width="28" height="28" />
            <h1 class={styles.title}>{i18n.t('Settings_Title')}</h1>
          </div>
          <div class={styles.search}>
            <SearchBox
              value={query()}
              label={i18n.t('Settings_Search')}
              clearLabel={i18n.t('Settings_ClearSearch')}
              onInput={setQuery}
            />
          </div>
        </header>
        <div class={styles.body}>
          <nav class={styles.sidebar} aria-label={i18n.t('Settings_Sections')}>
            {links()}
          </nav>
          <main class={styles.main}>
            <Sections {...props} current={current()} />
          </main>
        </div>
        <Drawer open={menuOpen()} label={i18n.t('Settings_Sections')} onClose={() => setMenuOpen(false)}>
          <nav aria-label={i18n.t('Settings_Sections')}>{links()}</nav>
        </Drawer>
        <ShortcutsDialog
          open={askingShortcuts()}
          shortcuts={props.shortcuts}
          guideUrl={props.guideUrl}
          onChangeShortcut={props.onChangeShortcut}
          onClose={() => setAskingShortcuts(false)}
        />
      </div>
    </SearchProvider>
  );
}

/** Every section, the chosen one shown (or, during a search, the ones that match), and a note when none matches. */
function Sections(props: SettingsPageProps & { current: SectionId }): JSX.Element {
  const scope = createSearchScope();
  const chosen = (id: SectionId) => props.current === id;
  return (
    <div class={styles.sections}>
      <scope.Provider>
        <AppearanceSection
          settings={props.settings}
          save={props.save}
          language={props.language}
          chosen={chosen('appearance')}
        />
        <SwitchingSection
          settings={props.settings}
          save={props.save}
          language={props.language}
          chosen={chosen('switching')}
        />
        <DetailsSection
          settings={props.settings}
          save={props.save}
          language={props.language}
          now={props.now}
          chosen={chosen('details')}
        />
        <ShortcutsSection
          shortcuts={props.shortcuts}
          guideUrl={props.guideUrl}
          onChangeShortcut={props.onChangeShortcut}
          chosen={chosen('shortcuts')}
        />
        <SystemSection
          extensionPage={props.extensionPage}
          onOpenBrowserPage={props.onOpenBrowserPage}
          onRestore={props.onRestore}
          chosen={chosen('system')}
        />
        <AboutSection version={props.version} iconUrl={props.iconUrl} chosen={chosen('about')} />
      </scope.Provider>
      <Show when={!scope.shown()}>
        <div class={styles.none} role="status">
          <Icon name="search" size={2.5} />
          <p class={styles.noneTitle}>{i18n.t('Settings_NoResults')}</p>
          <p class={styles.noneNote}>{i18n.t('Settings_NoResultsNote')}</p>
        </div>
      </Show>
    </div>
  );
}
