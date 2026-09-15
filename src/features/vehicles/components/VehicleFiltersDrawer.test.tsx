// web/tz.md §11.23 — Vehicles filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_VEHICLE_FILTERS, type VehicleFilters } from '../lib/filters';
import { VehicleFiltersDrawer, VehicleFilterChips } from './VehicleFiltersDrawer';

function renderDrawer(filters: VehicleFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(
    <VehicleFiltersDrawer
      open
      onClose={onClose}
      filters={filters}
      onApply={onApply}
      eldDeviceOptions={['Samsara VG34']}
      makeOptions={['Freightliner', 'Peterbilt']}
      terminalOptions={['Columbus, OH']}
    />,
  );
  return { onApply, onClose };
}

describe('VehicleFiltersDrawer — 11.23', () => {
  it('opens showing the applied filter count and every group', () => {
    renderDrawer(EMPTY_VEHICLE_FILTERS);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('ELD device')).toBeInTheDocument();
    expect(screen.getByText('Make')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Home terminal')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply 0 filters/ })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_VEHICLE_FILTERS);

    await user.click(screen.getByLabelText('Driving'));
    await user.click(screen.getByLabelText('Idle'));
    await user.click(screen.getByLabelText('Samsara VG34'));
    await user.click(screen.getByLabelText('Not assigned'));
    await user.click(screen.getByLabelText('Freightliner'));
    await user.type(screen.getByLabelText('Year from'), '2020');
    await user.type(screen.getByLabelText('Year to'), '2024');
    await user.selectOptions(screen.getByDisplayValue('All terminals'), 'Columbus, OH');
    await user.click(screen.getByLabelText('Only units with open defects'));
    await user.click(screen.getByLabelText('Only units with firmware out of date'));

    expect(screen.getByRole('button', { name: /Apply 7 filters/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Apply 7 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      status: ['DRIVING', 'IDLE'],
      eldDevice: ['Samsara VG34', 'UNASSIGNED'],
      make: ['Freightliner'],
      yearFrom: 2020,
      yearTo: 2024,
      terminal: 'Columbus, OH',
      openDefectsOnly: true,
      firmwareOutdatedOnly: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_VEHICLE_FILTERS, status: ['DRIVING'], make: ['Freightliner'] });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: /Apply 0 filters/ })).toBeInTheDocument();
  });
});

describe('VehicleFilterChips — 11.23', () => {
  const filters: VehicleFilters = {
    ...EMPTY_VEHICLE_FILTERS,
    status: ['DRIVING'],
    make: ['Freightliner'],
    openDefectsOnly: true,
  };

  it('renders one chip per active group and nothing when empty', () => {
    const { container } = render(<VehicleFilterChips filters={EMPTY_VEHICLE_FILTERS} onRemove={vi.fn()} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip via onRemove and resets all via Clear all', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<VehicleFilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Status: Driving/)).toBeInTheDocument();
    expect(screen.getByText(/Make: Freightliner/)).toBeInTheDocument();
    expect(screen.getByText(/Open defects only/)).toBeInTheDocument();

    await user.click(screen.getByText(/Status: Driving/));
    expect(onRemove).toHaveBeenCalledWith({ status: [] });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
