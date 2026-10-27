import { type JSX, Match, Switch } from 'solid-js';

export type IconName = 'search' | 'close' | 'settings' | 'pin' | 'audio' | 'sleep' | 'window';

interface IconProps {
  name: IconName;
  size: number;
  /** What the icon says, for screen readers; none when the text next to it already says it. */
  label?: string;
}

/** The extension's icons: strokes in the text's color. */
export function Icon(props: IconProps): JSX.Element {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={props.label ? 'img' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      <Switch>
        <Match when={props.name === 'search'}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </Match>
        <Match when={props.name === 'close'}>
          <path d="M6 6l12 12M18 6L6 18" />
        </Match>
        <Match when={props.name === 'settings'}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </Match>
        <Match when={props.name === 'pin'}>
          <path d="M12 17v5" />
          <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
        </Match>
        <Match when={props.name === 'audio'}>
          <path d="M11 5L6 9H3v6h3l5 4z" />
          <path d="M15.5 8.5a5 5 0 010 7" />
          <path d="M18.5 5.5a9 9 0 010 13" />
        </Match>
        <Match when={props.name === 'sleep'}>
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        </Match>
        <Match when={props.name === 'window'}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
        </Match>
      </Switch>
    </svg>
  );
}
