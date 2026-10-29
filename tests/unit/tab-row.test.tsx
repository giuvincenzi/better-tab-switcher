import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addressOf } from '../../components/switcher/TabParts';
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
  it('shows the title and is named after it and its address, by default', () => {
    const element = row();
    expect(element.textContent).toContain('Q4 planning');
    expect(element.getAttribute('aria-label')).toBe(
      'Q4 planning, mail.workspace.example-international-holdings.com/inbox',
    );
    expect(element.getAttribute('aria-selected')).toBe('false');
  });

  it('highlights the part that matches the search', () => {
    const element = row({ title: { before: 'Q4 ', match: 'plan', after: 'ning' } });
    expect(element.querySelector('mark')?.textContent).toBe('plan');
  });

  it('shows the icons of a pinned tab playing audio, by default', () => {
    const element = row({ tab: { ...tab, pinned: true, audible: true } });
    expect(element.getAttribute('aria-label')).toBe(
      'Q4 planning, mail.workspace.example-international-holdings.com/inbox, Pinned, Playing audio',
    );
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

  it('cuts a long address with an ellipsis when long addresses are cut', () => {
    const element = row({ details: { ...defaultSettings.details, address: true, longAddress: 'cut' } });
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
    expect(element.getAttribute('aria-label')).toBe(
      'Q4 planning, mail.workspace.example-international-holdings.com/inbox, Window 2',
    );
  });

  it('says when it was last used, by default, and not when that is off', () => {
    expect(row().textContent).toContain('15 min. ago');
    dispose?.();
    const element = row({ details: { ...defaultSettings.details, lastUsed: false } });
    expect(element.textContent).not.toContain('ago');
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

  it('names the row with its whole website address, without https://, when Full address is on', () => {
    const element = row({ details: { ...defaultSettings.details, address: true, fullAddress: true } });
    expect(element.getAttribute('aria-label')).toBe(
      'Q4 planning, mail.workspace.example-international-holdings.com/inbox',
    );
    expect(element.textContent).toContain('mail.workspace.example-international-holdings.com/inbox');
    expect(element.textContent).not.toContain('https://');
  });

  it('names the row with only the site when Full address is off, and shows only the site', () => {
    const element = row({ details: { ...defaultSettings.details, address: true, fullAddress: false } });
    expect(element.getAttribute('aria-label')).toBe('Q4 planning, mail.workspace.example-international-holdings.com');
    expect(element.textContent).toContain('mail.workspace.example-international-holdings.com');
    expect(element.textContent).not.toContain('/inbox');
  });

  it('leaves out of the name and the row the details that are off', () => {
    const details = {
      ...defaultSettings.details,
      pinnedIcon: false,
      audioIcon: false,
      sleeping: false,
      groupColor: false,
      address: false,
      lastUsed: false,
    };
    const element = row({ tab: { ...tab, pinned: true, audible: true, sleeping: true, groupColor: 'blue' }, details });
    expect(element.getAttribute('aria-label')).toBe('Q4 planning');
    expect(element.textContent).not.toContain('mail.workspace');
    expect(element.textContent).not.toContain('ago');
    expect(element.querySelector('[data-icon="audio"]')).toBeNull();
    expect(element.querySelector('[style*="--bts-group-"]')).toBeNull();
  });

  it('shows the window of a tab from another window whatever the details', () => {
    const details = {
      ...defaultSettings.details,
      address: false,
      pinnedIcon: false,
      audioIcon: false,
      sleeping: false,
    };
    const element = row({ tab: { ...tab, windowLabel: '3' }, details });
    expect(element.getAttribute('aria-label')).toBe('Q4 planning, Window 3');
  });
});

describe('TabRow address', () => {
  const scrolling = { ...defaultSettings.details, address: true, longAddress: 'scroll' as const };

  /** The address text and the place it has in the row. */
  function address(element: HTMLElement) {
    const text = [...element.querySelectorAll('span')].find(
      (span) => span.childElementCount === 0 && span.textContent?.includes('example'),
    ) as HTMLElement;
    return { text, place: text.parentElement as HTMLElement };
  }

  /** A row in a narrow place, so its address is longer than the room it has. */
  function narrowRow(props: Parameters<typeof row>[0]) {
    const element = row(props);
    (element.parentElement as HTMLElement).style.width = '320px';
    return element;
  }

  it('scrolls a long address on the selected tab, as far as it is longer than its place and no further', () => {
    const { text, place } = address(narrowRow({ selected: true, compact: false, details: scrolling }));
    expect(text.getBoundingClientRect().width).toBeGreaterThan(place.getBoundingClientRect().width);
    const [animation] = text.getAnimations();
    expect(animation).toBeDefined();
    (animation as Animation).pause();
    // The end of the first pass, after the second it waits (TabParts.module.css): the address's end at its place's end.
    (animation as Animation).currentTime = 1000 + 2250 - 1;
    expect(text.getBoundingClientRect().right).toBeCloseTo(place.getBoundingClientRect().right, 0);
  });

  it('scrolls only the selected tab', () => {
    const { text } = address(narrowRow({ selected: false, compact: false, details: scrolling }));
    expect(text.getAnimations()).toEqual([]);
  });

  it('never scrolls when long addresses are cut', () => {
    const details = { ...scrolling, longAddress: 'cut' as const };
    const { text } = address(narrowRow({ selected: true, compact: false, details }));
    expect(text.getAnimations()).toEqual([]);
  });

  it('never moves a short address that fits its place, even scrolling', () => {
    const short = { ...tab, url: 'https://example.com/' };
    const { text, place } = address(row({ tab: short, selected: true, compact: false, details: scrolling }));
    const start = text.getBoundingClientRect().left;
    for (const animation of text.getAnimations()) {
      animation.pause();
      animation.currentTime = 1000 + 2250 - 1;
    }
    expect(text.getBoundingClientRect().left).toBe(start);
    expect(text.getBoundingClientRect().left).toBeCloseTo(place.getBoundingClientRect().left, 0);
  });

  it('puts the address beside the title in the compact list, and under it in the other', () => {
    const details = { ...defaultSettings.details, address: true };
    const title = (element: HTMLElement) =>
      (
        [...element.querySelectorAll('span')].find((span) => span.textContent === 'Q4 planning') as HTMLElement
      ).getBoundingClientRect();
    const compact = row({ compact: true, details });
    const beside = address(compact).text.getBoundingClientRect();
    expect(beside.left).toBeGreaterThan(title(compact).right);
    dispose?.();
    const full = row({ compact: false, details });
    const under = address(full).text.getBoundingClientRect();
    expect(under.top).toBeGreaterThanOrEqual(title(full).bottom - 1);
  });
});

describe('addressOf', () => {
  it('gives the whole address without http:// or https:// with Full address on', () => {
    expect(addressOf('https://github.com/a/b', true)).toBe('github.com/a/b');
    expect(addressOf('http://bts.test/beta?q=1#top', true)).toBe('bts.test/beta?q=1#top');
  });

  it('gives only the site with Full address off', () => {
    expect(addressOf('https://github.com/a/b', false)).toBe('github.com');
    expect(addressOf('http://localhost:8080/page', false)).toBe('localhost:8080');
  });

  it('keeps an address with no site whole, Full address on or off', () => {
    for (const full of [true, false]) {
      expect(addressOf('file:///home/me/notes.txt', full)).toBe('file:///home/me/notes.txt');
      expect(addressOf('about:blank', full)).toBe('about:blank');
    }
  });

  it('keeps the scheme of an address that is not a web page, with Full address on', () => {
    expect(addressOf('chrome://settings/', true)).toBe('chrome://settings/');
  });

  it('gives the address as it is when it cannot be read', () => {
    expect(addressOf('not an address', true)).toBe('not an address');
    expect(addressOf('not an address', false)).toBe('not an address');
  });
});
