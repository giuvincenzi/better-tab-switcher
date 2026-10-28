import '../styles/theme.css';
import { createShadowRootUi, defineContentScript } from '#imports';
import { mountSwitcher, type SwitcherHandle } from '../components/switcher/mountSwitcher';
import { onMessage } from '../lib/messages';

// The switcher in a page: injected by the background only when the switcher is asked for there (not listed in the
// manifest), drawn in a shadow root so the page's styles never reach it, and removed when it closes.
export default defineContentScript({
  registration: 'runtime',
  cssInjectionMode: 'ui',
  main(ctx) {
    let remove: (() => void) | undefined;
    let handle: SwitcherHandle | undefined;
    // Counts the switchers asked for and closed: a switcher still being made when it is closed (or replaced) is never
    // shown. The background closes a switcher it gave up waiting for: the page was busy.
    let latest = 0;

    onMessage('showSwitcher', async ({ data: snapshot }) => {
      const asked = ++latest;
      remove?.();
      const ui = await createShadowRootUi(ctx, {
        name: 'better-tab-switcher',
        position: 'inline',
        anchor: 'body',
        isolateEvents: true,
        onMount(container) {
          handle = mountSwitcher(container, snapshot, () => remove?.());
        },
        onRemove() {
          handle?.dispose();
          handle = undefined;
        },
      });
      if (asked !== latest) return;
      remove = () => {
        remove = undefined;
        ui.remove();
      };
      ui.mount();
    });

    onMessage('moveSwitcher', ({ data: direction }) => {
      if (!handle) throw new Error('No switcher is open in this page.');
      handle.move(direction);
    });
    onMessage('closeSwitcher', () => {
      latest++;
      remove?.();
    });
    onMessage('previewReady', ({ data: preview }) => handle?.showPreview(preview));
    onMessage('pictureTaken', () => handle?.pictureTaken());
  },
});
