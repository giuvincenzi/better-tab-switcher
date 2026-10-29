import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import { BROWSER_NAME_TEXT, browserName } from '../../lib/browser';
import { timeAgo } from '../../lib/i18n/time';
import { limits, ROW_CHOICES, type RowCount, type Settings, type TabDetails } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { Button } from '../ui/Button';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select, type SelectOption } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { SettingRow } from './SettingRow';
import { SettingsSection } from './SettingsSection';
import styles from './SettingsSections.module.css';

/** What every section gets: the settings as saved, and how to change them. */
export interface SectionProps {
  settings: Settings;
  save: (change: SettingsChange) => void;
  language: string;
}

/** The sections, in the order of the page and of its sidebar. */
export const sectionIds = ['appearance', 'switching', 'details', 'shortcuts', 'reset'] as const;
export type SectionId = (typeof sectionIds)[number];

export function sectionTitle(id: SectionId): string {
  return {
    appearance: i18n.t('Settings_Appearance'),
    switching: i18n.t('Settings_Switching'),
    details: i18n.t('Settings_TabDetails'),
    shortcuts: i18n.t('Settings_Shortcuts'),
    reset: i18n.t('Settings_Reset'),
  }[id];
}

export function AppearanceSection(props: SectionProps): JSX.Element {
  const grid = () => props.settings.view === 'grid';
  return (
    <SettingsSection id="appearance" title={sectionTitle('appearance')}>
      <SettingRow
        label={i18n.t('Settings_Theme')}
        control={(ids) => (
          <Select
            value={props.settings.theme}
            options={[
              { value: 'device', label: i18n.t('Settings_ThemeDevice') },
              { value: 'light', label: i18n.t('Settings_ThemeLight') },
              { value: 'dark', label: i18n.t('Settings_ThemeDark') },
            ]}
            labelledBy={ids.label}
            onChange={(theme) => props.save({ theme })}
          />
        )}
      />
      <SettingRow
        label={i18n.t('Settings_View')}
        control={(ids) => (
          <SegmentedControl
            value={props.settings.view}
            options={[
              { value: 'list', label: i18n.t('Settings_ViewList') },
              { value: 'grid', label: i18n.t('Settings_ViewGrid') },
            ]}
            labelledBy={ids.label}
            onChange={(view) => props.save({ view })}
          />
        )}
      />
      <ToggleRow
        label={i18n.t('Settings_Toolbar')}
        note={i18n.t('Settings_ToolbarNote')}
        checked={props.settings.toolbar}
        onChange={(toolbar) => props.save({ toolbar })}
      />
      <Show
        when={grid()}
        fallback={
          <>
            <ToggleRow
              label={i18n.t('Settings_Compact')}
              note={i18n.t('Settings_CompactNote')}
              checked={props.settings.compact}
              onChange={(compact) => props.save({ compact })}
            />
            <RowsRow
              language={props.language}
              label={i18n.t('Settings_ListRows')}
              value={props.settings.listRows}
              onChange={(listRows) => props.save({ listRows })}
            />
          </>
        }
      >
        <SettingRow
          label={i18n.t('Settings_GridShow')}
          note={i18n.t('Settings_GridShowNote')}
          control={(ids) => (
            <SegmentedControl
              value={props.settings.gridShow}
              options={[
                { value: 'previews', label: i18n.t('Settings_GridShowPreviews') },
                { value: 'icons', label: i18n.t('Settings_GridShowIcons') },
              ]}
              labelledBy={ids.label}
              onChange={(gridShow) => props.save({ gridShow })}
            />
          )}
        />
      </Show>
    </SettingsSection>
  );
}

export function SwitchingSection(props: SectionProps): JSX.Element {
  return (
    <SettingsSection id="switching" title={sectionTitle('switching')}>
      <SettingRow
        label={i18n.t('Settings_Scope')}
        note={i18n.t('Settings_ScopeNote')}
        control={(ids) => (
          <Select
            value={props.settings.scope}
            options={[
              { value: 'window', label: i18n.t('Settings_ScopeWindow') },
              { value: 'all', label: i18n.t('Settings_ScopeAll') },
            ]}
            labelledBy={ids.label}
            describedBy={ids.note}
            onChange={(scope) => props.save({ scope })}
          />
        )}
      />
      <ToggleRow
        label={i18n.t('Settings_ShowPinned')}
        checked={props.settings.showPinned}
        onChange={(showPinned) => props.save({ showPinned })}
      />
      <SettingRow
        label={i18n.t('Settings_Delay')}
        note={i18n.t('Settings_DelayNote')}
        control={(ids) => (
          <NumberField
            value={props.settings.delayMs}
            {...limits.delayMs}
            unit={{ unit: 'millisecond', language: props.language }}
            labelledBy={ids.label}
            describedBy={ids.note}
            onChange={(delayMs) => props.save({ delayMs })}
          />
        )}
      />
      <ToggleRow
        label={i18n.t('Settings_StayOpen')}
        note={i18n.t('Settings_StayOpenNote')}
        checked={props.settings.stayOpen}
        onChange={(stayOpen) => props.save({ stayOpen })}
      />
      <ToggleRow
        label={i18n.t('Settings_ChromePagesWindow', [browserTitle()])}
        note={i18n.t('Settings_ChromePagesWindowNote', [browserTitle()])}
        checked={props.settings.chromePagesWindow}
        onChange={(chromePagesWindow) => props.save({ chromePagesWindow })}
      />
      <ToggleRow
        label={i18n.t('Settings_AutoSelect')}
        note={i18n.t('Settings_AutoSelectNote')}
        checked={props.settings.autoSelect}
        onChange={(autoSelect) => props.save({ autoSelect })}
      />
      <SettingRow
        label={i18n.t('Settings_AutoSelectTime')}
        dim={!props.settings.autoSelect}
        control={(ids) => (
          <NumberField
            value={props.settings.autoSelectSeconds}
            {...limits.autoSelectSeconds}
            unit={{ unit: 'second', language: props.language }}
            labelledBy={ids.label}
            disabled={!props.settings.autoSelect}
            onChange={(autoSelectSeconds) => props.save({ autoSelectSeconds })}
          />
        )}
      />
    </SettingsSection>
  );
}

export function DetailsSection(props: SectionProps & { now: number }): JSX.Element {
  const detail = (key: Exclude<keyof TabDetails, 'longAddress'>, label: string, note?: string) => (
    <ToggleRow
      label={label}
      note={note}
      checked={props.settings.details[key]}
      onChange={(on) => props.save({ details: { [key]: on } })}
    />
  );
  const fifteenMinutesAgo = () => timeAgo(props.now - 15 * 60_000, props.now, props.language);
  return (
    <SettingsSection id="details" title={sectionTitle('details')}>
      {detail('address', i18n.t('Settings_Address'))}
      <SettingRow
        label={i18n.t('Settings_LongAddress')}
        note={i18n.t('Settings_LongAddressNote')}
        dim={!props.settings.details.address}
        control={(ids) => (
          <Select
            value={props.settings.details.longAddress}
            options={[
              { value: 'cut', label: i18n.t('Settings_LongAddressCut') },
              { value: 'scroll', label: i18n.t('Settings_LongAddressScroll') },
            ]}
            labelledBy={ids.label}
            describedBy={ids.note}
            disabled={!props.settings.details.address}
            onChange={(longAddress) => props.save({ details: { longAddress } })}
          />
        )}
      />
      {detail('pinnedIcon', i18n.t('Settings_PinnedIcon'))}
      {detail('audioIcon', i18n.t('Settings_AudioIcon'))}
      {detail('sleeping', i18n.t('Settings_Sleeping'), i18n.t('Settings_SleepingNote'))}
      {detail('groupColor', i18n.t('Settings_GroupColor'))}
      {detail('lastUsed', i18n.t('Settings_LastUsed'), i18n.t('Settings_LastUsedNote', [fifteenMinutesAgo()]))}
    </SettingsSection>
  );
}

export interface ShortcutsSectionProps {
  /** The shortcuts as Chrome writes them, "" when one has none. */
  shortcuts: { next: string; previous: string };
  /** The user guide's page about Ctrl+Tab. */
  guideUrl: string;
  onChangeShortcut: () => void;
}

export function ShortcutsSection(props: ShortcutsSectionProps): JSX.Element {
  const row = (label: string, note: string, keys: string) => (
    <SettingRow
      label={label}
      note={note}
      control={(ids) => (
        <span class={styles.shortcut}>
          <kbd class={styles.keys}>{keys || i18n.t('Settings_NoShortcut')}</kbd>
          <Button describedBy={ids.label} onClick={() => props.onChangeShortcut()}>
            {i18n.t('Settings_ChangeShortcut')}
          </Button>
        </span>
      )}
    />
  );
  return (
    <SettingsSection
      id="shortcuts"
      title={sectionTitle('shortcuts')}
      note={
        <>
          {i18n.t('Settings_ShortcutsNote', [browserTitle()])}{' '}
          <a href={props.guideUrl} target="_blank" rel="noopener">
            {i18n.t('Settings_ShortcutsGuide')}
          </a>
        </>
      }
    >
      {row(i18n.t('Settings_NextTab'), i18n.t('Settings_NextTabNote'), props.shortcuts.next)}
      {row(i18n.t('Settings_PreviousTab'), i18n.t('Settings_PreviousTabNote'), props.shortcuts.previous)}
    </SettingsSection>
  );
}

export function ResetSection(props: { onRestore: () => void }): JSX.Element {
  return (
    <SettingsSection id="reset" title={sectionTitle('reset')}>
      <SettingRow
        label={i18n.t('Settings_RestoreDefaults')}
        control={(ids) => (
          <Button describedBy={ids.label} onClick={() => props.onRestore()}>
            {i18n.t('Settings_Restore')}
          </Button>
        )}
      />
    </SettingsSection>
  );
}

function ToggleRow(props: { label: string; note?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <SettingRow
      label={props.label}
      note={props.note}
      control={(ids) => (
        <Toggle checked={props.checked} labelledBy={ids.label} describedBy={ids.note} onChange={props.onChange} />
      )}
    />
  );
}

/** How many rows show before scrolling: one of the numbers to choose from, or as many as fit the screen. */
function RowsRow(props: { label: string; value: RowCount; language: string; onChange: (rows: RowCount) => void }) {
  const options = (): SelectOption<string>[] => [
    ...ROW_CHOICES.map((rows) => ({ value: String(rows), label: new Intl.NumberFormat(props.language).format(rows) })),
    { value: 'fit', label: i18n.t('Settings_RowsFit') },
  ];
  return (
    <SettingRow
      label={props.label}
      note={i18n.t('Settings_RowsFitNote')}
      control={(ids) => (
        <Select
          value={String(props.value)}
          options={options()}
          labelledBy={ids.label}
          describedBy={ids.note}
          onChange={(value) => props.onChange(value === 'fit' ? 'fit' : (Number(value) as RowCount))}
        />
      )}
    />
  );
}

/** The name of the browser the extension runs in, for the sentences that name it (lib/browser.ts). */
function browserTitle(): string {
  return i18n.t(BROWSER_NAME_TEXT[browserName()]);
}
