import { createEffect, createUniqueId, type JSX, Show } from 'solid-js';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  description: string;
  /** A question the user answers with the actions (a confirmation): read by screen readers as an alert. */
  alert?: boolean;
  /** Between the description and the actions. */
  children?: JSX.Element;
  /** Its buttons, the main one last. */
  actions: JSX.Element;
  /** Closed with Esc, or by the page (open false). */
  onClose: () => void;
}

/**
 * A dialog over the page, the one every part of the extension uses: its title, a description, what it holds, and its
 * actions. Modal (the page behind can't be used meanwhile), closed with Esc too.
 */
export function Dialog(props: DialogProps): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  const titleId = createUniqueId();
  const descriptionId = createUniqueId();
  createEffect(() => {
    if (props.open && !dialog?.open) dialog?.showModal();
    else if (!props.open && dialog?.open) dialog.close();
  });
  return (
    <dialog
      ref={dialog}
      class={styles.dialog}
      role={props.alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => props.onClose()}
    >
      {/* Its content only while open: a closed dialog adds nothing to the page (no second copy of a section). */}
      <Show when={props.open}>
        <div class={styles.head}>
          <h2 id={titleId} class={styles.title}>
            {props.title}
          </h2>
          <p id={descriptionId} class={styles.description}>
            {props.description}
          </p>
        </div>
        {props.children}
        <div class={styles.actions}>{props.actions}</div>
      </Show>
    </dialog>
  );
}
