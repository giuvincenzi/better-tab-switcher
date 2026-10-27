import { For, type JSX } from 'solid-js';
import { Icon } from './Icon';
import styles from './Select.module.css';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  /** The id of the text that names it. */
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}

/** A drop-down list: the browser's own, so it works with the keyboard and screen readers as everywhere else. */
export function Select<T extends string>(props: SelectProps<T>): JSX.Element {
  return (
    <span class={styles.wrap}>
      <select
        class={styles.select}
        aria-labelledby={props.labelledBy}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.value as T)}
      >
        <For each={props.options}>
          {(option) => (
            <option value={option.value} selected={option.value === props.value}>
              {option.label}
            </option>
          )}
        </For>
      </select>
      <span class={styles.chevron}>
        <Icon name="chevron" size={14} />
      </span>
    </span>
  );
}
