import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from './NumberField.module.css';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  /** The unit after the number, written in `language`: short after it ("ms"), whole for screen readers. */
  unit?: { unit: 'millisecond' | 'second'; language: string };
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
  const unitId = createUniqueId();
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
        aria-describedby={[props.unit && unitId, props.describedBy].filter(Boolean).join(' ') || undefined}
        disabled={props.disabled}
        onChange={(event) => commit(event.currentTarget)}
      />
      <Show when={props.unit}>
        {(unit) => (
          <>
            <span class={styles.unit} aria-hidden="true">
              {unitText(unit(), props.value, 'narrow')}
            </span>
            {/* The unit read after the number by screen readers: the whole word, as many as the number says. */}
            <span id={unitId} hidden>
              {unitText(unit(), props.value, 'long')}
            </span>
          </>
        )}
      </Show>
    </span>
  );
}

/** A unit's name in its language, for `value` of it: "ms" (narrow), "milliseconds" (long). */
function unitText(
  { unit, language }: { unit: 'millisecond' | 'second'; language: string },
  value: number,
  unitDisplay: 'narrow' | 'long',
): string {
  const parts = new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay }).formatToParts(value);
  return parts.find((part) => part.type === 'unit')?.value ?? '';
}
