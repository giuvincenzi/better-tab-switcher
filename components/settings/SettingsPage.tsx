import { createSignal, For, type JSX, onCleanup, onMount } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import type { Shortcuts } from '../../lib/shortcuts';
import styles from './SettingsPage.module.css';
import {
  AppearanceSection,
  DetailsSection,
  ResetSection,
  type SectionId,
  ShortcutsDialog,
  ShortcutsSection,
  SwitchingSection,
  sectionIds,
  sectionTitle,
} from './SettingsSections';

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
  /** The extension's icon, for the header. */
  iconUrl: string;
  guideUrl: string;
  onChangeShortcut: () => void;
  onRestore: () => void;
}

/** How far down the window a section's top can be and still be the section at the top: its upper part. */
const TOP_PART = 0.4;

/**
 * The section at the top of the window: the last one whose top is in the window's upper part. Scrolled to its end,
 * the page's last section: the sections at the end are too short to reach the top.
 */
function sectionAtTop(): SectionId {
  const root = document.documentElement;
  const last = sectionIds[sectionIds.length - 1] as SectionId;
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= root.scrollHeight - 1) return last;
  let found = sectionIds[0] as SectionId;
  for (const id of sectionIds) {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    if (top !== undefined && top <= window.innerHeight * TOP_PART) found = id;
  }
  return found;
}

/** The settings page: it looks like Chrome's settings, with a sidebar to its sections. */
export function SettingsPage(props: SettingsPageProps): JSX.Element {
  const [current, setCurrent] = createSignal<SectionId>('appearance');
  const [askingShortcuts, setAskingShortcuts] = createSignal(props.askShortcuts ?? false);
  // A section chosen in the sidebar stays marked while the page goes to it, and after: the last sections can't reach
  // the top of the window. Until the user scrolls the page.
  let chosen = false;

  // The sidebar marks the section at the top of the window, as the user scrolls.
  onMount(() => {
    const follow = () => {
      if (!chosen) setCurrent(sectionAtTop());
    };
    const scrolledByTheUser = () => {
      chosen = false;
    };
    window.addEventListener('scroll', follow, { passive: true });
    // What scrolls the page (the mouse's wheel and buttons, the keys, a finger), before it scrolls it.
    const inputs = ['wheel', 'mousedown', 'keydown', 'touchstart'] as const;
    for (const input of inputs) window.addEventListener(input, scrolledByTheUser, { capture: true, passive: true });
    onCleanup(() => {
      window.removeEventListener('scroll', follow);
      for (const input of inputs) window.removeEventListener(input, scrolledByTheUser, { capture: true });
    });
  });

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <img class={styles.logo} src={props.iconUrl} alt="" width="28" height="28" />
        <h1 class={styles.title}>{i18n.t('Settings_Title')}</h1>
      </header>
      <div class={styles.body}>
        <nav class={styles.sidebar} aria-label={i18n.t('Settings_Sections')}>
          <ul class={styles.links}>
            <For each={sectionIds}>
              {(id) => (
                <li>
                  <a
                    href={`#${id}`}
                    class={styles.link}
                    aria-current={current() === id ? 'true' : undefined}
                    onClick={() => {
                      chosen = true;
                      setCurrent(id);
                    }}
                  >
                    {sectionTitle(id)}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </nav>
        <main class={styles.main}>
          <AppearanceSection settings={props.settings} save={props.save} language={props.language} />
          <SwitchingSection settings={props.settings} save={props.save} language={props.language} />
          <DetailsSection settings={props.settings} save={props.save} language={props.language} now={props.now} />
          <ShortcutsSection
            shortcuts={props.shortcuts}
            guideUrl={props.guideUrl}
            onChangeShortcut={props.onChangeShortcut}
          />
          <ResetSection onRestore={props.onRestore} />
        </main>
      </div>
      <ShortcutsDialog
        open={askingShortcuts()}
        shortcuts={props.shortcuts}
        guideUrl={props.guideUrl}
        onChangeShortcut={props.onChangeShortcut}
        onClose={() => setAskingShortcuts(false)}
      />
    </div>
  );
}
