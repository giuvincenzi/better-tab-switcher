import { createEffect, type JSX, Show } from 'solid-js';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  /** Its accessible name. */
  label: string;
  children: JSX.Element;
  /** Closed with Esc, a click beside it, or by the page (open false). */
  onClose: () => void;
}

/**
 * A panel over the page along its start side (left, or right in a right-to-left page), as Chrome's settings show
 * their menu in a narrow window. Modal while open: Esc or a click beside it closes it.
 */
export function Drawer(props: DrawerProps): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.open && !dialog?.open) dialog?.showModal();
    else if (!props.open && dialog?.open) dialog.close();
  });
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click closes it from its backdrop; from the keyboard Esc does.
    <dialog
      ref={dialog}
      class={styles.drawer}
      aria-label={props.label}
      onClose={() => props.onClose()}
      // A click on the backdrop reaches the dialog itself, not its content.
      onClick={(event) => {
        if (event.target === dialog) dialog.close();
      }}
    >
      {/* Its content only while open: a closed drawer adds nothing to the page (no second copy of the links). */}
      <Show when={props.open}>
        <div class={styles.content}>{props.children}</div>
      </Show>
    </dialog>
  );
}
