// Stage 3 — each legend row carries a proper accessible name instead of `Driving1250%`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import DutyDonut from './DutyDonut';
import { dutyLegendLabel } from '../lib/dutyLegendLabel';

const unit = (dutyStatus: string) => ({ dutyStatus }) as unknown as LiveFleetUnit;

describe('DutyDonut legend', () => {
  it('names each row `<label>: <count> units, <percent>`', async () => {
    const onSegmentClick = vi.fn();
    render(
      <DutyDonut
        units={[unit('DRIVING'), unit('DRIVING'), unit('SLEEPER'), unit('OFF_DUTY')]}
        onSegmentClick={onSegmentClick}
      />,
    );
    const driving = screen.getByRole('button', { name: 'Driving: 2 units, 50%' });
    expect(screen.getByRole('button', { name: 'Sleeper: 1 unit, 25%' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'On-duty (not driving): 0 units, 0%' }),
    ).toBeInTheDocument();
    await userEvent.click(driving);
    expect(onSegmentClick).toHaveBeenCalledWith('DRIVING');
  });

  it('builds the label with singular/plural units', () => {
    expect(dutyLegendLabel('OFF_DUTY', 1, 10)).toBe('Off-duty: 1 unit, 10%');
  });
});
