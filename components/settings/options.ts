import { i18n } from '#i18n';
import type { ListWidth } from '../../lib/settings/settings';
import type { SelectOption } from '../ui/Select';

/** The list's widths, as the settings page and the switcher's Display menu offer them. */
export function listWidthOptions(): SelectOption<ListWidth>[] {
  return [
    { value: 'medium', label: i18n.t('Settings_ListWidthMedium') },
    { value: 'large', label: i18n.t('Settings_ListWidthLarge') },
  ];
}
