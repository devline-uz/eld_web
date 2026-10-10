import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectMenu } from './SelectMenu';

const OPTIONS = [
  { value: 'all', label: 'All jurisdictions' },
  ...Array.from({ length: 30 }, (_, i) => ({ value: `j${i}`, label: `Jurisdiction ${i}` })),
];

describe('SelectMenu', () => {
  it('shows exactly 10 rows and scrolls the rest', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SelectMenu name="Jurisdiction" value="all" options={OPTIONS} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Jurisdiction: All jurisdictions' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveClass('overflow-y-auto');
    // 10 × 32px rows + 8px (p-1) padding, never taller than the space Radix measured.
    expect(menu.style.maxHeight).toBe('min(328px, var(--radix-dropdown-menu-content-available-height))');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(31);
    await user.click(within(menu).getByRole('menuitem', { name: 'Jurisdiction 29' }));
    expect(onSelect).toHaveBeenCalledWith('j29');
  });

  it('honours maxVisibleItems', async () => {
    const user = userEvent.setup();
    render(<SelectMenu name="Unit" value="all" options={OPTIONS} maxVisibleItems={4} onSelect={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^Unit:/ }));
    expect((await screen.findByRole('menu')).style.maxHeight).toBe(
      'min(136px, var(--radix-dropdown-menu-content-available-height))',
    );
  });
});
