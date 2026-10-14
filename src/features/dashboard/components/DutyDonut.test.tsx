// Stage 3 — each legend row carries a proper accessible name instead of `Driving1250%`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import DutyDonut from './DutyDonut';
import { donutArcs } from '../lib/donutArcs';
import { dutyLegendLabel } from '../lib/dutyLegendLabel';

let seq = 0;
/** One unit with a driver signed in, in the given HOS duty status. */
const unit = (driverDutyStatus: string | null, extra: Partial<LiveFleetUnit> = {}) =>
  ({ driverId: `drv_${++seq}`, dutyStatus: 'OFF_DUTY', driverDutyStatus, ...extra }) as unknown as LiveFleetUnit;

describe('DutyDonut legend', () => {
  it('names each row `<label>: <count> drivers, <percent>`', async () => {
    const onSegmentClick = vi.fn();
    render(
      <DutyDonut
        units={[unit('DRIVING'), unit('DRIVING'), unit('SLEEPER'), unit('OFF_DUTY')]}
        onSegmentClick={onSegmentClick}
      />,
    );
    const driving = screen.getByRole('button', { name: 'Driving: 2 drivers, 50%' });
    expect(screen.getByRole('button', { name: 'Sleeper: 1 driver, 25%' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'On-duty (not driving): 0 drivers, 0%' }),
    ).toBeInTheDocument();
    await userEvent.click(driving);
    expect(onSegmentClick).toHaveBeenCalledWith('DRIVING');
  });

  it('builds the label with singular/plural drivers', () => {
    expect(dutyLegendLabel('OFF_DUTY', 1, 10)).toBe('Off-duty: 1 driver, 10%');
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
    expect(arcs[0]!.querySelector('title')?.textContent).toBe('Driving: 2 drivers, 50%');
    expect(
      screen.getByRole('img', {
        name: 'Duty status now: Driving: 2 drivers, 50%; On-duty (not driving): 0 drivers, 0%; Sleeper: 1 driver, 25%; Off-duty: 1 driver, 25%',
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

// QA LIVE-002 — the donut counts assigned drivers by their own HOS status, like the Drivers list.
describe('DutyDonut — LIVE-002 driver duty', () => {
  it('counts an ELD-offline / out-of-service unit\'s driver by their HOS status, and the legend sums to the assigned drivers', () => {
    render(
      <DutyDonut
        units={[
          unit('DRIVING', { dutyStatus: 'ELD_OFFLINE', isStale: true }),
          unit('ON_DUTY', { dutyStatus: 'INACTIVE' }),
          unit('ON_DUTY', { dutyStatus: 'IDLE' }),
          unit('OFF_DUTY'),
          unit(null), // HOS state unavailable
          { driverId: null, dutyStatus: 'ELD_OFFLINE', driverDutyStatus: null } as unknown as LiveFleetUnit,
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Driving: 1 driver, 20%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On-duty (not driving): 2 drivers, 40%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Off-duty: 1 driver, 20%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status unknown: 1 driver, 20%' })).toBeInTheDocument();
    // Centre: Driving + On-duty + Sleeper, the Drivers list's "On duty".
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1 driver is not reporting live (ELD offline) — last known status shown')).toBeInTheDocument();
  });

  it('hides the Status unknown row when nobody is in it, and never navigates for it', async () => {
    const onSegmentClick = vi.fn();
    const { rerender } = render(<DutyDonut units={[unit('DRIVING')]} onSegmentClick={onSegmentClick} />);
    expect(screen.queryByRole('button', { name: /Status unknown/ })).not.toBeInTheDocument();
    rerender(<DutyDonut units={[unit('DRIVING'), unit(null)]} onSegmentClick={onSegmentClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Status unknown/ }));
    expect(onSegmentClick).not.toHaveBeenCalled();
  });
});
