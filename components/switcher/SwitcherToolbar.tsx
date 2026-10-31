import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { IconButton } from '../ui/IconButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import styles from './SwitcherToolbar.module.css';

interface SwitcherToolbarProps {
  settings: Settings;
  /** The search field, in the toolbar's middle. */
  search: JSX.Element;
  onChange: (change: SettingsChange) => void;
  onSettings: () => void;
}

/**
 * The switcher's toolbar: the search field always in the middle; at the start edge the option of the view in use (the
 * list's Compact, or what the grid shows), then the website address and the last used time (none in the grid of
 * icons, which shows neither); at the end edge the view and the settings. Its buttons are marked
 * data-toolbar-controls: the switcher leaves the keyboard on the tabs when they are clicked.
 */
export function SwitcherToolbar(props: SwitcherToolbarProps): JSX.Element {
  const details = () => props.settings.details;
  return (
    <div role="toolbar" aria-label={i18n.t('Switcher_Toolbar')} class={styles.toolbar}>
      <div class={styles.start} data-toolbar-controls>
        <Show
          when={props.settings.view === 'grid'}
          fallback={
            <IconButton
              icon="compact"
              label={i18n.t('Settings_Compact')}
              size="large"
              pressed={props.settings.compact}
              onClick={() => props.onChange({ compact: !props.settings.compact })}
            />
          }
        >
          <SegmentedControl
            label={i18n.t('Settings_GridShow')}
            value={props.settings.gridShow}
            options={[
              { value: 'previews', label: i18n.t('Settings_GridShowPreviews'), icon: 'previews' },
              { value: 'icons', label: i18n.t('Settings_GridShowIcons'), icon: 'icons' },
            ]}
            onChange={(gridShow) => props.onChange({ gridShow })}
          />
        </Show>
        <Show when={props.settings.view === 'list' || props.settings.gridShow === 'previews'}>
          <IconButton
            icon="address"
            label={i18n.t('Settings_Address')}
            size="large"
            pressed={details().address}
            onClick={() => props.onChange({ details: { address: !details().address } })}
          />
          <IconButton
            icon="lastUsed"
            label={i18n.t('Settings_LastUsed')}
            size="large"
            pressed={details().lastUsed}
            onClick={() => props.onChange({ details: { lastUsed: !details().lastUsed } })}
          />
        </Show>
      </div>
      <div class={styles.search}>{props.search}</div>
      <div class={styles.end} data-toolbar-controls>
        <SegmentedControl
          label={i18n.t('Settings_View')}
          value={props.settings.view}
          options={[
            { value: 'list', label: i18n.t('Settings_ViewList'), icon: 'list' },
            { value: 'grid', label: i18n.t('Settings_ViewGrid'), icon: 'grid' },
          ]}
          onChange={(view) => props.onChange({ view })}
        />
        <IconButton
          icon="settings"
          label={i18n.t('Switcher_Settings')}
          size="large"
          onClick={() => props.onSettings()}
        />
      </div>
    </div>
  );
}
