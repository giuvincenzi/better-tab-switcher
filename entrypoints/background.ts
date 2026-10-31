import { browser, defineBackground } from '#imports';
import { listenToSwitcher, requestSwitcher, type SwitcherRequest, showPreview } from '../lib/presenter/presenter';
import { keepPreviews } from '../lib/previews/service';
import { listenToSettingsChanges } from '../lib/settings/service';
import { askForMissingShortcuts } from '../lib/shortcuts';

export default defineBackground(() => {
  const previews = keepPreviews((tabId, picture) => void showPreview(tabId, picture));
  const request = (switcher: SwitcherRequest) => requestSwitcher(switcher, previews);
  browser.commands.onCommand.addListener((command) => {
    if (command === 'next-tab') void request({ direction: 'next', from: 'shortcut' });
    else if (command === 'previous-tab') void request({ direction: 'previous', from: 'shortcut' });
  });
  browser.action.onClicked.addListener(() => void request({ direction: 'next', from: 'icon' }));
  listenToSwitcher(request);
  listenToSettingsChanges();
  // Installed while another extension had its keys: the user chooses others at once.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void askForMissingShortcuts();
  });

  // The end-to-end tests can't press Chrome's shortcuts nor click the toolbar icon: in their build only, they ask for
  // the switcher as those do.
  if (import.meta.env.MODE === 'e2e')
    Object.assign(globalThis, { betterTabSwitcherTest: { requestSwitcher: request } });
});
