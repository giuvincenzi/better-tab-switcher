import { type JSX, Show } from 'solid-js';
import { faviconUrl } from '../../lib/favicon';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import styles from './TabIcon.module.css';
import { AutoSelectLine, MIDDLE_BUTTON, preventMiddleClickScroll, tabName } from './TabParts';
import { tabOptionId } from './TabRow';

/** The site's icon: never shown larger than this, nor than its own size. */
const SITE_ICON_SIZE = 32;

export interface TabIconProps {
  tab: SwitcherTab;
  selected: boolean;
  details: TabDetails;
  language: string;
  /** Seconds before the selected tab opens by itself; none without Auto-select. */
  autoSelectSeconds?: number;
  /** Changes when the auto-select line starts again. */
  autoSelectRound: number;
  onChoose: () => void;
  onClose: () => void;
  onAutoSelect: () => void;
  /** The mouse moved onto the tab. */
  onHover: () => void;
}

/** One tab in the grid of icons: only the site's icon, as the Mac's app switcher shows apps. */
export function TabIcon(props: TabIconProps): JSX.Element {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys that open a tab (Enter, the arrows, Alt's release) belong to the grid, which points to the selected icon with aria-activedescendant (WAI-ARIA listbox pattern).
    <div
      id={tabOptionId(props.tab.id)}
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-label={tabName(props.tab, props.details, props.language)}
      class={styles.cell}
      classList={{
        [styles.selected as string]: props.selected,
        [styles.sleeping as string]: props.details.sleeping && props.tab.sleeping,
      }}
      onClick={() => props.onChoose()}
      onPointerEnter={() => props.onHover()}
      onMouseDown={preventMiddleClickScroll}
      onAuxClick={(event) => {
        if (event.button === MIDDLE_BUTTON) props.onClose();
      }}
    >
      <img
        class={styles.icon}
        src={faviconUrl(props.tab.url, SITE_ICON_SIZE)}
        style={{ 'max-width': `${SITE_ICON_SIZE}px`, 'max-height': `${SITE_ICON_SIZE}px` }}
        alt=""
      />
      <Show when={props.selected && props.autoSelectSeconds}>
        {(seconds) => <AutoSelectLine seconds={seconds()} round={props.autoSelectRound} onEnd={props.onAutoSelect} />}
      </Show>
    </div>
  );
}
