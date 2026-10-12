// UI-003 / UI-004 — how a `/live/fleet` unit reads: record status wins the badge, the ELD link and
// staleness are the secondary line.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveUnitBadge, LiveUnitNote, liveUnitNote } from './LiveUnitStatus';

const NOW = Date.parse('2026-09-16T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const live = { connectivity: 'ONLINE' as const, isStale: false, staleSince: null, lastSeenAt: null };

describe('LiveUnitBadge', () => {
  it('an OUT_OF_SERVICE record reads "Out of service", not the server\'s INACTIVE duty', () => {
    render(<LiveUnitBadge unit={{ dutyStatus: 'INACTIVE', recordStatus: 'OUT_OF_SERVICE' }} />);
    expect(screen.getByText('Out of service')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('otherwise shows the duty status', () => {
    render(<LiveUnitBadge unit={{ dutyStatus: 'DRIVING', recordStatus: 'ACTIVE' }} />);
    expect(screen.getByText('Driving')).toBeInTheDocument();
  });
});

describe('liveUnitNote', () => {
  it('a live unit with an ELD has no note', () => {
    expect(liveUnitNote(live, NOW)).toBeNull();
  });

  it('a unit with no ELD paired says "No device"', () => {
    expect(liveUnitNote({ ...live, connectivity: 'NO_DEVICE' }, NOW)).toBe('No device');
  });

  it('a stale unit says how old its last update is, from staleSince', () => {
    const staleSince = new Date(NOW - 4 * DAY - 3_600_000).toISOString();
    expect(liveUnitNote({ ...live, connectivity: 'ELD_OFFLINE', isStale: true, staleSince }, NOW)).toBe('Last update 4 d ago');
  });

  it('falls back to lastSeenAt, then to a plain "No recent update"', () => {
    const lastSeenAt = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(liveUnitNote({ ...live, isStale: true, lastSeenAt }, NOW)).toBe('Last update 3 h ago');
    expect(liveUnitNote({ ...live, isStale: true }, NOW)).toBe('No recent update');
  });
});

describe('LiveUnitNote', () => {
  it('renders nothing for a live unit and the warning-toned note for a stale one', () => {
    const { container, rerender } = render(<LiveUnitNote unit={live} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LiveUnitNote unit={{ ...live, isStale: true, staleSince: new Date(Date.now() - 2 * DAY).toISOString() }} />);
    const note = screen.getByTestId('live-unit-note');
    expect(note).toHaveTextContent('Last update 2 d ago');
    expect(note).toHaveClass('text-warning');
  });
});
