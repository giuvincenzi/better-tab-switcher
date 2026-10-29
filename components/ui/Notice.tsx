import type { JSX } from 'solid-js';
import { Icon } from './Icon';
import styles from './Notice.module.css';

/** A warning in the warning's color: something to do, said as a sentence, read by screen readers when it shows. */
export function Notice(props: { children: JSX.Element }): JSX.Element {
  return (
    <div role="status" class={styles.notice}>
      <Icon name="warning" size={1.125} />
      <span>{props.children}</span>
    </div>
  );
}
