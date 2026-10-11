// QA: a day of 24:00 driving past limits crossed the day before read "No violations today".
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HosViolation, OngoingViolation } from '@/shared/api/hosLogs';
import { ViolationsCard } from './ViolationsCard';

vi.mock('@/shared/auth/Can', () => ({ Can: () => null }));

const ongoing: OngoingViolation[] = [
  {
    type: 'DRIVING_11',
    inForceSince: '2026-10-10T04:00:00.000Z',
    crossedAt: '2026-10-08T18:44:00.000Z',
    detail: 'Still driving past the 11-hour driving limit at the start of the day, with no 10-hour break',
  },
];

const filed: HosViolation = {
  id: 'vio-1',
  driverId: 'drv-1',
  dailyLogId: null,
  logDate: '2026-10-10',
  type: 'CYCLE_70',
  occurredAt: '2026-10-10T07:34:00.000Z',
  exceededBySec: 3600,
  detail: 'Drove with 71h on duty',
  status: 'OPEN',
  resolvedAt: null,
  resolvedById: null,
  resolutionNote: null,
};

function renderCard(violations: HosViolation[], continuing: OngoingViolation[]) {
  return render(
    <ViolationsCard driverId="drv-1" date="2026-10-10" timezone="America/New_York" violations={violations} ongoing={continuing} />,
  );
}

describe('ViolationsCard — violations continuing from an earlier day', () => {
  it('lists a continuing violation instead of "No violations today"', () => {
    renderCard([], ongoing);
    expect(screen.queryByText('● No violations today')).not.toBeInTheDocument();
    expect(screen.getByText('11-hour driving limit')).toBeInTheDocument();
    expect(screen.getByText('Continuing')).toBeInTheDocument();
    expect(screen.getByText('In violation from 00:00 · limit crossed Oct 8, 14:44')).toBeInTheDocument();
    // Never counted as a new open row: it is the row filed on the day of the crossing.
    expect(screen.getByText('0 open · 1 continuing from an earlier day')).toBeInTheDocument();
  });

  it('shows filed and continuing violations together', () => {
    renderCard([filed], ongoing);
    expect(screen.getByText('1 open · 1 continuing from an earlier day')).toBeInTheDocument();
    expect(screen.getByText('70-hour cycle limit')).toBeInTheDocument();
  });

  it('still says "No violations today" on a clean day', () => {
    renderCard([], []);
    expect(screen.getByText('● No violations today')).toBeInTheDocument();
    expect(screen.getByText('0 open')).toBeInTheDocument();
  });
});
