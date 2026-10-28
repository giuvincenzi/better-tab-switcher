import type { JSX } from 'solid-js';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

interface IconButtonProps {
  icon: IconName;
  /** What the button does: its accessible name. */
  label: string;
  size?: 'small' | 'medium';
  class?: string;
  /** For a button that opens a menu: whether it is open, and the menu's id. */
  expanded?: boolean;
  controls?: string;
  onClick: (event: MouseEvent) => void;
}

/** A button with only an icon; its background shows under the mouse. */
export function IconButton(props: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class={`${styles.button} ${props.size === 'small' ? styles.small : ''} ${props.class ?? ''}`}
      aria-label={props.label}
      aria-expanded={props.expanded}
      aria-controls={props.controls}
      onClick={(event) => props.onClick(event)}
    >
      <Icon name={props.icon} size={props.size === 'small' ? 12 : 14} />
    </button>
  );
}
