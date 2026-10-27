import '../styles/theme.css';
import { createShadowRootUi, defineContentScript } from '#imports';
import { mountSwitcher, type SwitcherHandle } from '../components/switcher/mountSwitcher';
import { onMessage } from '../lib/messages';

// The switcher in a page: injected by the background only when the shortcut is pressed there (not listed in the
// manifest), drawn in a shadow root so the page's styles never reach it, and removed when it closes.
export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  main(ctx) {
    let remove: (() => void) | undefined;
    let handle: SwitcherHandle | undefined;

    onMessage('showSwitcher', async ({ data: snapshot }) => {
      remove?.();
      const ui = await createShadowRootUi(ctx, {
        name: 'better-tab-switcher',
        position: 'modal',
        zIndex: 2147483647,
        isolateEvents: true,
        onMount(container, _shadow, host) {
          handle = mountSwitcher(container, host, snapshot, document.hasFocus(), () => remove?.());
        },
        onRemove() {
          handle?.dispose();
          handle = undefined;
        },
      });
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
  },
});
