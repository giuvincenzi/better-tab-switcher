import type { JSX } from 'solid-js';
import styles from './Button.module.css';

interface ButtonProps {
  children: JSX.Element;
  describedBy?: string;
  onClick: () => void;
}

/** A button with a text, outlined, like Chrome's settings. */
export function Button(props: ButtonProps): JSX.Element {
  return (
    <button type="button" class={styles.button} aria-describedby={props.describedBy} onClick={() => props.onClick()}>
      {props.children}
    </button>
  );
}
