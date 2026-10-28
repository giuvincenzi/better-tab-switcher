import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabRow, type TabRowProps } from '../../components/switcher/TabRow';
import { defaultSettings } from '../../lib/settings/settings';
import type { SwitcherTab } from '../../lib/tabs/tabs';

const now = Date.UTC(2026, 9, 28, 12, 0, 0);

const tab: SwitcherTab = {
  id: 7,
  windowId: 1,
  title: 'Q4 planning',
  url: 'https://mail.workspace.example-international-holdings.com/inbox',
  pinned: false,
  audible: false,
  sleeping: false,
  incognito: false,
  lastAccessed: now - 15 * 60_000,
};

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});

function row(props: Partial<TabRowProps> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <TabRow
        tab={tab}
        title={{ before: tab.title, match: '', after: '' }}
        selected={false}
        compact={true}
        details={defaultSettings.details}
        now={now}
        language="en"
        onChoose={() => undefined}
        onClose={() => undefined}
        autoSelectRound={0}
        onAutoSelect={() => undefined}
        onHover={() => undefined}
        {...props}
      />
    ),
    host,
  );
  return host.querySelector('[role="option"]') as HTMLElement;
}

describe('TabRow', () => {
  it('shows the title and is named after it', () => {
    const element = row();
    expect(element.textContent).toContain('Q4 planning');
    expect(element.getAttribute('aria-label')).toBe('Q4 planning');
    expect(element.getAttribute('aria-selected')).toBe('false');
  });

  it('highlights the part that matches the search', () => {
    const element = row({ title: { before: 'Q4 ', match: 'plan', after: 'ning' } });
    expect(element.querySelector('mark')?.textContent).toBe('plan');
  });

  it('shows the icons of a pinned tab playing audio, by default', () => {
    const element = row({ tab: { ...tab, pinned: true, audible: true } });
    expect(element.getAttribute('aria-label')).toBe('Q4 planning, Pinned, Playing audio');
    expect(element.querySelector('[data-icon="pin"]')).not.toBeNull();
    expect(element.querySelector('[data-icon="audio"]')).not.toBeNull();
  });

  it('shows a sleeping tab with its icon, greyed', () => {
    const element = row({ tab: { ...tab, sleeping: true } });
    expect(element.querySelector('[data-icon="sleep"]')).not.toBeNull();
    expect(Number(getComputedStyle(element).opacity)).toBeLessThan(1);
  });

  it('hides the icons that are off in the settings', () => {
    const details = { ...defaultSettings.details, pinnedIcon: false, sleeping: false };
    const element = row({ tab: { ...tab, pinned: true, sleeping: true }, details });
    expect(element.querySelector('[data-icon="pin"]')).toBeNull();
    expect(element.querySelector('[data-icon="sleep"]')).toBeNull();
    expect(Number(getComputedStyle(element).opacity)).toBe(1);
  });

  it('shows its group color', () => {
    const element = row({ tab: { ...tab, groupColor: 'blue' } });
    const dot = element.querySelector('[style*="--bts-group-blue"]');
    expect(dot).not.toBeNull();
  });

  it('cuts a long address with an ellipsis, by default', () => {
    const element = row({ details: { ...defaultSettings.details, address: true } });
    const address = [...element.querySelectorAll('span')].find(
      (s) => s.childElementCount === 0 && s.textContent?.startsWith('mail.workspace'),
    );
    expect(address).toBeDefined();
    const box = address?.parentElement as HTMLElement;
    expect(getComputedStyle(box).textOverflow).toBe('ellipsis');
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
  });

  it('shows the window of a tab from another window', () => {
    const element = row({ tab: { ...tab, windowLabel: '2' } });
    expect(element.querySelector('[data-icon="window"]')?.parentElement?.textContent).toBe('2');
    expect(element.getAttribute('aria-label')).toBe('Q4 planning, Window 2');
  });

  it('says when it was last used, when that is on', () => {
    expect(row().textContent).not.toContain('ago');
    dispose?.();
    const element = row({ details: { ...defaultSettings.details, lastUsed: true } });
    expect(element.textContent).toContain('15 min. ago');
  });

  it('opens its tab on a click, and closes it with its close button without opening it', () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    const element = row({ onChoose, onClose });
    (element.querySelector('button[aria-label="Close tab"]') as HTMLElement).click();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
    element.click();
    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('runs the auto-select line on the selected tab and tells when it ends', async () => {
    const onAutoSelect = vi.fn();
    const element = row({ selected: true, autoSelectSeconds: 0.05, onAutoSelect });
    expect(element.getAttribute('aria-selected')).toBe('true');
    await vi.waitFor(() => expect(onAutoSelect).toHaveBeenCalledOnce());
  });

  it('closes the tab with a click of the middle button', () => {
    const onClose = vi.fn();
    const onChoose = vi.fn();
    row({ onClose, onChoose }).dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
