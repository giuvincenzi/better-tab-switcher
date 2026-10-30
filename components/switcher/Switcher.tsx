import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { i18n } from '#i18n';
import { languageInUse } from '../../lib/i18n/language';
import { type Key, keyEvent } from '../../lib/keys/keys';
import type { Direction, Resume, SwitcherSnapshot, TabText } from '../../lib/messages';
import { matchTab } from '../../lib/search/search';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { FIELD, type SwitcherEvent, start, step } from '../../lib/switcher/machine';
import {
  ADDRESS_TUCK,
  DEFAULT_EM_PX,
  em,
  gridColumns,
  listRows,
  sizes,
  tileHeight,
  tileWidth,
} from '../../lib/switcher/sizes';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { SearchField } from './SearchField';
import styles from './Switcher.module.css';
import { SwitcherToolbar } from './SwitcherToolbar';
import { type Layout, type ShownTab, TabList } from './TabList';

export interface SwitcherProps {
  snapshot: SwitcherSnapshot;
  /** Changes each time the shortcut is pressed again while the switcher is open. */
  moves: Accessor<{ direction: Direction; count: number }>;
  /** Changes with each key the page got for the switcher while its frame didn't have the focus yet (keyInPage). */
  pageKeys: Accessor<{ key: Key; count: number } | undefined>;
  /** Releasing the shortcut's modifier can be seen: here, or in the page that passes its keys on. */
  canSeeRelease: boolean;
  /** The tabs' pictures by tab id, as they arrive. */
  previews: Accessor<Record<number, string>>;
  /** The page's picture is taken (snapshot.waitForPicture): the switcher can show. */
  pictureTaken: Accessor<boolean>;
  /** The last tab whose title or address changed while the switcher is open. */
  changedTab: Accessor<TabText | undefined>;
  onOpen: (tab: SwitcherTab) => void;
  onClose: () => void;
  /** A tab closed from the switcher, and the switcher as it is now (Resume). */
  onCloseTab: (tab: SwitcherTab, resume: Resume) => void;
  /** A change made in the toolbar, to save; the switcher shows it at once. */
  onSettingsChange: (change: SettingsChange) => void;
  onSettings: () => void;
  /** The panel's size in pixels, each time it is taken: its own window fits it (snapshot.centeredOn). */
  onFrame?: (size: { width: number; height: number }) => void;
}

/** The panel's size and the grid's columns, fixed while the switcher is open. */
interface Frame {
  width: number;
  height: number;
  columns: number;
}

/** The list's width: its share of the page, between its minimum and its maximum (the CSS keeps it inside the page). */
function listWidth(): string {
  const { share, min, max } = sizes.listWidth;
  return `clamp(${em(min)}, calc(var(--page-width) * ${share / 100}), ${em(max)})`;
}

/** Where a tab is among those shown; none when it isn't, or when no tab is given. */
function indexOf(shown: ShownTab[], tabId: number | undefined): number | undefined {
  const index = shown.findIndex(({ tab }) => tab.id === tabId);
  return index === -1 ? undefined : index;
}

/** The longest the switcher waits for the page's picture before it shows. */
const PICTURE_WAIT_MS = 1000;

/** The switcher: its rules are the state machine's (lib/switcher/machine.ts); here they meet the keys and the UI. */
export function Switcher(props: SwitcherProps): JSX.Element {
  const { fromIcon, direction, centeredOn } = props.snapshot;
  // The page the switcher is in the middle of: the browser's window, or the Chrome window its own window is centered on.
  const pageWidth = () => centeredOn?.width ?? window.innerWidth;
  const [settings, setSettings] = createSignal<Settings>(props.snapshot.settings);
  const [tabs, setTabs] = createSignal(props.snapshot.tabs);
  // A tab's title or address changing while the switcher is open: its row shows it, in its place.
  createEffect(
    on(
      props.changedTab,
      (changed) => {
        if (!changed) return;
        setTabs((all) =>
          all.map((tab) => (tab.id === changed.tabId ? { ...tab, title: changed.title, url: changed.url } : tab)),
        );
      },
      { defer: true },
    ),
  );
  const resume = props.snapshot.resume;
  const [query, setQuery] = createSignal(resume?.query ?? '');
  const shown = createMemo<ShownTab[]>(() =>
    tabs().flatMap((tab) => {
      const title = matchTab(query(), tab.title, tab.url);
      return title ? [{ tab, title }] : [];
    }),
  );
  const [state, setState] = createSignal(
    start({
      count: shown().length,
      stayOpen: settings().stayOpen || fromIcon || !props.canSeeRelease,
      direction,
      resume: resume && {
        selected: indexOf(shown(), resume.selectedTabId),
        filtered: resume.query.trim() !== '',
      },
    }),
  );
  // Shown after the delay: a quick tap opens the previous tab before the switcher ever appears. Also not before the
  // page's picture is taken, or the switcher would be in it; never later than PICTURE_WAIT_MS all the same.
  const [delayOver, setDelayOver] = createSignal(fromIcon || settings().delayMs === 0);
  const [waitOver, setWaitOver] = createSignal(!props.snapshot.waitForPicture);
  const visible = () => delayOver() && (waitOver() || props.pictureTaken());
  const layout = (): Layout => (settings().view === 'list' ? 'list' : settings().gridShow);
  // The panel's size and the grid's columns are taken once, as the switcher opens (or as the toolbar changes how it
  // shows the tabs): they never change while it is open, whatever is typed or closed, or however the page is resized.
  const [frame, setFrame] = createSignal<Frame>();
  const columns = () =>
    frame()?.columns ?? (layout() === 'list' ? 1 : gridColumns(settings(), shown().length, pageWidth(), emPx()));
  // An em of the switcher in pixels (the user's text size), for the grid's columns: read from the panel once it is in
  // the page (takeFrame), Chrome's default until then.
  const [emPx, setEmPx] = createSignal(DEFAULT_EM_PX);
  const compact = () => layout() === 'list' && settings().compact;
  const now = Date.now();
  const language = languageInUse();
  // The auto-select line starts again each time the mouse moves onto another tab.
  const [autoSelectRound, setAutoSelectRound] = createSignal(0);
  let panel: HTMLDivElement | undefined;

  function dispatch(event: SwitcherEvent) {
    const result = step(state(), event);
    setState(result.state);
    if (result.effect?.type === 'open') {
      const target = shown()[result.effect.index];
      if (target) props.onOpen(target.tab);
    } else if (result.effect?.type === 'close') {
      props.onClose();
    }
  }

  function startSearching() {
    if (state().searching) return;
    dispatch({ type: 'openSearch' });
  }

  function search(value: string) {
    setQuery(value);
    dispatch({ type: 'results', count: shown().length, filtered: value.trim() !== '' });
  }

  function closeTab(index: number) {
    const target = shown()[index];
    if (!target) return;
    setTabs((all) => all.filter((tab) => tab.id !== target.tab.id));
    dispatch({ type: 'removed', index });
    // As the switcher is now, should it open again in another tab (the closed one was the tab it is in).
    props.onCloseTab(target.tab, {
      selectedTabId: shown()[state().selected]?.tab.id,
      query: query(),
      fromIcon: fromIcon || state().stayOpen,
    });
  }

  /** Takes the panel's size and the grid's columns, as they are now: they stay so until the next takeFrame. */
  function takeFrame() {
    setFrame(undefined);
    if (!panel) return;
    setEmPx(Number.parseFloat(getComputedStyle(panel).getPropertyValue('--bts-em')) || DEFAULT_EM_PX);
    const { width, height } = panel.getBoundingClientRect();
    setFrame({ width, height, columns: columns() });
    props.onFrame?.({ width, height });
  }

  /**
   * A change made in the toolbar: the switcher shows it at once, framed anew, and stays open (the user works in it).
   */
  function changeSettings(change: SettingsChange) {
    dispatch({ type: 'hold' });
    setSettings((now) => ({ ...now, ...change, details: { ...now.details, ...change.details } }));
    props.onSettingsChange(change);
    takeFrame();
  }

  /** The toolbar's buttons, reached with Tab, get their own keys (the arrows, Enter, Space); Esc still closes. */
  function inToolbarControls(event: Event) {
    return event.composedPath().some((target) => target instanceof HTMLElement && 'toolbarControls' in target.dataset);
  }

  function onKey(event: KeyboardEvent) {
    if (inToolbarControls(event) && event.key !== 'Escape') return;
    const switcherEvent = eventFor(event);
    if (!switcherEvent) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(switcherEvent);
  }

  /** The switcher's event for a key, with the tabs as they are laid out now. */
  function eventFor(key: Key): SwitcherEvent | null {
    // The direction the tabs are laid out in: the page's dir, as the panel has it.
    const direction = panel && getComputedStyle(panel).direction === 'rtl' ? 'rtl' : 'ltr';
    return keyEvent(key, { columns: columns(), inField: state().selected === FIELD, direction });
  }

  /** A click on the toolbar's buttons doesn't move the keyboard focus: the arrows and Enter keep working on the tabs. */
  function onMouseDown(event: MouseEvent) {
    if (inToolbarControls(event)) event.preventDefault();
  }

  /** A click outside the panel closes the switcher, as Esc does. */
  function onPointerDown(event: PointerEvent) {
    if (panel && !event.composedPath().includes(panel)) dispatch({ type: 'cancel' });
  }

  createEffect(on(props.moves, (move) => dispatch({ type: move.direction }), { defer: true }));
  createEffect(
    on(props.pageKeys, (pressed) => {
      const switcherEvent = pressed && eventFor(pressed.key);
      if (switcherEvent) dispatch(switcherEvent);
    }),
  );

  onMount(() => {
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
    takeFrame();
    const delay = delayOver() ? undefined : setTimeout(() => setDelayOver(true), settings().delayMs);
    const wait = waitOver() ? undefined : setTimeout(() => setWaitOver(true), PICTURE_WAIT_MS);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      clearTimeout(delay);
      clearTimeout(wait);
    });
  });

  // The sizes of lib/switcher/sizes.ts, for the CSS.
  const panelSizes = () => {
    const list = compact() ? sizes.compactList : sizes.list;
    const grid = layout() !== 'list';
    const fixed = frame();
    return {
      width: fixed ? `${fixed.width}px` : undefined,
      height: fixed ? `${fixed.height}px` : undefined,
      '--page-width': centeredOn ? `${centeredOn.width}px` : '100vw',
      '--page-height': centeredOn ? `${centeredOn.height}px` : '100vh',
      '--panel-width': grid ? 'auto' : listWidth(),
      '--panel-min-width': em(sizes.listWidth.min),
      '--panel-padding': em(grid ? sizes.grid.padding : list.padding),
      '--margin': em(sizes.margin),
      '--row': em(list.row),
      '--gap': em(sizes.gap),
      '--tile-width': em(tileWidth),
      '--tile-height': em(tileHeight(settings())),
      '--tile-gap': em(sizes.grid.tileGap),
      '--tile-border': em(sizes.grid.tileBorder),
      '--tile-padding': em(sizes.grid.tilePadding),
      '--tile-header': em(sizes.grid.tileHeader),
      '--tile-space': em(sizes.grid.tileSpace),
      '--tile-line': em(sizes.grid.tileLine),
      '--address-tuck': em(ADDRESS_TUCK),
      '--preview-width': em(sizes.preview.width),
      '--preview-height': em(sizes.preview.height),
      '--icon-cell': em(sizes.icons.cell),
      '--icon-gap': em(sizes.icons.gap),
      '--search-max-width': em(sizes.searchMaxWidth),
    };
  };

  return (
    <div class={styles.backdrop} classList={{ [styles.hidden as string]: !visible() }}>
      <div
        ref={panel}
        class={styles.panel}
        classList={{ [styles.compact as string]: compact(), [styles.ownWindow as string]: centeredOn !== undefined }}
        style={panelSizes()}
      >
        <Show when={settings().toolbar}>
          <SwitcherToolbar
            settings={settings()}
            search={
              <SearchField
                value={query()}
                selected={state().selected === FIELD}
                compact={compact()}
                onFocus={startSearching}
                onInput={search}
              />
            }
            onChange={changeSettings}
            onSettings={() => props.onSettings()}
          />
        </Show>
        <div class={styles.results}>
          <TabList
            layout={layout()}
            tabs={shown()}
            selected={state().selected}
            focused={state().selected !== FIELD}
            compact={compact()}
            columns={columns()}
            rows={layout() === 'list' ? listRows(settings(), shown().length) : undefined}
            details={settings().details}
            previews={props.previews()}
            now={now}
            language={language}
            autoSelectSeconds={settings().autoSelect ? settings().autoSelectSeconds : undefined}
            autoSelectRound={autoSelectRound()}
            onChoose={(index) => dispatch({ type: 'choose', index })}
            onClose={closeTab}
            onAutoSelect={() => dispatch({ type: 'autoSelect' })}
            onHover={(index) => {
              if (index !== state().selected) setAutoSelectRound((round) => round + 1);
            }}
          />
          <Show when={state().filtered && shown().length === 0}>
            <p class={styles.noMatch}>{i18n.t('Switcher_NoMatch')}</p>
          </Show>
        </div>
      </div>
    </div>
  );
}
