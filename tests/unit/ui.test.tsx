import { createSignal, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { IconButton } from '../../components/ui/IconButton';
import { NumberField } from '../../components/ui/NumberField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Toggle } from '../../components/ui/Toggle';

// The extension's component library (components/ui), as the switcher and the settings page use it.

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
});

function show(ui: () => JSX.Element): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  dispose = render(
    () => (
      <>
        <span id="name">Delay</span>
        {ui()}
      </>
    ),
    host,
  );
  return host;
}

describe('IconButton', () => {
  it('is named by its label, and says it is on or off only when it turns something on and off', () => {
    const host = show(() => (
      <>
        <IconButton icon="settings" label="All settings" onClick={() => undefined} />
        <IconButton icon="compact" label="Compact" pressed={false} onClick={() => undefined} />
      </>
    ));
    const [settings, compact] = [...host.querySelectorAll('button')];
    expect(settings?.getAttribute('aria-label')).toBe('All settings');
    expect(settings?.hasAttribute('aria-pressed')).toBe(false);
    expect(compact?.getAttribute('aria-pressed')).toBe('false');
  });

  it('follows its pressed state and tells its clicks', () => {
    const [pressed, setPressed] = createSignal(false);
    const onClick = vi.fn(() => setPressed((on) => !on));
    const host = show(() => <IconButton icon="compact" label="Compact" pressed={pressed()} onClick={onClick} />);
    const button = host.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps its icon hidden from screen readers: the label names it', () => {
    const host = show(() => <IconButton icon="close" label="Close tab" onClick={() => undefined} />);
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SegmentedControl', () => {
  const views = [
    { value: 'list', label: 'List', icon: 'list' },
    { value: 'grid', label: 'Grid', icon: 'grid' },
  ] as const;

  function segmented(start: 'list' | 'grid' = 'list') {
    const [value, setValue] = createSignal<'list' | 'grid'>(start);
    const onChange = vi.fn((next: 'list' | 'grid') => setValue(next));
    const host = show(() => <SegmentedControl label="View" value={value()} options={views} onChange={onChange} />);
    const radio = (name: string) =>
      [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
        (input) => input.closest('label')?.textContent === name,
      ) as HTMLInputElement;
    return { host, onChange, radio, setValue };
  }

  it('is named, and names each option by its label though it shows an icon', () => {
    const { host, radio } = segmented();
    expect(host.querySelector('fieldset')?.getAttribute('aria-label')).toBe('View');
    expect(radio('List').checked).toBe(true);
    expect(radio('Grid').checked).toBe(false);
  });

  it('chooses an option with a click', () => {
    const { radio, onChange } = segmented();
    radio('Grid').click();
    expect(onChange).toHaveBeenCalledWith('grid');
    expect(radio('Grid').checked).toBe(true);
  });

  it('chooses another option with the arrows', async () => {
    const { radio, onChange } = segmented();
    radio('List').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('follows a value changed elsewhere', () => {
    const { radio, setValue } = segmented();
    setValue('grid');
    expect(radio('Grid').checked).toBe(true);
    expect(radio('List').checked).toBe(false);
  });

  it('keeps two controls apart: choosing in one leaves the other as it is', () => {
    const host = show(() => (
      <>
        <SegmentedControl label="View" value="list" options={views} onChange={() => undefined} />
        <SegmentedControl label="Other view" value="list" options={views} onChange={() => undefined} />
      </>
    ));
    const [first, , second] = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    (host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1] as HTMLInputElement).click();
    expect(first?.checked).toBe(false);
    expect(second?.checked).toBe(true);
  });
});

describe('Select', () => {
  const rows = [
    { value: '6', label: '6' },
    { value: '10', label: '10' },
    { value: 'fit', label: 'Fit the screen' },
  ] as const;

  it('shows the value, is named by its text, and tells the option chosen', () => {
    const onChange = vi.fn();
    const host = show(() => <Select labelledBy="name" value="10" options={rows} onChange={onChange} />);
    const select = host.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('10');
    expect(select.getAttribute('aria-labelledby')).toBe('name');
    select.value = 'fit';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('fit');
  });

  it('follows a value changed elsewhere', () => {
    const [value, setValue] = createSignal<'6' | '10' | 'fit'>('6');
    const host = show(() => <Select labelledBy="name" value={value()} options={rows} onChange={() => undefined} />);
    setValue('fit');
    expect((host.querySelector('select') as HTMLSelectElement).value).toBe('fit');
  });

  it('can be turned off', () => {
    const host = show(() => (
      <Select labelledBy="name" value="6" options={rows} disabled={true} onChange={() => undefined} />
    ));
    expect((host.querySelector('select') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('NumberField', () => {
  function field(value = 50, more: { unit?: string; disabled?: boolean } = {}) {
    const onChange = vi.fn();
    const host = show(() => (
      <NumberField value={value} min={0} max={1000} labelledBy="name" onChange={onChange} {...more} />
    ));
    const input = host.querySelector('input') as HTMLInputElement;
    const commit = (typed: string) => {
      input.value = typed;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    return { host, input, onChange, commit };
  }

  it('saves a whole number, rounded', () => {
    const { input, onChange, commit } = field();
    commit('120.6');
    expect(onChange).toHaveBeenCalledWith(121);
    expect(input.value).toBe('121');
  });

  it('brings a number below the minimum up to it', () => {
    const { input, onChange, commit } = field();
    commit('-20');
    expect(onChange).toHaveBeenCalledWith(0);
    expect(input.value).toBe('0');
  });

  it('puts back the value it had when the field is emptied', () => {
    const { input, onChange, commit } = field(50);
    commit('');
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('50');
  });

  it('saves nothing when the number is the same', () => {
    const { onChange, commit } = field(50);
    commit('50.2');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves what is typed when Enter is pressed', async () => {
    const { input, onChange } = field(50);
    await userEvent.clear(input);
    await userEvent.type(input, '300{Enter}');
    expect(onChange).toHaveBeenCalledWith(300);
  });

  it('shows its unit after the number, hidden from screen readers, and is named by its text', () => {
    const { host, input } = field(50, { unit: 'ms' });
    expect(input.getAttribute('aria-labelledby')).toBe('name');
    const unit = [...host.querySelectorAll('span')].find(
      (span) => span.childElementCount === 0 && span.textContent === 'ms',
    ) as HTMLElement;
    expect(unit.getAttribute('aria-hidden')).toBe('true');
    expect(unit.getBoundingClientRect().left).toBeGreaterThanOrEqual(input.getBoundingClientRect().left);
  });

  it('keeps the number left to right in a right-to-left page', () => {
    document.body.dir = 'rtl';
    try {
      const { input } = field(50, { unit: 'ms' });
      expect(getComputedStyle(input).direction).toBe('ltr');
    } finally {
      document.body.removeAttribute('dir');
    }
  });
});

describe('Toggle', () => {
  it('is a switch named by its text, saying whether it is on, and tells the new state on a click', () => {
    const [checked, setChecked] = createSignal(false);
    const onChange = vi.fn((on: boolean) => setChecked(on));
    const host = show(() => <Toggle labelledBy="name" checked={checked()} onChange={onChange} />);
    const toggle = host.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-labelledby')).toBe('name');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    expect(onChange).toHaveBeenCalledWith(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('does nothing while turned off', () => {
    const onChange = vi.fn();
    const host = show(() => <Toggle labelledBy="name" checked={false} disabled={true} onChange={onChange} />);
    (host.querySelector('[role="switch"]') as HTMLButtonElement).click();
    expect(onChange).not.toHaveBeenCalled();
  });
});
