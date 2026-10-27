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
import { FIELD, type SwitcherEvent, start, step } from '../../lib/switcher/machine';
import { ADDRESS_TUCK, gridColumns, sizes, tileHeight, tileWidth, visibleRows } from '../../lib/switcher/sizes';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { SearchField } from './SearchField';
import styles from './Switcher.module.css';
import { SwitcherFooter } from './SwitcherFooter';
import { type ShownTab, TabList } from './TabList';

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
  onSettings: () => void;
}

/** The longest the switcher waits for the page's picture before it shows. */
const PICTURE_WAIT_MS = 1000;

/** The switcher: its rules are the state machine's (lib/switcher/machine.ts); here they meet the keys and the UI. */
export function Switcher(props: SwitcherProps): JSX.Element {
  const { settings, fromClick, direction, shortcuts } = props.snapshot;
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
      hasField: settings.search,
      stayOpen: settings.stayOpen || fromClick || !props.canSeeRelease,
      direction,
    }),
  );
  // Shown after the delay: a quick tap opens the previous tab before the switcher ever appears. Also not before the
  // page's picture is taken, or the switcher would be in it; never later than PICTURE_WAIT_MS all the same.
  const [delayOver, setDelayOver] = createSignal(fromClick || settings.delayMs === 0);
  const [waitOver, setWaitOver] = createSignal(!props.snapshot.waitForPicture);
  const visible = () => delayOver() && (waitOver() || props.pictureTaken());
  const grid = settings.view === 'grid';
  const columns = () => (grid ? gridColumns(settings, shown().length) : 1);
  const now = Date.now();
  const language = browser.i18n.getUILanguage();

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

  function onKey(event: KeyboardEvent) {
    const switcherEvent = keyEvent(event, { columns: columns(), inField: state().selected === FIELD });
    if (!switcherEvent) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(switcherEvent);
  }

  let panel: HTMLDivElement | undefined;

  /** A click outside the panel closes the switcher, as Esc does. */
  function onPointerDown(event: PointerEvent) {
    if (panel && !event.composedPath().includes(panel)) dispatch({ type: 'cancel' });
  }

  createEffect(on(props.moves, (move) => dispatch({ type: move.direction }), { defer: true }));

  onMount(() => {
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    const delay = delayOver() ? undefined : setTimeout(() => setDelayOver(true), settings.delayMs);
    const wait = waitOver() ? undefined : setTimeout(() => setWaitOver(true), PICTURE_WAIT_MS);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      clearTimeout(delay);
      clearTimeout(wait);
    });
  });

  const compact = !grid && settings.compact;
  // The sizes of lib/switcher/sizes.ts, for the CSS: the switcher's own window is made with the same ones.
  const panelSizes = () => {
    const list = compact ? sizes.compactList : sizes.list;
    return {
      '--panel-width': grid ? 'auto' : `${list.width}px`,
      '--panel-padding': `${grid ? sizes.grid.padding : list.padding}px`,
      '--row': `${list.row}px`,
      '--gap': `${sizes.gap}px`,
      '--tile-width': `${tileWidth}px`,
      '--tile-height': `${tileHeight(settings)}px`,
      '--tile-gap': `${sizes.grid.tileGap}px`,
      '--tile-border': `${sizes.grid.tileBorder}px`,
      '--tile-padding': `${sizes.grid.tilePadding}px`,
      '--tile-header': `${sizes.grid.tileHeader}px`,
      '--tile-space': `${sizes.grid.tileSpace}px`,
      '--tile-line': `${sizes.grid.tileLine}px`,
      '--address-tuck': `${ADDRESS_TUCK}px`,
      '--preview-width': `${sizes.preview.width}px`,
      '--preview-height': `${sizes.preview.height}px`,
    };
  };

  const hint = () => {
    const { next, previous } = shortcuts;
    if (state().stayOpen || next === '') return i18n.t('Switcher_HintStayOpen');
    if (state().selected === FIELD) return i18n.t('Switcher_HintSearch', [next]);
    return previous === '' ? i18n.t('Switcher_HintNextOnly', [next]) : i18n.t('Switcher_HintKeys', [next, previous]);
  };

  return (
    <div class={styles.backdrop} classList={{ [styles.hidden as string]: !visible() }}>
      <div ref={panel} class={styles.panel} classList={{ [styles.compact as string]: compact }} style={panelSizes()}>
        <Show when={state().hasField}>
          <SearchField value={query()} selected={state().selected === FIELD} compact={compact} onInput={search} />
        </Show>
        <TabList
          view={settings.view}
          tabs={shown()}
          selected={state().selected}
          focused={state().selected !== FIELD}
          compact={compact}
          columns={columns()}
          rows={visibleRows(settings, shown().length)}
          details={settings.details}
          previews={settings.previews ? props.previews() : undefined}
          now={now}
          language={language}
          autoSelectSeconds={settings.autoSelect ? settings.autoSelectSeconds : undefined}
          onChoose={(index) => dispatch({ type: 'choose', index })}
          onClose={closeTab}
          onAutoSelect={() => dispatch({ type: 'autoSelect' })}
        />
        <Show when={state().hasField && shown().length === 0}>
          <p class={styles.noMatch}>{i18n.t('Switcher_NoMatch')}</p>
        </Show>
        <SwitcherFooter
          hint={hint()}
          compact={compact}
          onSearch={() => dispatch({ type: 'openSearch' })}
          onSettings={() => props.onSettings()}
        />
      </div>
    </div>
  );
}
