import { browser, defineBackground } from '#imports';
import { listenToSwitcher, showSwitcher } from '../lib/presenter/presenter';

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    if (command === 'next-tab') void showSwitcher('next', false);
    else if (command === 'previous-tab') void showSwitcher('previous', false);
  });
  browser.action.onClicked.addListener(() => void showSwitcher('next', true));
  listenToSwitcher();

  // The end-to-end tests can't press Chrome's shortcuts: in their build only, they open the switcher as a shortcut does.
  if (import.meta.env.MODE === 'e2e') Object.assign(globalThis, { betterTabSwitcherTest: { showSwitcher } });
});
