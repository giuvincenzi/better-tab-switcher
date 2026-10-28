import { i18n } from '#i18n';
import type { Width } from '../../lib/settings/settings';
import type { SegmentOption } from '../ui/SegmentedControl';

/**
 * The switcher's widths, as the settings page and the switcher's toolbar offer them: in the toolbar (`short`), each one
 * as a letter, its name still read by screen readers.
 */
export function widthOptions(short = false): SegmentOption<Width>[] {
  return [
    {
      value: 'small',
      label: i18n.t('Settings_WidthSmall'),
      short: short ? i18n.t('Switcher_WidthSmallShort') : undefined,
    },
    {
      value: 'medium',
      label: i18n.t('Settings_WidthMedium'),
      short: short ? i18n.t('Switcher_WidthMediumShort') : undefined,
    },
    {
      value: 'large',
      label: i18n.t('Settings_WidthLarge'),
      short: short ? i18n.t('Switcher_WidthLargeShort') : undefined,
    },
  ];
}
