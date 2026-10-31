import type { JSX } from 'solid-js';
import styles from './Button.module.css';

interface ButtonProps {
  children: JSX.Element;
  describedBy?: string;
  /** The main action (of a dialog): filled with the accent color. */
  primary?: boolean;
  onClick: () => void;
}

/** A button with a text, outlined like Chrome's settings, or filled for the main action. */
export function Button(props: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class={styles.button}
      classList={{ [styles.primary as string]: props.primary }}
      aria-describedby={props.describedBy}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}
