import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SELECT_MAX_VISIBLE_ITEMS,
  SELECT_ROW_PX,
  selectMenuMaxHeight,
  type SelectOption,
} from './Select';

const OPTIONS: SelectOption[] = Array.from({ length: 40 }, (_, i) => ({
  value: `v${i}`,
  label: `Item ${i}`,
}));

function Harness({ invalid = false }: { invalid?: boolean }) {
  const [value, setValue] = useState('v0');
  return (
    <Select
      aria-label="Pick"
      value={value}
      options={OPTIONS}
      onChange={setValue}
      invalid={invalid}
    />
  );
}

describe('Select', () => {
  it('opens a capped, scrolling listbox and keeps the highlighted option in view', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Pick' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = await screen.findByRole('listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(listbox).toHaveClass('overflow-y-auto');
    // 10 rows of 32px, the other 30 options are reached by scrolling.
    expect(listbox.style.maxHeight).toBe('320px');
    scrollIntoView.mockClear();
    await user.keyboard('{End}');
    const last = within(listbox).getByRole('option', { name: 'Item 39' });
    expect(listbox).toHaveAttribute('aria-activedescendant', last.id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    await user.keyboard('{Home}{Enter}');
    expect(trigger).toHaveTextContent('Item 0');
    expect(trigger).toHaveFocus();
  });

  it('caps the menu at exactly 10 rows by default, and at maxVisibleItems when given', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Pick' }));
    let listbox = await screen.findByRole('listbox');
    expect(selectMenuMaxHeight()).toBe(`${SELECT_MAX_VISIBLE_ITEMS * SELECT_ROW_PX}px`);
    expect(SELECT_MAX_VISIBLE_ITEMS).toBe(10);
    expect(listbox.style.maxHeight).toBe(selectMenuMaxHeight(10));
    for (const option of within(listbox).getAllByRole('option')) expect(option).toHaveClass('h-8');
    unmount();

    render(<Select aria-label="Few" value="v0" options={OPTIONS} onChange={() => {}} maxVisibleItems={5} />);
    await user.click(screen.getByRole('combobox', { name: 'Few' }));
    listbox = await screen.findByRole('listbox');
    expect(listbox.style.maxHeight).toBe('160px');
  });

  it('marks the trigger invalid', () => {
    render(<Harness invalid />);
    expect(screen.getByRole('combobox', { name: 'Pick' })).toHaveAttribute('aria-invalid', 'true');
  });
});
