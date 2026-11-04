import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { i18n } from '#i18n';
import { BROWSER_NAME_TEXT, browserName, STORE_NAME_TEXT, storeReviewUrl } from '../../lib/browser';
import { timeAgo } from '../../lib/i18n/time';
import { GUIDE_URL, NEW_ISSUE_URL, REPOSITORY_URL, releaseUrl, SITE_URL } from '../../lib/links';
import { limits, ROW_CHOICES, type RowCount, type Settings, type TabDetails } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { type Shortcuts, shortcutMissing } from '../../lib/shortcuts';
import type { UpdateCheck } from '../../lib/updates';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Notice } from '../ui/Notice';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select, type SelectOption } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { LinkRow } from './LinkRow';
import { SettingGroup } from './SettingGroup';
import { SettingRow } from './SettingRow';
import { SettingsSection } from './SettingsSection';
import styles from './SettingsSections.module.css';
import { SearchProvider, useSearch } from './search';

/** What every section gets: the settings as saved, and how to change them. */
export interface SectionProps {
  settings: Settings;
  save: (change: SettingsChange) => void;
  language: string;
  /** Whether it is the section chosen in the sidebar (SettingsSection). */
  chosen?: boolean;
}

/** The sections, in the order of the page and of its sidebar. */
export const sectionIds = ['appearance', 'switching', 'details', 'shortcuts', 'system', 'about'] as const;
export type SectionId = (typeof sectionIds)[number];

export function sectionTitle(id: SectionId): string {
  return {
    appearance: i18n.t('Settings_Appearance'),
    switching: i18n.t('Settings_Switching'),
    details: i18n.t('Settings_TabDetails'),
    shortcuts: i18n.t('Settings_Shortcuts'),
    system: i18n.t('Settings_System'),
    about: i18n.t('Settings_About'),
  }[id];
}

export function AppearanceSection(props: SectionProps): JSX.Element {
  const grid = () => props.settings.view === 'grid';
  const themes = (): SelectOption<Settings['theme']>[] => [
    { value: 'device', label: i18n.t('Settings_ThemeDevice') },
    { value: 'light', label: i18n.t('Settings_ThemeLight') },
    { value: 'dark', label: i18n.t('Settings_ThemeDark') },
  ];
  return (
    <SettingsSection id="appearance" title={sectionTitle('appearance')} chosen={props.chosen}>
      <SettingRow
        label={i18n.t('Settings_Theme')}
        search={themes().map((theme) => theme.label)}
        control={(ids) => (
          <Select
            value={props.settings.theme}
            options={themes()}
            labelledBy={ids.label}
            onChange={(theme) => props.save({ theme })}
          />
        )}
      />
      <SettingRow
        label={i18n.t('Settings_View')}
        search={[i18n.t('Settings_ViewList'), i18n.t('Settings_ViewGrid')]}
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
          search={[i18n.t('Settings_GridShowPreviews'), i18n.t('Settings_GridShowIcons')]}
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
    <SettingsSection id="switching" title={sectionTitle('switching')} chosen={props.chosen}>
      <SettingRow
        label={i18n.t('Settings_Scope')}
        note={i18n.t('Settings_ScopeNote')}
        search={[i18n.t('Settings_ScopeWindow'), i18n.t('Settings_ScopeAll')]}
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
        note={i18n.t('Settings_ChromePagesWindowNote', [browserTitle(), storeTitle()])}
        checked={props.settings.chromePagesWindow}
        onChange={(chromePagesWindow) => props.save({ chromePagesWindow })}
      />
      <SettingGroup on={props.settings.autoSelect}>
        <ToggleRow
          label={i18n.t('Settings_AutoSelect')}
          note={i18n.t('Settings_AutoSelectNote')}
          checked={props.settings.autoSelect}
          onChange={(autoSelect) => props.save({ autoSelect })}
        />
        <SettingRow
          label={i18n.t('Settings_AutoSelectTime')}
          child
          control={(ids) => (
            <NumberField
              value={props.settings.autoSelectSeconds}
              {...limits.autoSelectSeconds}
              unit={{ unit: 'second', language: props.language }}
              labelledBy={ids.label}
              disabled={ids.disabled}
              onChange={(autoSelectSeconds) => props.save({ autoSelectSeconds })}
            />
          )}
        />
      </SettingGroup>
    </SettingsSection>
  );
}

export function DetailsSection(props: SectionProps & { now: number }): JSX.Element {
  const detail = (key: Exclude<keyof TabDetails, 'longAddress'>, label: string, note?: string, child?: boolean) => (
    <ToggleRow
      label={label}
      note={note}
      child={child}
      checked={props.settings.details[key]}
      onChange={(on) => props.save({ details: { [key]: on } })}
    />
  );
  const fifteenMinutesAgo = () => timeAgo(props.now - 15 * 60_000, props.now, props.language);
  const longAddresses = (): SelectOption<TabDetails['longAddress']>[] => [
    { value: 'scroll', label: i18n.t('Settings_LongAddressScroll') },
    { value: 'cut', label: i18n.t('Settings_LongAddressCut') },
  ];
  return (
    <SettingsSection id="details" title={sectionTitle('details')} chosen={props.chosen}>
      <ToggleRow
        label={i18n.t('Settings_ShowPinned')}
        checked={props.settings.showPinned}
        onChange={(showPinned) => props.save({ showPinned })}
      />
      {detail('pinnedIcon', i18n.t('Settings_PinnedIcon'))}
      {detail('audioIcon', i18n.t('Settings_AudioIcon'))}
      {detail('sleeping', i18n.t('Settings_Sleeping'), i18n.t('Settings_SleepingNote'))}
      {detail('groupColor', i18n.t('Settings_GroupColor'))}
      {detail('lastUsed', i18n.t('Settings_LastUsed'), i18n.t('Settings_LastUsedNote', [fifteenMinutesAgo()]))}
      {detail('notOpened', i18n.t('Settings_NotOpened'), i18n.t('Settings_NotOpenedNote', [i18n.t('Switcher_New')]))}
      {/* Not with the address's settings: without the address, the button sits at the end of the title. */}
      {detail('copyAddress', i18n.t('Settings_CopyAddress'), i18n.t('Settings_CopyAddressNote'))}
      {/* The address last, with the two settings that apply to it under it. */}
      <SettingGroup on={props.settings.details.address}>
        {detail('address', i18n.t('Settings_Address'))}
        {detail('fullAddress', i18n.t('Settings_FullAddress'), i18n.t('Settings_FullAddressNote'), true)}
        <SettingRow
          label={i18n.t('Settings_LongAddress')}
          note={i18n.t('Settings_LongAddressNote')}
          search={longAddresses().map((choice) => choice.label)}
          child
          control={(ids) => (
            <Select
              value={props.settings.details.longAddress}
              options={longAddresses()}
              labelledBy={ids.label}
              describedBy={ids.note}
              disabled={ids.disabled}
              onChange={(longAddress) => props.save({ details: { longAddress } })}
            />
          )}
        />
      </SettingGroup>
    </SettingsSection>
  );
}

export interface ShortcutsSectionProps {
  /** The shortcuts as Chrome writes them, "" when one has none. */
  shortcuts: Shortcuts;
  /** The section's id: "shortcuts" in the page, another one where it shows a second time (the shortcuts' dialog). */
  id?: string;
  /** Whether it is the section chosen in the sidebar (SettingsSection); always in the dialog. */
  chosen?: boolean;
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
      id={props.id ?? 'shortcuts'}
      title={sectionTitle('shortcuts')}
      chosen={props.chosen}
      note={
        <>
          {i18n.t('Settings_ShortcutsNote', [browserTitle()])}{' '}
          <a href={props.guideUrl} target="_blank" rel="noopener">
            {i18n.t('Settings_ShortcutsGuide')}
          </a>
        </>
      }
      notice={
        <Show when={shortcutMissing(props.shortcuts)}>
          <Notice>{i18n.t('Settings_ShortcutMissing', [i18n.t('Settings_ChangeShortcut')])}</Notice>
        </Show>
      }
    >
      {row(i18n.t('Settings_NextTab'), i18n.t('Settings_NextTabNote'), props.shortcuts.next)}
      {row(i18n.t('Settings_PreviousTab'), i18n.t('Settings_PreviousTabNote'), props.shortcuts.previous)}
      {row(i18n.t('Settings_IconShortcut'), i18n.t('Settings_IconShortcutNote'), props.shortcuts.icon)}
    </SettingsSection>
  );
}

/**
 * Just installed with a shortcut the browser left without keys (lib/shortcuts.ts): the shortcuts' section alone, in a
 * dialog over the settings page, until the user is done.
 */
export function ShortcutsDialog(props: ShortcutsSectionProps & { open: boolean; onClose: () => void }): JSX.Element {
  return (
    <Dialog
      open={props.open}
      title={i18n.t('Settings_ShortcutsDialogTitle')}
      description={i18n.t('Settings_ShortcutsDialogText')}
      onClose={() => props.onClose()}
      actions={
        <Button primary onClick={() => props.onClose()}>
          {i18n.t('Dialog_Done')}
        </Button>
      }
    >
      {/* Over the page, whatever the page's search finds: the whole section. */}
      <SearchProvider value={{ term: () => '', language: useSearch().language }}>
        <ShortcutsSection {...props} id="shortcuts-dialog" chosen />
      </SearchProvider>
    </Dialog>
  );
}

/** System: restarting the extension, and putting every setting back to its default. */
export function SystemSection(props: { chosen?: boolean; onRestart: () => void; onRestore: () => void }): JSX.Element {
  // Every setting at once, with no way back: the user confirms it first.
  const [asking, setAsking] = createSignal(false);
  return (
    <SettingsSection id="system" title={sectionTitle('system')} chosen={props.chosen}>
      <SettingRow
        label={i18n.t('Settings_RestartExtensionRow')}
        note={i18n.t('Settings_RestartExtensionNote')}
        control={(ids) => (
          <Button describedBy={ids.label} onClick={() => props.onRestart()}>
            {i18n.t('Settings_Restart')}
          </Button>
        )}
      />
      <SettingRow
        label={i18n.t('Settings_RestoreDefaults')}
        control={(ids) => (
          <Button describedBy={ids.label} onClick={() => setAsking(true)}>
            {i18n.t('Settings_Restore')}
          </Button>
        )}
      />
      <Dialog
        open={asking()}
        alert
        title={i18n.t('Settings_RestoreTitle')}
        description={i18n.t('Settings_RestoreText')}
        onClose={() => setAsking(false)}
        actions={
          <>
            <Button onClick={() => setAsking(false)}>{i18n.t('Dialog_Cancel')}</Button>
            <Button
              primary
              onClick={() => {
                setAsking(false);
                props.onRestore();
              }}
            >
              {i18n.t('Settings_Restore')}
            </Button>
          </>
        }
      />
    </SettingsSection>
  );
}

function ToggleRow(props: {
  label: string;
  note?: string;
  /** It depends on the main setting of its group (SettingGroup). */
  child?: boolean;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <SettingRow
      label={props.label}
      note={props.note}
      child={props.child}
      control={(ids) => (
        <Toggle
          checked={props.checked}
          labelledBy={ids.label}
          describedBy={ids.note}
          disabled={ids.disabled}
          onChange={props.onChange}
        />
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
      search={options().map((option) => option.label)}
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

/** The name of the extension store of the browser the extension runs in (lib/browser.ts). */
function storeTitle(): string {
  return i18n.t(STORE_NAME_TEXT[browserName()]);
}

export interface AboutSectionProps {
  chosen?: boolean;
  /** The version installed, from the manifest. */
  version: string;
  /** The extension's icon. */
  iconUrl: string;
  /**
   * Checking for a new version (lib/updates.ts), and restarting the extension once one is ready, as Restart in System
   * does. Also in a copy loaded from a folder, which the browser answers too: no new version, or to try again later.
   */
  updates: { check: () => Promise<UpdateCheck>; restart: () => void };
}

/** What the last check for updates found, or that one is running; none before the first check. */
type UpdateState = UpdateCheck | { kind: 'checking' };

/**
 * About: the extension's version, a check for a new one (Restart extension once one is ready), and the links to its release notes, its guide, its
 * issues, its website, its store page (to rate it) and its repository (to star it).
 */
export function AboutSection(props: AboutSectionProps): JSX.Element {
  const [update, setUpdate] = createSignal<UpdateState>();
  const check = async (updates: NonNullable<AboutSectionProps['updates']>) => {
    if (update()?.kind === 'checking') return;
    setUpdate({ kind: 'checking' });
    setUpdate(await updates.check());
  };
  const status = (): string | undefined => {
    const now = update();
    if (now === undefined) return undefined;
    switch (now.kind) {
      case 'checking':
        return i18n.t('Settings_Checking');
      case 'current':
        return i18n.t('Settings_UpToDate');
      case 'ready':
        return now.version ? i18n.t('Settings_UpdateReady', [now.version]) : i18n.t('Settings_UpdateReadyNoVersion');
      case 'later':
        return i18n.t('Settings_UpdateLater', [browserTitle()]);
      case 'failed':
        return i18n.t('Settings_UpdateFailed');
    }
  };
  return (
    <SettingsSection id="about" title={sectionTitle('about')} chosen={props.chosen}>
      <SettingRow
        label={i18n.t('Extension_Name')}
        note={i18n.t('Settings_Version', [props.version])}
        icon={<img class={styles.aboutIcon} src={props.iconUrl} alt="" width="40" height="40" />}
        status={
          // Read by screen readers as it changes.
          <div class={styles.status} role="status">
            {status()}
          </div>
        }
        control={(ids) => (
          <Switch>
            <Match when={update()?.kind === 'ready'}>
              <Button describedBy={ids.label} onClick={() => props.updates.restart()}>
                {i18n.t('Settings_RestartExtension')}
              </Button>
            </Match>
            <Match when={update()?.kind !== 'ready'}>
              <Button describedBy={ids.label} onClick={() => void check(props.updates)}>
                {i18n.t('Settings_CheckUpdates')}
              </Button>
            </Match>
          </Switch>
        )}
      />
      <LinkRow
        label={i18n.t('Settings_WhatsNew')}
        note={i18n.t('Settings_WhatsNewNote', [props.version])}
        href={releaseUrl(props.version)}
      />
      <LinkRow label={i18n.t('Settings_Guide')} note={i18n.t('Settings_GuideNote')} href={GUIDE_URL} />
      <LinkRow label={i18n.t('Settings_ReportIssue')} note={i18n.t('Settings_ReportIssueNote')} href={NEW_ISSUE_URL} />
      <LinkRow label={i18n.t('Settings_Website')} note={new URL(SITE_URL).host} href={SITE_URL} />
      <LinkRow
        label={i18n.t('Settings_Rate')}
        note={i18n.t('Settings_RateNote', [storeTitle()])}
        href={storeReviewUrl()}
      />
      <LinkRow label={i18n.t('Settings_Star')} note={i18n.t('Settings_StarNote')} href={REPOSITORY_URL} />
    </SettingsSection>
  );
}
