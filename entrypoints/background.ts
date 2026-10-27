import { browser, defineBackground } from '#imports';
import type { Direction } from '../lib/messages';
import { listenToSwitcher, showPreview, showSwitcher } from '../lib/presenter/presenter';
import { keepPreviews } from '../lib/previews/service';

export default defineBackground(() => {
  const previews = keepPreviews((tabId, picture) => void showPreview(tabId, picture));
  const show = (direction: Direction, fromClick: boolean) => showSwitcher(direction, fromClick, previews);
  browser.commands.onCommand.addListener((command) => {
    if (command === 'next-tab') void show('next', false);
    else if (command === 'previous-tab') void show('previous', false);
  });
  browser.action.onClicked.addListener(() => void show('next', true));
  listenToSwitcher();

  // The end-to-end tests can't press Chrome's shortcuts: in their build only, they open the switcher as a shortcut does.
  if (import.meta.env.MODE === 'e2e') Object.assign(globalThis, { betterTabSwitcherTest: { showSwitcher: show } });
});
