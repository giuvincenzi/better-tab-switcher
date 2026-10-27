import { createUniqueId, For, type JSX } from 'solid-js';
import styles from './SegmentedControl.module.css';
import type { SelectOption } from './Select';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  /** The id of the text that names it. */
  labelledBy: string;
  onChange: (value: T) => void;
}

/**
 * A choice between a few options, all in sight: the browser's own radio buttons, drawn as one control. Tab reaches
 * the chosen option, the arrows choose another (in the page's direction).
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  const name = createUniqueId();
  return (
    <fieldset class={styles.group} aria-labelledby={props.labelledBy}>
      <For each={props.options}>
        {(option) => (
          <label class={styles.option}>
            <input
              type="radio"
              class={styles.input}
              name={name}
              value={option.value}
              checked={option.value === props.value}
              onChange={() => props.onChange(option.value)}
            />
            {option.label}
          </label>
        )}
      </For>
    </fieldset>
  );
}
