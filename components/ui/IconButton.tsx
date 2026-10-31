import type { JSX } from 'solid-js';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

interface IconButtonProps {
  icon: IconName;
  /** What the button does: its accessible name. */
  label: string;
  size?: 'small' | 'medium' | 'large';
  class?: string;
  /** For a button that turns something on and off: whether it is on. */
  pressed?: boolean;
  onClick: (event: MouseEvent) => void;
}

/** The icon's size in em, for each size of button. */
const ICON_SIZE = { small: 0.75, medium: 0.875, large: 1 } as const;

/** A button with only an icon; its background shows under the mouse, and while it is pressed (on). */
export function IconButton(props: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class={`${styles.button} ${props.size ? (styles[props.size] ?? '') : ''} ${props.class ?? ''}`}
      aria-label={props.label}
      aria-pressed={props.pressed}
      onClick={(event) => props.onClick(event)}
    >
      <Icon name={props.icon} size={ICON_SIZE[props.size ?? 'medium']} />
    </button>
  );
}
