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
import { browser } from '#imports';
import { keyEvent } from '../../lib/keys/keys';
import type { Direction, SwitcherSnapshot } from '../../lib/messages';
import { matchTab } from '../../lib/search/search';
import type { Settings } from '../../lib/settings/settings';
import type { SettingsChange } from '../../lib/settings/store';
import { FIELD, type SwitcherEvent, start, step } from '../../lib/switcher/machine';
import { ADDRESS_TUCK, gridColumns, listRows, sizes, tileHeight, tileWidth } from '../../lib/switcher/sizes';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { SearchField } from './SearchField';
import styles from './Switcher.module.css';
import { SwitcherFooter } from './SwitcherFooter';
import { type Layout, type ShownTab, TabList } from './TabList';

export interface SwitcherProps {
  snapshot: SwitcherSnapshot;
  /** Changes each time the shortcut is pressed again while the switcher is open. */
  moves: Accessor<{ direction: Direction; count: number }>;
  /** Releasing the shortcut's modifier can be seen here: this page has the keyboard focus. */
  canSeeRelease: boolean;
  /** The tabs' pictures by tab id, as they arrive. */
  previews: Accessor<Record<number, string>>;
  /** The page's picture is taken (snapshot.waitForPicture): the switcher can show. */
  pictureTaken: Accessor<boolean>;
  onOpen: (tab: SwitcherTab) => void;
  onClose: () => void;
  onCloseTab: (tab: SwitcherTab) => void;
  /** A change made in the Display menu, to save; the switcher shows it at once. */
  onSettingsChange: (change: SettingsChange) => void;
  onSettings: () => void;
}

/** The panel's size and the grid's columns, fixed while the switcher is open. */
interface Frame {
  width: number;
  height: number;
  columns: number;
}

/** The longest the switcher waits for the page's picture before it shows. */
const PICTURE_WAIT_MS = 1000;

/** The switcher: its rules are the state machine's (lib/switcher/machine.ts); here they meet the keys and the UI. */
export function Switcher(props: SwitcherProps): JSX.Element {
  const { fromIcon, direction, shortcuts } = props.snapshot;
  const [settings, setSettings] = createSignal<Settings>(props.snapshot.settings);
  const [tabs, setTabs] = createSignal(props.snapshot.tabs);
  const [query, setQuery] = createSignal('');
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
    }),
  );
  // Shown after the delay: a quick tap opens the previous tab before the switcher ever appears. Also not before the
  // page's picture is taken, or the switcher would be in it; never later than PICTURE_WAIT_MS all the same.
  const [delayOver, setDelayOver] = createSignal(fromIcon || settings().delayMs === 0);
  const [waitOver, setWaitOver] = createSignal(!props.snapshot.waitForPicture);
  const visible = () => delayOver() && (waitOver() || props.pictureTaken());
  const layout = (): Layout => (settings().view === 'list' ? 'list' : settings().gridShow);
  // The panel's size and the grid's columns are taken once, as the switcher opens (or as the Display menu changes how it
  // shows the tabs): they never change while it is open, whatever is typed or closed, or however the page is resized.
  const [frame, setFrame] = createSignal<Frame>();
  const columns = () =>
    frame()?.columns ?? (layout() === 'list' ? 1 : gridColumns(settings(), shown().length, window.innerWidth));
  const compact = () => layout() === 'list' && settings().compact;
  const now = Date.now();
  const language = browser.i18n.getUILanguage();
  // The search field shows with Search on, and while the user searches (the footer's search button shows it then).
  const fieldShown = () => settings().search || state().searching;
  // The auto-select line starts again each time the mouse moves onto another tab.
  const [autoSelectRound, setAutoSelectRound] = createSignal(0);
  const [menuOpen, setMenuOpen] = createSignal(false);
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
    props.onCloseTab(target.tab);
    setTabs((all) => all.filter((tab) => tab.id !== target.tab.id));
    dispatch({ type: 'removed', index });
  }

  function toggleMenu() {
    if (!menuOpen()) dispatch({ type: 'hold' });
    setMenuOpen((open) => !open);
  }

  /** Takes the panel's size and the grid's columns, as they are now: they stay so until the next takeFrame. */
  function takeFrame() {
    setFrame(undefined);
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    setFrame({ width, height, columns: columns() });
  }

  /** A change made in the Display menu: the switcher shows it at once, framed anew, and the menu closes. */
  function changeSettings(change: SettingsChange) {
    setSettings((now) => ({ ...now, ...change, details: { ...now.details, ...change.details } }));
    props.onSettingsChange(change);
    setMenuOpen(false);
    takeFrame();
  }

  /** The Display menu's own controls get their keys; Esc closes the menu, not the switcher. */
  function inMenu(event: Event) {
    return event.composedPath().some((target) => target instanceof HTMLElement && 'displayMenu' in target.dataset);
  }

  function onKey(event: KeyboardEvent) {
    if (inMenu(event)) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
      }
      return;
    }
    const switcherEvent = keyEvent(event, { columns: columns(), inField: state().selected === FIELD });
    if (!switcherEvent) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(switcherEvent);
  }

  /** A click outside the panel closes the switcher, as Esc does; outside the Display menu, it closes the menu. */
  function onPointerDown(event: PointerEvent) {
    const path = event.composedPath();
    if (panel && !path.includes(panel)) dispatch({ type: 'cancel' });
    else if (menuOpen() && !inMenu(event) && !path.some((target) => target instanceof HTMLButtonElement)) {
      setMenuOpen(false);
    }
  }

  createEffect(on(props.moves, (move) => dispatch({ type: move.direction }), { defer: true }));

  onMount(() => {
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    takeFrame();
    const delay = delayOver() ? undefined : setTimeout(() => setDelayOver(true), settings().delayMs);
    const wait = waitOver() ? undefined : setTimeout(() => setWaitOver(true), PICTURE_WAIT_MS);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
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
      '--panel-width': grid ? 'auto' : `max(${sizes.listWidth.minWidth}px, ${sizes.listWidth[settings().listWidth]}vw)`,
      '--panel-padding': `${grid ? sizes.grid.padding : list.padding}px`,
      '--margin': `${sizes.margin}px`,
      '--row': `${list.row}px`,
      '--gap': `${sizes.gap}px`,
      '--tile-width': `${tileWidth}px`,
      '--tile-height': `${tileHeight(settings())}px`,
      '--tile-gap': `${sizes.grid.tileGap}px`,
      '--tile-border': `${sizes.grid.tileBorder}px`,
      '--tile-padding': `${sizes.grid.tilePadding}px`,
      '--tile-header': `${sizes.grid.tileHeader}px`,
      '--tile-space': `${sizes.grid.tileSpace}px`,
      '--tile-line': `${sizes.grid.tileLine}px`,
      '--address-tuck': `${ADDRESS_TUCK}px`,
      '--preview-width': `${sizes.preview.width}px`,
      '--preview-height': `${sizes.preview.height}px`,
      '--icon-cell': `${sizes.icons.cell}px`,
      '--icon-gap': `${sizes.icons.gap}px`,
    };
  };

  const hint = () => {
    const { next, previous } = shortcuts;
    if (state().stayOpen || next === '') return i18n.t('Switcher_HintStayOpen');
    return previous === '' ? i18n.t('Switcher_HintNextOnly', [next]) : i18n.t('Switcher_HintKeys', [next, previous]);
  };

  return (
    <div class={styles.backdrop} classList={{ [styles.hidden as string]: !visible() }}>
      <div ref={panel} class={styles.panel} classList={{ [styles.compact as string]: compact() }} style={panelSizes()}>
        <Show when={fieldShown()}>
          <SearchField
            value={query()}
            selected={state().selected === FIELD}
            compact={compact()}
            onFocus={startSearching}
            onInput={search}
          />
        </Show>
        <div class={styles.results}>
          <TabList
            layout={layout()}
            tabs={shown()}
            selected={state().selected}
            focused={state().selected !== FIELD && !menuOpen()}
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
        <SwitcherFooter
          hint={hint()}
          compact={compact()}
          onSearch={fieldShown() ? undefined : startSearching}
          settings={settings()}
          menuOpen={menuOpen()}
          onMenu={toggleMenu}
          onChange={changeSettings}
          onSettings={() => props.onSettings()}
        />
      </div>
    </div>
  );
}
