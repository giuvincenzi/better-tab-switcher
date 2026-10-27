import { createSignal, For, type JSX, onCleanup, onMount } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import styles from './SettingsPage.module.css';
import {
  AppearanceSection,
  DetailsSection,
  ResetSection,
  type SectionId,
  ShortcutsSection,
  SwitchingSection,
  sectionIds,
  sectionTitle,
} from './SettingsSections';

export interface SettingsPageProps {
  settings: Settings;
  save: (change: SettingsChange) => void;
  /** The shortcuts as Chrome writes them, "" when one has none. */
  shortcuts: { next: string; previous: string };
  language: string;
  /** Now, for the example of "last used", in milliseconds since 1970. */
  now: number;
  /** The extension's icon, for the header. */
  iconUrl: string;
  guideUrl: string;
  onChangeShortcut: () => void;
  onRestore: () => void;
}

/** The settings page: it looks like Chrome's settings, with a sidebar to its sections. */
export function SettingsPage(props: SettingsPageProps): JSX.Element {
  const [current, setCurrent] = createSignal<SectionId>('appearance');

  // The sidebar marks the section at the top of the window.
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id as SectionId);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    onCleanup(() => observer.disconnect());
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
                    onClick={() => setCurrent(id)}
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
    </div>
  );
}
