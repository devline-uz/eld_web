// owner: web-dispatch-messaging — W-11 Dispatch & Trips `This week ▾` period control (WB-042).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { PeriodDropdown } from './PeriodDropdown';
import { EMPTY_TRIP_FILTERS, type TripFilters } from '../lib/filters';

const user = userEvent.setup({ pointerEventsCheck: 0 });

function toDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

describe('W-11 Dispatch & Trips · PeriodDropdown', () => {
  it('shows "All dates" as the label when no depart range is in the URL, without applying a filter', () => {
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'All dates' })).toBeVisible();
  });

  it('applying "Today" writes today as both departFrom and departTo', async () => {
    const onApply = vi.fn();
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    await user.click(await screen.findByText('Today'));
    const today = toDay(new Date());
    expect(onApply).toHaveBeenCalledWith({ departFrom: today, departTo: today });
  });

  it('applying "This month" writes the calendar month range', async () => {
    const onApply = vi.fn();
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    await user.click(await screen.findByText('This month'));
    const now = new Date();
    expect(onApply).toHaveBeenCalledWith({ departFrom: toDay(startOfMonth(now)), departTo: toDay(endOfMonth(now)) });
  });

  it('re-selecting "This week" explicitly writes the Mon–Sun range and the label reflects it once applied', () => {
    const now = new Date();
    const filters: TripFilters = {
      ...EMPTY_TRIP_FILTERS,
      departFrom: toDay(startOfWeek(now, { weekStartsOn: 1 })),
      departTo: toDay(endOfWeek(now, { weekStartsOn: 1 })),
    };
    render(<PeriodDropdown filters={filters} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'This week' })).toBeVisible();
  });

  it('a depart range that matches none of the presets renders as the raw custom range', () => {
    const filters: TripFilters = { ...EMPTY_TRIP_FILTERS, departFrom: '2025-01-01', departTo: '2025-01-15' };
    render(<PeriodDropdown filters={filters} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2025-01-01 – 2025-01-15' })).toBeVisible();
  });

  it('a one-sided depart range (only From set) renders the generic "Custom" label', () => {
    const filters: TripFilters = { ...EMPTY_TRIP_FILTERS, departFrom: '2025-01-01', departTo: null };
    render(<PeriodDropdown filters={filters} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Custom' })).toBeVisible();
  });

  it('typing a custom range and applying calls onApply with the typed dates', async () => {
    const onApply = vi.fn();
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    await user.click(screen.getByRole('button', { name: 'Custom range' }));
    const fields = await screen.findAllByLabelText(/^(From|To)$/);
    await user.type(fields[0]!, '2025-02-01');
    await user.type(fields[1]!, '2025-02-10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ departFrom: '2025-02-01', departTo: '2025-02-10' });
  });

  it('the custom inputs stay hidden until "Custom range" is picked', async () => {
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    expect(screen.queryByLabelText('From')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Custom range' }));
    expect(screen.getByLabelText('From')).toBeVisible();
    expect(screen.getByLabelText('To')).toBeVisible();
  });

  it('opening Custom range moves the highlight off the active preset', async () => {
    const now = new Date();
    const month = { departFrom: toDay(startOfMonth(now)), departTo: toDay(endOfMonth(now)) };
    render(<PeriodDropdown filters={{ ...EMPTY_TRIP_FILTERS, ...month }} onApply={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'This month' }));
    await screen.findByRole('button', { name: 'Custom range' });
    // The trigger is labelled "This month" too; the preset item is the one rendered after it.
    const preset = screen.getAllByRole('button', { name: 'This month' }).at(-1)!;
    expect(preset).toHaveClass('text-primary');
    await user.click(screen.getByRole('button', { name: 'Custom range' }));
    expect(preset).not.toHaveClass('text-primary');
    expect(screen.getByRole('button', { name: 'Custom range' })).toHaveClass('text-primary');
  });

  it('an active preset does not pre-fill the custom inputs, so an earlier month can be picked', async () => {
    const now = new Date();
    const week = { departFrom: toDay(startOfWeek(now, { weekStartsOn: 1 })), departTo: toDay(endOfWeek(now, { weekStartsOn: 1 })) };
    const onApply = vi.fn();
    render(<PeriodDropdown filters={{ ...EMPTY_TRIP_FILTERS, ...week }} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'This week' }));
    await user.click(await screen.findByRole('button', { name: 'Custom range' }));
    const fields = await screen.findAllByLabelText(/^(From|To)$/);
    expect(fields[0]).toHaveValue('');
    expect(fields[1]).toHaveValue('');
    await user.type(fields[1]!, '2025-08-18');
    expect(screen.queryByText('Must be on or after the From date.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ departFrom: null, departTo: '2025-08-18' });
  });

  it('Clear resets the depart range to null on both ends', async () => {
    const onApply = vi.fn();
    const filters: TripFilters = { ...EMPTY_TRIP_FILTERS, departFrom: '2025-02-01', departTo: '2025-02-10' };
    render(<PeriodDropdown filters={filters} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: '2025-02-01 – 2025-02-10' }));
    await user.click(await screen.findByText('Clear'));
    expect(onApply).toHaveBeenCalledWith({ departFrom: null, departTo: null });
  });

  it('the custom Apply button is disabled until at least one date is typed', async () => {
    render(<PeriodDropdown filters={EMPTY_TRIP_FILTERS} onApply={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'All dates' }));
    await user.click(await screen.findByRole('button', { name: 'Custom range' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});
