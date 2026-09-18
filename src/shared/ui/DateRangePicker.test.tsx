// WB-120 — the calendar must be able to leave the month `value.from` sits in, in both
// directions, and both ends of a cross-month range must stay selectable.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateRangePicker, type DateRange, type DateRangePreset } from './DateRangePicker';

function Fixture({ initial, initialPreset = 'custom' }: { initial: DateRange; initialPreset?: DateRangePreset }) {
  const [value, setValue] = useState(initial);
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [lastChange, setLastChange] = useState<{ range: DateRange; preset: DateRangePreset } | null>(null);
  return (
    <div>
      <DateRangePicker
        value={value}
        preset={preset}
        onChange={(range, p) => {
          setValue(range);
          setPreset(p);
          setLastChange({ range, preset: p });
        }}
      />
      {lastChange && (
        <p data-testid="applied">
          {lastChange.range.from.toDateString()} – {lastChange.range.to.toDateString()}
        </p>
      )}
    </div>
  );
}

describe('<DateRangePicker> month navigation (WB-120)', () => {
  beforeEach(() => {
    // Mid-month "today" so both a previous and a next month are reachable and no day is future.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 5, 15)); // June 15, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates back and forward across a month boundary', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fixture initial={{ from: new Date(2026, 5, 1), to: new Date(2026, 5, 15) }} />);

    await user.click(screen.getByRole('button', { name: /Jun 01 – Jun 15, 2026/ }));
    expect(screen.getByText('June 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('May 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('April 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('selects a range that spans two months and reports both ends correctly', async () => {
    const user = userEvent.setup({ delay: null });
    // "Today" is June 15, 2026 — both May and June are reachable and not in the future. The
    // initial value is already a range (not a single day) so the first click below starts a
    // fresh selection instead of extending the incoming one.
    render(<Fixture initial={{ from: new Date(2026, 5, 1), to: new Date(2026, 5, 5) }} />);

    await user.click(screen.getByRole('button', { name: /Jun 01/ }));
    expect(screen.getByText('June 2026')).toBeInTheDocument();

    // Move back a month and pick the range start: May 20.
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '20' })[0]!);

    // Move forward a month without losing the in-progress start date, then pick the end.
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('June 2026')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '10' })[0]!);

    await user.click(screen.getByRole('button', { name: /Apply range/ }));

    const applied = await screen.findByTestId('applied');
    expect(applied.textContent).toBe(
      `${new Date(2026, 4, 20).toDateString()} – ${new Date(2026, 5, 10).toDateString()}`,
    );
  });

  it('re-anchors the visible month to the current value each time the popover re-opens', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fixture initial={{ from: new Date(2026, 5, 1), to: new Date(2026, 5, 1) }} />);

    const trigger = () => screen.getByRole('button', { name: /Jun 01/ });
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('April 2026')).toBeInTheDocument();

    // Cancel without applying, then re-open — the calendar must not still be stuck on April.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(trigger());
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('disables days after today (the enforced max bound) even after navigating months', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fixture initial={{ from: new Date(2026, 5, 1), to: new Date(2026, 5, 1) }} />);

    await user.click(screen.getByRole('button', { name: /Jun 01/ }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();

    // Every day in July 2026 is after "today" (June 15, 2026) and must be disabled.
    const julyTenth = screen.getAllByRole('button', { name: '10' })[0]!;
    expect(julyTenth).toBeDisabled();
  });
});
