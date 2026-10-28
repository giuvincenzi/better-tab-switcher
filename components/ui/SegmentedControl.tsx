import { createUniqueId, For, type JSX, Show } from 'solid-js';
import { Icon, type IconName } from './Icon';
import styles from './SegmentedControl.module.css';
import type { SelectOption } from './Select';

/** An option: its label, or in its place an icon or a short text (the label still names it for screen readers). */
export interface SegmentOption<T extends string> extends SelectOption<T> {
  icon?: IconName;
  short?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  /** The id of the text that names it, or its name when no text in sight does. */
  labelledBy?: string;
  label?: string;
  onChange: (value: T) => void;
}

/**
 * A choice between a few options, all in sight: the browser's own radio buttons, drawn as one control. Tab reaches
 * the chosen option, the arrows choose another (in the page's direction).
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  const name = createUniqueId();
  return (
    <fieldset class={styles.group} aria-labelledby={props.labelledBy} aria-label={props.label}>
      <For each={props.options}>
        {(option) => (
          <label
            class={styles.option}
            classList={{ [styles.compactOption as string]: !!(option.icon || option.short) }}
          >
            <input
              type="radio"
              class={styles.input}
              name={name}
              value={option.value}
              checked={option.value === props.value}
              onChange={() => props.onChange(option.value)}
            />
            <Show when={option.icon || option.short} fallback={option.label}>
              <span class={styles.hidden}>{option.label}</span>
              <Show when={option.icon} fallback={<span aria-hidden="true">{option.short}</span>}>
                {(icon) => <Icon name={icon()} size={16} />}
              </Show>
            </Show>
          </label>
        )}
      </For>
    </fieldset>
  );
}
