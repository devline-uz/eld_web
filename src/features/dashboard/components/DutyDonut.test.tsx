// Stage 3 — each legend row carries a proper accessible name instead of `Driving1250%`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import DutyDonut from './DutyDonut';
import { donutArcs } from '../lib/donutArcs';
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

// WB-257 — the hand-written SVG ring that replaced Recharts.
describe('DutyDonut SVG ring', () => {
  it('draws one arc per non-zero status in the duty palette, labelled, and clickable', async () => {
    const onSegmentClick = vi.fn();
    const { container } = render(
      <DutyDonut
        units={[unit('DRIVING'), unit('DRIVING'), unit('SLEEPER'), unit('OFF_DUTY')]}
        onSegmentClick={onSegmentClick}
      />,
    );
    const arcs = screen.getAllByTestId('duty-donut-segment');
    expect(arcs.map((a) => a.getAttribute('data-status'))).toEqual(['DRIVING', 'SLEEPER', 'OFF_DUTY']);
    expect(arcs.map((a) => a.getAttribute('stroke'))).toEqual([
      'var(--color-success)',
      'var(--color-violet)',
      'var(--color-neutral)',
    ]);
    expect(arcs[0]!.querySelector('title')?.textContent).toBe('Driving: 2 units, 50%');
    expect(
      screen.getByRole('img', {
        name: 'Duty status now: Driving: 2 units, 50%; On-duty (not driving): 0 units, 0%; Sleeper: 1 unit, 25%; Off-duty: 1 unit, 25%',
      }),
    ).toBeInTheDocument();
    expect(container.textContent).toContain('on duty');
    await userEvent.click(arcs[1]!);
    expect(onSegmentClick).toHaveBeenCalledWith('SLEEPER');
  });

  it('donutArcs splits the ring by share with a gap, and a lone status is a full ring', () => {
    const arcs = donutArcs([
      { status: 'DRIVING', count: 1 },
      { status: 'ON_DUTY', count: 0 },
      { status: 'SLEEPER', count: 3 },
    ]);
    const ring = 2 * Math.PI * 68;
    expect(arcs).toHaveLength(2);
    expect(arcs[0]!.offset).toBe(0);
    expect(arcs[1]!.offset).toBeCloseTo(ring / 4);
    expect(arcs[0]!.length).toBeCloseTo(ring / 4 - ring / 360);
    expect(arcs[1]!.length).toBeCloseTo((3 * ring) / 4 - ring / 360);
    const lone = donutArcs([{ status: 'OFF_DUTY', count: 5 }]);
    expect(lone[0]!.length).toBeCloseTo(ring);
    expect(donutArcs([{ status: 'OFF_DUTY', count: 0 }])).toEqual([]);
  });

  it('shows the no-drivers text instead of an empty ring', () => {
    render(<DutyDonut units={[]} />);
    expect(screen.getByText('No drivers reporting')).toBeInTheDocument();
    expect(screen.queryByTestId('duty-donut-segment')).not.toBeInTheDocument();
  });
});
