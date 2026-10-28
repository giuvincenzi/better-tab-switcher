import { createUniqueId, type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { IconButton } from '../ui/IconButton';
import { DisplayMenu } from './DisplayMenu';
import styles from './SwitcherFooter.module.css';

interface SwitcherFooterProps {
  hint: string;
  compact: boolean;
  /** None while the search field shows. */
  onSearch?: () => void;
  settings: Settings;
  menuOpen: boolean;
  onMenu: () => void;
  onChange: (change: SettingsChange) => void;
  onSettings: () => void;
}

/** The switcher's footer: the keys to use, the search button and the Display menu (with the settings in it). */
export function SwitcherFooter(props: SwitcherFooterProps): JSX.Element {
  const menuId = createUniqueId();
  return (
    <div class={styles.footer} classList={{ [styles.compact as string]: props.compact }}>
      <span class={styles.hint}>{props.hint}</span>
      <Show when={props.onSearch}>
        {(onSearch) => <IconButton icon="search" label={i18n.t('Switcher_Search')} onClick={() => onSearch()()} />}
      </Show>
      <IconButton
        icon="display"
        label={i18n.t('Switcher_Display')}
        expanded={props.menuOpen}
        controls={menuId}
        onClick={() => props.onMenu()}
      />
      <Show when={props.menuOpen}>
        <DisplayMenu id={menuId} settings={props.settings} onChange={props.onChange} onSettings={props.onSettings} />
      </Show>
    </div>
  );
}
