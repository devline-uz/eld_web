// web/tz.md §11.23 — Safety filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_SAFETY_FILTERS, type SafetyFilters } from '../lib/filters';
import { SafetyFiltersDrawer, SafetyFilterChips } from './SafetyFiltersDrawer';

function renderDrawer(filters: SafetyFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(<SafetyFiltersDrawer open onClose={onClose} filters={filters} onApply={onApply} />);
  return { onApply, onClose };
}

describe('SafetyFiltersDrawer — 11.23', () => {
  it('opens showing every group', () => {
    renderDrawer(EMPTY_SAFETY_FILTERS);
    expect(screen.getByText('Event type')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Coaching status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_SAFETY_FILTERS);

    await user.click(screen.getByLabelText('Harsh braking'));
    await user.click(screen.getByLabelText('Critical'));
    await user.click(screen.getByLabelText('New'));

    expect(screen.getByRole('button', { name: /Apply 3 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply 3 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      type: ['HARSH_BRAKING'],
      severity: ['CRITICAL'],
      coachingStatus: ['NEW'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_SAFETY_FILTERS, type: ['HARSH_BRAKING'], severity: ['CRITICAL'] });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});

describe('SafetyFilterChips — 11.23', () => {
  const filters: SafetyFilters = {
    ...EMPTY_SAFETY_FILTERS,
    type: ['HARSH_BRAKING'],
    coachingStatus: ['NEW'],
  };

  it('renders nothing when empty', () => {
    const { container } = render(<SafetyFilterChips filters={EMPTY_SAFETY_FILTERS} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip and Clear all resets everything', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<SafetyFilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Event type: Harsh braking/)).toBeInTheDocument();
    expect(screen.getByText(/Coaching: New/)).toBeInTheDocument();

    await user.click(screen.getByText(/Event type: Harsh braking/));
    expect(onRemove).toHaveBeenCalledWith({ type: [] });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('SafetyFiltersDrawer — 11.30 dirty close', () => {
  it('closes without a confirm while the draft matches the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_SAFETY_FILTERS);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms before dropping an edited draft, and keeps the edit on `Keep editing`', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_SAFETY_FILTERS);
    await user.click(screen.getByLabelText('Harsh braking'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Harsh braking')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stops confirming once the draft is toggled back to the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_SAFETY_FILTERS);
    await user.click(screen.getByLabelText('Harsh braking'));
    await user.click(screen.getByLabelText('Harsh braking'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
