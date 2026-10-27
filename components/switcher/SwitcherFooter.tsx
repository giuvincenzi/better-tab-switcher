import type { JSX } from 'solid-js';
import { i18n } from '#i18n';
import { IconButton } from '../ui/IconButton';
import styles from './SwitcherFooter.module.css';

interface SwitcherFooterProps {
  hint: string;
  compact: boolean;
  onSearch: () => void;
  onSettings: () => void;
}

/** The switcher's footer: the keys to use, the search button and the settings button. */
export function SwitcherFooter(props: SwitcherFooterProps): JSX.Element {
  return (
    <div class={styles.footer} classList={{ [styles.compact as string]: props.compact }}>
      <span class={styles.hint}>{props.hint}</span>
      <IconButton icon="search" label={i18n.t('Switcher_Search')} onClick={() => props.onSearch()} />
      <IconButton icon="settings" label={i18n.t('Switcher_Settings')} onClick={() => props.onSettings()} />
    </div>
  );
}
