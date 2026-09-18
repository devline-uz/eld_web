// web/bugs.md WB-121 — column reorder needs a real "move down" control (not just "move up" on
// every row), and the edge buttons must disable correctly (first row can't move up, last can't
// move down).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableSettings, type TableColumnSetting } from './TableSettings';

function columns(): TableColumnSetting[] {
  return [
    { id: 'a', label: 'Alpha', visible: true },
    { id: 'b', label: 'Bravo', visible: true },
    { id: 'c', label: 'Charlie', visible: true },
  ];
}

async function openPopover() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Table settings' }));
  return user;
}

describe('TableSettings (WB-121)', () => {
  it('renders a move-down control for every row, not just move-up', async () => {
    render(<TableSettings columns={columns()} onApply={vi.fn()} onReset={vi.fn()} />);
    await openPopover();
    expect(screen.getByRole('button', { name: 'Move Alpha down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Bravo down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Charlie down' })).toBeInTheDocument();
  });

  it('disables move-up on the first row and move-down on the last row', async () => {
    render(<TableSettings columns={columns()} onApply={vi.fn()} onReset={vi.fn()} />);
    await openPopover();
    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Charlie down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Alpha down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Charlie up' })).toBeEnabled();
  });

  it('moves a column down and applies the new order', async () => {
    const onApply = vi.fn();
    render(<TableSettings columns={columns()} onApply={onApply} onReset={vi.fn()} />);
    const user = await openPopover();
    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith([
      { id: 'b', label: 'Bravo', visible: true },
      { id: 'a', label: 'Alpha', visible: true },
      { id: 'c', label: 'Charlie', visible: true },
    ]);
  });
});
