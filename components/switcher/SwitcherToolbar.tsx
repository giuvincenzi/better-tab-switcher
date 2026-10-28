import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { widthOptions } from '../settings/options';
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
 * The switcher's toolbar: the search field always in the middle; at the start edge the width and the options of the view
 * in use (the list's Compact, or what the grid shows), at the end edge the view and the settings. Its buttons are marked
 * data-toolbar-controls: the switcher leaves the keyboard on the tabs when they are clicked.
 */
export function SwitcherToolbar(props: SwitcherToolbarProps): JSX.Element {
  return (
    <div role="toolbar" aria-label={i18n.t('Switcher_Toolbar')} class={styles.toolbar}>
      <div class={styles.start} data-toolbar-controls>
        <SegmentedControl
          label={i18n.t('Settings_Width')}
          value={props.settings.width}
          options={widthOptions(true)}
          onChange={(width) => props.onChange({ width })}
        />
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
