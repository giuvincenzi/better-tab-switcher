import type { JSX } from 'solid-js';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  /** The id of the text that names it. */
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch, like Chrome's settings. */
export function Toggle(props: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      class={styles.toggle}
      aria-checked={props.checked}
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class={styles.knob} />
    </button>
  );
}
