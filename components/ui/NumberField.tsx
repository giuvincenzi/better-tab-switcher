import { type JSX, Show } from 'solid-js';
import styles from './NumberField.module.css';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  /** The unit after the number, written in the language in use ("ms", "s"). */
  unit?: string;
  /** The id of the text that names it. */
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * A whole number between `min` and `max`, saved when the field is left or Enter is pressed. A number out of range
 * goes back to the nearest limit; anything else, back to the value it had.
 */
export function NumberField(props: NumberFieldProps): JSX.Element {
  function commit(input: HTMLInputElement) {
    const typed = Math.round(Number(input.value));
    if (input.value.trim() === '' || !Number.isFinite(typed)) {
      input.value = String(props.value);
      return;
    }
    const value = Math.min(props.max, Math.max(props.min, typed));
    input.value = String(value);
    if (value !== props.value) props.onChange(value);
  }

  return (
    <span class={styles.field} classList={{ [styles.disabled as string]: props.disabled }}>
      <input
        type="number"
        class={styles.input}
        inputMode="numeric"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        aria-labelledby={props.labelledBy}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        onChange={(event) => commit(event.currentTarget)}
      />
      <Show when={props.unit}>
        <span class={styles.unit} aria-hidden="true">
          {props.unit}
        </span>
      </Show>
    </span>
  );
}
