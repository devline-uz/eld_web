// web/tz.md §11.23 — Drivers filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_DRIVER_FILTERS, type DriverFilters } from '../lib/filters';
import { DriverFiltersDrawer, DriverFilterChips } from './DriverFiltersDrawer';

function renderDrawer(filters: DriverFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(<DriverFiltersDrawer open onClose={onClose} filters={filters} onApply={onApply} terminalOptions={['Columbus, OH']} />);
  return { onApply, onClose };
}

describe('DriverFiltersDrawer — 11.23', () => {
  it('opens showing every group', () => {
    renderDrawer(EMPTY_DRIVER_FILTERS);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Home terminal')).toBeInTheDocument();
    expect(screen.getByText('Violations')).toBeInTheDocument();
    expect(screen.getByText('Exemptions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply 0 filters/ })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_DRIVER_FILTERS);

    await user.click(screen.getByLabelText('Driving'));
    await user.selectOptions(screen.getByDisplayValue('All terminals'), 'Columbus, OH');
    await user.click(screen.getByLabelText('Only drivers with open violations'));
    await user.click(screen.getByLabelText('ELD exempt'));

    expect(screen.getByRole('button', { name: /Apply 4 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply 4 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      status: ['DRIVING'],
      terminal: 'Columbus, OH',
      violationsOnly: true,
      exemptions: ['eldExempt'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_DRIVER_FILTERS, status: ['DRIVING'], violationsOnly: true });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: /Apply 0 filters/ })).toBeInTheDocument();
  });
});

describe('DriverFilterChips — 11.23', () => {
  const filters: DriverFilters = {
    ...EMPTY_DRIVER_FILTERS,
    status: ['DRIVING'],
    violationsOnly: true,
  };

  it('renders nothing when empty', () => {
    const { container } = render(<DriverFilterChips filters={EMPTY_DRIVER_FILTERS} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip and Clear all resets everything', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<DriverFilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Status: Driving/)).toBeInTheDocument();
    expect(screen.getByText(/Open violations only/)).toBeInTheDocument();

    await user.click(screen.getByText(/Open violations only/));
    expect(onRemove).toHaveBeenCalledWith({ violationsOnly: false });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
