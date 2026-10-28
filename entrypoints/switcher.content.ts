import { i18n } from '#i18n';
import { browser, type ContentScriptContext, createShadowRootUi, defineContentScript } from '#imports';
import type { Key } from '../lib/keys/keys';
import { onMessage, sendMessage } from '../lib/messages';

// The switcher's frame in a page: injected by the background only when the switcher is asked for there (not listed in
// the manifest). It holds the frame the switcher is drawn in (entrypoints/switcher-frame), an extension page the page
// can't look into, in a closed shadow root: the page never reaches the switcher's tabs, nor finds their titles. The frame
// is made the first time and then only shown and hidden, so the next switcher shows at once.
export default defineContentScript({
  registration: 'runtime',
  main(ctx) {
    let holder: Promise<FrameHolder> | undefined;

    onMessage('showFrame', async () => {
      // The page has the focus (the frame in it too): the keys let go reach the switcher.
      const canSeeRelease = document.hasFocus();
      let shown = await holder;
      // A page that rebuilds itself can take the frame out: it is made again.
      if (!shown?.inPage()) {
        shown?.remove();
        holder = holdFrame(ctx);
        shown = await holder;
      }
      return { canSeeRelease, keys: await shown.show() };
    });
    onMessage('hideFrame', async () => (await holder)?.hide());
  },
});

/** The holder's own look: a dialog over the whole window, the frame filling it, and nothing of theirs to see. */
const HOLDER_CSS = `
  dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    outline: none;
    background: transparent;
  }
  dialog::backdrop {
    background: transparent;
  }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    /* The same as the frame's root (no theme there): Chrome draws a frame whose color scheme differs from its
       element's on an opaque background. */
    color-scheme: normal;
  }
`;

interface FrameHolder {
  /**
   * Over the page, with the keyboard focus, once the frame's page is loaded: it answers the switcher's messages (unless
   * the page keeps scripts out of its frames). Gives the keys the page got meanwhile.
   */
  show: () => Promise<Key[]>;
  hide: () => void;
  /** Still in the page. */
  inPage: () => boolean;
  remove: () => void;
}

/**
 * Puts the switcher's frame in the page, hidden. It is drawn in a modal dialog: the browser's top layer, above
 * everything of the page, its own dialogs, popovers and full screen elements too.
 */
async function holdFrame(ctx: ContentScriptContext): Promise<FrameHolder> {
  const dialog = document.createElement('dialog');
  // Esc is the switcher's own key, never the dialog's.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  const frame = document.createElement('iframe');
  frame.title = i18n.t('Extension_Name');
  frame.src = browser.runtime.getURL('/switcher-frame.html');
  const loaded = new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }));
  dialog.append(frame);
  const ui = await createShadowRootUi(ctx, {
    name: 'better-tab-switcher',
    mode: 'closed',
    css: HOLDER_CSS,
    position: 'inline',
    anchor: 'html',
    onMount: (container) => container.append(dialog),
  });
  ui.mount();
  const keys = passKeysOn(ctx, dialog);
  return {
    async show() {
      // The page's own zoom (CSS zoom on its root, where the holder is) would enlarge the frame: it is undone, so the
      // switcher has the size it has on any page.
      dialog.style.zoom = String(1 / pageZoom());
      if (!dialog.open) dialog.showModal();
      frame.focus();
      keys.hold();
      await loaded;
      return keys.release();
    },
    hide: () => dialog.close(),
    inPage: () => ui.shadowHost.isConnected,
    remove: () => ui.remove(),
  };
}

/** The zoom the page gives its root element with CSS (1 when none). */
function pageZoom(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
}

/**
 * While the frame is shown, the keys that reach the page are the switcher's: the frame doesn't have the focus yet (it
 * is loading, the first time). They go to the switcher, so letting go of the shortcut quickly still opens the tab.
 * Held from `hold` until `release`, while there is no switcher yet to take them.
 */
function passKeysOn(ctx: ContentScriptContext, dialog: HTMLDialogElement): { hold: () => void; release: () => Key[] } {
  let held: Key[] | undefined;
  const pass = (event: KeyboardEvent) => {
    // Shown over this page: a page that rebuilds itself may have taken the frame out while it was open.
    if (!dialog.matches(':modal') || !event.isTrusted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { type, key, altKey, ctrlKey, metaKey, isComposing } = event;
    const passed: Key = { type, key, altKey, ctrlKey, metaKey, isComposing };
    if (held) held.push(passed);
    else void sendMessage('keyInPage', passed);
  };
  ctx.addEventListener(window, 'keydown', pass, { capture: true });
  ctx.addEventListener(window, 'keyup', pass, { capture: true });
  return {
    hold: () => {
      held = [];
    },
    release: () => {
      const keys = held ?? [];
      held = undefined;
      return keys;
    },
  };
}
