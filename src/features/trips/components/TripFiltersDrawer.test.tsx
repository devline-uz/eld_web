// web/tz.md §11.23 — Trips filter drawer: group toggles, chips, Clear all, Apply payload.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_TRIP_FILTERS, type TripFilters } from '../lib/filters';
import { TripFiltersDrawer, TripFilterChips } from './TripFiltersDrawer';

const driverOptions = [{ id: 'drv_1', name: 'Ana Reyes' }];
const vehicleOptions = [{ id: 'veh_1', unitNumber: 'UNIT-101' }];
const terminalOptions = ['Columbus, OH'];

function renderDrawer(filters: TripFilters, onApply = vi.fn(), onClose = vi.fn()) {
  render(
    <TripFiltersDrawer
      open
      onClose={onClose}
      filters={filters}
      onApply={onApply}
      driverOptions={driverOptions}
      vehicleOptions={vehicleOptions}
      terminalOptions={terminalOptions}
    />,
  );
  return { onApply, onClose };
}

describe('TripFiltersDrawer — 11.23', () => {
  it('opens showing every group', () => {
    renderDrawer(EMPTY_TRIP_FILTERS);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Home terminal')).toBeInTheDocument();
    expect(screen.getByText('Depart')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('toggles every group and applies the accumulated draft', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderDrawer(EMPTY_TRIP_FILTERS);

    await user.click(screen.getByLabelText('On time'));
    await user.click(screen.getByLabelText('Ana Reyes'));
    await user.click(screen.getByLabelText('UNIT-101'));
    await user.selectOptions(screen.getByDisplayValue('All terminals'), 'Columbus, OH');
    await user.type(screen.getByLabelText('From'), '2026-09-01');
    await user.type(screen.getByLabelText('To'), '2026-09-10');
    await user.click(screen.getByLabelText('Only trips with no trailer assigned'));

    expect(screen.getByRole('button', { name: /Apply 6 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply 6 filters/ }));

    expect(onApply).toHaveBeenCalledWith({
      status: ['On time'],
      driverId: ['drv_1'],
      vehicleId: ['veh_1'],
      terminal: 'Columbus, OH',
      departFrom: '2026-09-01',
      departTo: '2026-09-10',
      noTrailerOnly: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Reset all clears the draft back to empty', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...EMPTY_TRIP_FILTERS, status: ['On time'], noTrailerOnly: true });

    expect(screen.getByRole('button', { name: /Apply 2 filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});

describe('TripFilterChips — 11.23', () => {
  const driverById = new Map([['drv_1', 'Ana Reyes']]);
  const vehicleById = new Map([['veh_1', 'UNIT-101']]);
  const filters: TripFilters = {
    ...EMPTY_TRIP_FILTERS,
    status: ['On time'],
    driverId: ['drv_1'],
    noTrailerOnly: true,
  };

  it('renders nothing when empty', () => {
    const { container } = render(
      <TripFilterChips filters={EMPTY_TRIP_FILTERS} driverById={driverById} vehicleById={vehicleById} onRemove={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('removes one chip and Clear all resets everything', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<TripFilterChips filters={filters} driverById={driverById} vehicleById={vehicleById} onRemove={onRemove} onClearAll={onClearAll} />);

    expect(screen.getByText(/Driver: Ana Reyes/)).toBeInTheDocument();
    expect(screen.getByText(/No trailer assigned/)).toBeInTheDocument();

    await user.click(screen.getByText(/Driver: Ana Reyes/));
    expect(onRemove).toHaveBeenCalledWith({ driverId: [] });

    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('TripFiltersDrawer — 11.30 dirty close', () => {
  it('closes without a confirm while the draft matches the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_TRIP_FILTERS);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms before dropping an edited draft, and keeps the edit on `Keep editing`', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_TRIP_FILTERS);
    await user.click(screen.getByLabelText('On time'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('On time')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stops confirming once the draft is toggled back to the applied filters', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(EMPTY_TRIP_FILTERS);
    await user.click(screen.getByLabelText('On time'));
    await user.click(screen.getByLabelText('On time'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
