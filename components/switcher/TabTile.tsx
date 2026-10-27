import { type JSX, Show } from 'solid-js';
import { i18n } from '#i18n';
import { faviconUrl } from '../../lib/favicon';
import type { TitleParts } from '../../lib/search/search';
import type { TabDetails } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';
import { IconButton } from '../ui/IconButton';
import { Address, AutoSelectLine, LastUsed, TabIcons, TabTitle, tabName } from './TabParts';
import { tabOptionId } from './TabRow';
import styles from './TabTile.module.css';

/** The site's icon in a tile without a preview: never shown larger than this. */
const SITE_ICON_SIZE = 32;

export interface TabTileProps {
  tab: SwitcherTab;
  title: TitleParts;
  selected: boolean;
  details: TabDetails;
  /** The tab's picture; until there is one, the site's icon. */
  picture?: string;
  /** Previews are off: the site's icon, never a picture. */
  iconOnly: boolean;
  /** Now, for "last used", in milliseconds since 1970. */
  now: number;
  language: string;
  /** Seconds before the selected tab opens by itself; none without Auto-select. */
  autoSelectSeconds?: number;
  onChoose: () => void;
  onClose: () => void;
  onAutoSelect: () => void;
}

/** One tab in the switcher's grid: the title above, the preview below. */
export function TabTile(props: TabTileProps): JSX.Element {
  const picture = () => (props.iconOnly ? undefined : props.picture);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys that open a tab (Enter, the arrows, Alt's release) belong to the grid, which points to the selected tile with aria-activedescendant (WAI-ARIA listbox pattern).
    <div
      id={tabOptionId(props.tab.id)}
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-label={tabName(props.tab, props.details, props.language)}
      class={styles.tile}
      classList={{
        [styles.selected as string]: props.selected,
        [styles.sleeping as string]: props.details.sleeping && props.tab.sleeping,
      }}
      onClick={() => props.onChoose()}
    >
      <div class={styles.header}>
        <img class={styles.favicon} src={faviconUrl(props.tab.url, 16)} alt="" />
        <span class={styles.title}>
          <TabTitle tab={props.tab} title={props.title} details={props.details} />
        </span>
        <TabIcons tab={props.tab} details={props.details} />
        <IconButton
          icon="close"
          label={i18n.t('Switcher_CloseTab')}
          size="small"
          class={styles.close}
          onClick={(event) => {
            event.stopPropagation();
            props.onClose();
          }}
        />
      </div>
      <Show when={props.details.address || props.details.lastUsed}>
        <div class={styles.meta}>
          <Show when={props.details.address}>
            <Address
              url={props.tab.url}
              scrolls={props.details.longAddress === 'scroll' && props.selected}
              class={styles.address}
            />
          </Show>
          <Show when={props.details.lastUsed}>
            <LastUsed tab={props.tab} now={props.now} language={props.language} />
          </Show>
        </div>
      </Show>
      <div class={styles.preview}>
        <Show
          when={picture()}
          fallback={
            <img
              class={styles.siteIcon}
              src={faviconUrl(props.tab.url, SITE_ICON_SIZE)}
              style={{ 'max-width': `${SITE_ICON_SIZE}px`, 'max-height': `${SITE_ICON_SIZE}px` }}
              alt=""
            />
          }
        >
          {(src) => <img class={styles.picture} src={src()} alt="" />}
        </Show>
      </div>
      <Show when={props.selected && props.autoSelectSeconds}>
        {(seconds) => <AutoSelectLine seconds={seconds()} onEnd={props.onAutoSelect} />}
      </Show>
    </div>
  );
}
