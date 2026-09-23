// web/tz.md §11.23 — Settings · Users filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_USER_FILTERS, type UserFilters } from '../lib/filters';
import { UserFiltersDrawer, UserFilterChips } from './UserFiltersDrawer';

function renderDrawer(filters: UserFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(<UserFiltersDrawer open onClose={onClose} filters={filters} onApply={onApply} />);
  return { onApply, onClose };
}

describe('UserFiltersDrawer — 11.23', () => {
  it('opens showing every group', () => {
    renderDrawer(EMPTY_USER_FILTERS);
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_USER_FILTERS);

    await user.click(screen.getByLabelText('Admin'));
    await user.click(screen.getByLabelText('Active'));

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply 2 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      role: ['ADMIN'],
      status: ['ACTIVE'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_USER_FILTERS, role: ['ADMIN'], status: ['ACTIVE'] });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});

describe('UserFilterChips — 11.23', () => {
  const filters: UserFilters = {
    ...EMPTY_USER_FILTERS,
    role: ['ADMIN'],
    status: ['ACTIVE'],
  };

  it('renders nothing when empty', () => {
    const { container } = render(<UserFilterChips filters={EMPTY_USER_FILTERS} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip and Clear all resets everything', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<UserFilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Role: Admin/)).toBeInTheDocument();
    expect(screen.getByText(/Status: Active/)).toBeInTheDocument();

    await user.click(screen.getByText(/Role: Admin/));
    expect(onRemove).toHaveBeenCalledWith({ role: [] });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('UserFiltersDrawer — 11.30 dirty close', () => {
  it('closes without a confirm while the draft matches the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_USER_FILTERS);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms before dropping an edited draft, and keeps the edit on `Keep editing`', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_USER_FILTERS);
    await user.click(screen.getByLabelText('Admin'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Admin')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stops confirming once the draft is toggled back to the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_USER_FILTERS);
    await user.click(screen.getByLabelText('Admin'));
    await user.click(screen.getByLabelText('Admin'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
