// WB-257 — `UnitListRow` is memoized: a parent re-render with the same `unit`, `selected` and the
// stable `onSelect` renders no row again; only the row whose props changed re-renders.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';

const renders = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/shared/format/useRelativeTime', () => ({
  useRelativeTime: () => {
    renders.count += 1;
    return '1 min';
  },
}));

const { UnitListRow } = await import('./LiveFleetPage');

const unit = (vehicleId: string): LiveFleetUnit => ({
  vehicleId,
  unitNumber: vehicleId,
  driverId: null,
  driverName: null,
  driverPhone: null,
  dutyStatus: 'DRIVING',
  speedMph: 50,
  headingDeg: null,
  odometerMi: null,
  lat: 40,
  lon: -83,
  locationLabel: null,
  lastSeenAt: null,
  driveRemainingSec: null,
  shiftEndsAt: null,
  eldSerial: null,
  bleState: null,
});

const UNITS = [unit('#1'), unit('#2'), unit('#3')];

function List({ selectedId, onSelect, tick }: { selectedId: string | null; onSelect: (id: string) => void; tick: number }) {
  return (
    <ul data-tick={tick}>
      {UNITS.map((u) => (
        <li key={u.vehicleId}>
          <UnitListRow unit={u} selected={u.vehicleId === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

describe('UnitListRow (memo)', () => {
  it('skips unchanged rows on a parent re-render and re-renders only the rows whose selection flipped', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<List selectedId={null} onSelect={onSelect} tick={0} />);
    expect(renders.count).toBe(3);

    rerender(<List selectedId={null} onSelect={onSelect} tick={1} />);
    expect(renders.count).toBe(3);

    rerender(<List selectedId="#2" onSelect={onSelect} tick={2} />);
    expect(renders.count).toBe(4);

    await userEvent.click(screen.getByRole('button', { name: /Unit #3/ }));
    expect(onSelect).toHaveBeenCalledWith('#3');
  });
});
