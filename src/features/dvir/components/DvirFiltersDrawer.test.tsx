// web/tz.md §11.23 — DVIR filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_DVIR_FILTERS, type DvirFilters } from '../lib/filters';
import { DvirFiltersDrawer, DvirFilterChips } from './DvirFiltersDrawer';

function renderDrawer(filters: DvirFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(<DvirFiltersDrawer open onClose={onClose} filters={filters} onApply={onApply} />);
  return { onApply, onClose };
}

describe('DvirFiltersDrawer — 11.23', () => {
  it('opens showing every group', () => {
    renderDrawer(EMPTY_DVIR_FILTERS);
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Repair status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_DVIR_FILTERS);

    await user.click(screen.getByLabelText('Pre-trip'));
    await user.click(screen.getByLabelText('Critical'));
    await user.click(screen.getByLabelText('Pending'));

    expect(screen.getByRole('button', { name: /Apply 3 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply 3 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      type: ['PRE_TRIP'],
      severity: ['CRITICAL'],
      repairStatus: ['PENDING'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  // WB-150 — the drawer never passed `isDirty`, so Esc / X dropped a half-built filter set with
  // no confirm.
  it('closes untouched without a confirm, and confirms once the draft differs', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_DVIR_FILTERS);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();

    cleanup();
    const second = renderDrawer(EMPTY_DVIR_FILTERS);
    await user.click(screen.getByLabelText('Pre-trip'));
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(second.onClose).not.toHaveBeenCalled();
  });

  it('toggling a group back to the applied set is no longer dirty', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer({ ...EMPTY_DVIR_FILTERS, type: ['PRE_TRIP'] });

    await user.click(screen.getByLabelText('Post-trip'));
    await user.click(screen.getByLabelText('Post-trip'));
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_DVIR_FILTERS, type: ['PRE_TRIP'], severity: ['CRITICAL'] });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});

describe('DvirFilterChips — 11.23', () => {
  const filters: DvirFilters = {
    ...EMPTY_DVIR_FILTERS,
    type: ['PRE_TRIP'],
    repairStatus: ['PENDING'],
  };

  it('renders nothing when empty', () => {
    const { container } = render(<DvirFilterChips filters={EMPTY_DVIR_FILTERS} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip and Clear all resets everything', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<DvirFilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Type: Pre-trip/)).toBeInTheDocument();
    expect(screen.getByText(/Repair status: Pending/)).toBeInTheDocument();

    await user.click(screen.getByText(/Type: Pre-trip/));
    expect(onRemove).toHaveBeenCalledWith({ type: [] });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
