import { createUniqueId, type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { Icon } from '../ui/Icon';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Toggle } from '../ui/Toggle';
import styles from './DisplayMenu.module.css';

interface DisplayMenuProps {
  id: string;
  settings: Settings;
  onChange: (change: SettingsChange) => void;
  onSettings: () => void;
}

/**
 * The footer's Display menu: how the switcher shows the tabs, changed and saved at once, and the way to the settings
 * page. Its controls are the browser's own: the switcher's keys leave them alone (data-display-menu).
 */
export function DisplayMenu(props: DisplayMenuProps): JSX.Element {
  const ids = { view: createUniqueId(), show: createUniqueId(), compact: createUniqueId() };
  return (
    <fieldset id={props.id} class={styles.menu} aria-label={i18n.t('Switcher_Display')} data-display-menu>
      <div class={styles.group}>
        <span id={ids.view} class={styles.label}>
          {i18n.t('Settings_View')}
        </span>
        <SegmentedControl
          value={props.settings.view}
          options={[
            { value: 'list', label: i18n.t('Settings_ViewList') },
            { value: 'grid', label: i18n.t('Settings_ViewGrid') },
          ]}
          labelledBy={ids.view}
          onChange={(view) => props.onChange({ view })}
        />
      </div>
      <Show
        when={props.settings.view === 'grid'}
        fallback={
          <div class={styles.row}>
            <span id={ids.compact}>{i18n.t('Settings_Compact')}</span>
            <Toggle
              checked={props.settings.compact}
              labelledBy={ids.compact}
              onChange={(compact) => props.onChange({ compact })}
            />
          </div>
        }
      >
        <div class={styles.group}>
          <span id={ids.show} class={styles.label}>
            {i18n.t('Settings_GridShow')}
          </span>
          <SegmentedControl
            value={props.settings.gridShow}
            options={[
              { value: 'previews', label: i18n.t('Settings_GridShowPreviews') },
              { value: 'icons', label: i18n.t('Settings_GridShowIcons') },
            ]}
            labelledBy={ids.show}
            onChange={(gridShow) => props.onChange({ gridShow })}
          />
        </div>
      </Show>
      <div class={styles.divider} />
      <button type="button" class={styles.item} onClick={() => props.onSettings()}>
        <Icon name="settings" size={14} />
        {i18n.t('Switcher_Settings')}
      </button>
    </fieldset>
  );
}
