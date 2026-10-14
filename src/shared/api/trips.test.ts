// QA LIVE-003 — the W-11 STATUS column: overdue active trips are `Late`, scheduled trips whose
// planned start passed are flagged, and the on-time KPI judges a delivery by its planned end.
import { describe, expect, it } from 'vitest';
import {
  canCancelTrip,
  canDeliverTrip,
  canStartTrip,
  computeDisplayStatus,
  deliveredOnTime,
  isRunningLate,
  isStartOverdue,
  tripRouteEnds,
  type TripRow,
  type TripStopRow,
} from './trips';

const NOW = Date.parse('2026-10-14T12:00:00.000Z');
const PAST = '2026-10-08T06:00:00.000Z';
const SOON = '2026-10-14T18:00:00.000Z';
const LATER = '2026-10-15T18:00:00.000Z';

type DisplayInput = Parameters<typeof computeDisplayStatus>[0];

function trip(overrides: Partial<DisplayInput> = {}): DisplayInput {
  return {
    status: 'IN_PROGRESS',
    onTime: null,
    etaAt: null,
    stops: [],
    plannedStartAt: '2026-10-06T06:00:00.000Z',
    plannedEndAt: SOON,
    ...overrides,
  };
}

const atPickup: TripStopRow = {
  id: 'stp_1',
  tripId: 'trp_1',
  sequence: 1,
  type: 'PICKUP',
  name: 'Columbus, OH',
  address: null,
  latitude: null,
  longitude: null,
  scheduledAt: null,
  arrivedAt: '2026-10-14T11:00:00.000Z',
  departedAt: null,
  status: 'ARRIVED',
  note: null,
};

describe('computeDisplayStatus — active trips (LIVE-003)', () => {
  it('an active trip before its planned end with no ETA is On time', () => {
    expect(computeDisplayStatus(trip(), NOW)).toBe('On time');
    expect(computeDisplayStatus(trip({ status: 'ASSIGNED' }), NOW)).toBe('On time');
  });

  it('an active trip past its planned end is Late (ASSIGNED and IN_PROGRESS alike)', () => {
    expect(computeDisplayStatus(trip({ plannedEndAt: PAST }), NOW)).toBe('Late');
    expect(computeDisplayStatus(trip({ status: 'ASSIGNED', plannedEndAt: PAST }), NOW)).toBe('Late');
  });

  it('an ETA beyond the planned end is Late even before the end passes', () => {
    expect(computeDisplayStatus(trip({ etaAt: LATER, plannedEndAt: SOON }), NOW)).toBe('Late');
    expect(computeDisplayStatus(trip({ etaAt: '2026-10-14T17:00:00.000Z', plannedEndAt: SOON }), NOW)).toBe('On time');
  });

  it('keeps the old rules: onTime: false or a passed ETA is Late', () => {
    expect(computeDisplayStatus(trip({ onTime: false }), NOW)).toBe('Late');
    expect(computeDisplayStatus(trip({ etaAt: '2026-10-14T11:00:00.000Z' }), NOW)).toBe('Late');
  });

  it('Loading at the pickup, unless the trip is already late', () => {
    expect(computeDisplayStatus(trip({ stops: [atPickup] }), NOW)).toBe('Loading');
    expect(computeDisplayStatus(trip({ stops: [atPickup], plannedEndAt: PAST }), NOW)).toBe('Late');
  });

  it('no planned end and no ETA stays On time (nothing says it is late)', () => {
    expect(computeDisplayStatus(trip({ plannedEndAt: null }), NOW)).toBe('On time');
  });

  it('terminal / scheduled statuses are never Late, whatever the dates', () => {
    expect(computeDisplayStatus(trip({ status: 'DELIVERED', plannedEndAt: PAST }), NOW)).toBe('Delivered');
    expect(computeDisplayStatus(trip({ status: 'CANCELLED', plannedEndAt: PAST }), NOW)).toBe('Cancelled');
    expect(computeDisplayStatus(trip({ status: 'PLANNED', plannedEndAt: PAST }), NOW)).toBe('Planned');
    expect(computeDisplayStatus(trip({ status: 'DRAFT', plannedEndAt: PAST }), NOW)).toBe('Draft');
    expect(isRunningLate({ status: 'PLANNED', onTime: false, etaAt: null, plannedEndAt: PAST }, NOW)).toBe(false);
  });

  it('an ASSIGNED trip with a future start is Upcoming', () => {
    expect(computeDisplayStatus(trip({ status: 'ASSIGNED', plannedStartAt: SOON, plannedEndAt: LATER }), NOW)).toBe('Upcoming');
  });
});

describe('isStartOverdue — scheduled trips (LIVE-003)', () => {
  it('flags a DRAFT or PLANNED trip whose planned start has passed', () => {
    expect(isStartOverdue({ status: 'PLANNED', plannedStartAt: PAST }, NOW)).toBe(true);
    expect(isStartOverdue({ status: 'DRAFT', plannedStartAt: PAST }, NOW)).toBe(true);
  });

  it('does not flag a future start, a missing start, or a dispatched / finished trip', () => {
    expect(isStartOverdue({ status: 'PLANNED', plannedStartAt: SOON }, NOW)).toBe(false);
    expect(isStartOverdue({ status: 'PLANNED', plannedStartAt: null }, NOW)).toBe(false);
    expect(isStartOverdue({ status: 'ASSIGNED', plannedStartAt: PAST }, NOW)).toBe(false);
    expect(isStartOverdue({ status: 'IN_PROGRESS', plannedStartAt: PAST }, NOW)).toBe(false);
    expect(isStartOverdue({ status: 'DELIVERED', plannedStartAt: PAST }, NOW)).toBe(false);
  });
});

describe('deliveredOnTime — on-time KPI (LIVE-003)', () => {
  const done = (o: Partial<Pick<TripRow, 'onTime' | 'completedAt' | 'plannedEndAt'>>) => ({
    onTime: null,
    completedAt: '2026-10-14T10:00:00.000Z',
    plannedEndAt: SOON,
    ...o,
  });

  it("uses the backend's onTime when set", () => {
    expect(deliveredOnTime(done({ onTime: false }))).toBe(false);
    expect(deliveredOnTime(done({ onTime: true, completedAt: LATER }))).toBe(true);
  });

  it('falls back to completedAt vs plannedEndAt', () => {
    expect(deliveredOnTime(done({}))).toBe(true);
    expect(deliveredOnTime(done({ completedAt: LATER }))).toBe(false);
  });

  it('counts a delivery with no dates to compare as on time', () => {
    expect(deliveredOnTime(done({ plannedEndAt: null }))).toBe(true);
    expect(deliveredOnTime(done({ completedAt: null }))).toBe(true);
  });
});

describe('tripRouteEnds — multi-pickup / multi-drop (CODE-051)', () => {
  const stop = (type: TripStopRow['type'], sequence: number) => ({ type, sequence, name: `${type}-${sequence}` });

  it('starts at the first pickup and ends at the LAST delivery, whatever the array order', () => {
    const ends = tripRouteEnds([stop('DELIVERY', 4), stop('PICKUP', 3), stop('DELIVERY', 2), stop('PICKUP', 1)]);
    expect(ends.pickup?.name).toBe('PICKUP-1');
    expect(ends.delivery?.name).toBe('DELIVERY-4');
  });

  it('is null-safe without a pickup or a delivery', () => {
    expect(tripRouteEnds([stop('FUEL', 1)])).toEqual({ pickup: null, delivery: null });
  });
});

describe('lifecycle actions offered on the board (LIVE-003)', () => {
  it('Start for ASSIGNED, Mark delivered for IN_PROGRESS, Cancel until the trip is finished', () => {
    expect(canStartTrip({ status: 'ASSIGNED' })).toBe(true);
    expect(canStartTrip({ status: 'PLANNED' })).toBe(false);
    expect(canDeliverTrip({ status: 'IN_PROGRESS' })).toBe(true);
    expect(canDeliverTrip({ status: 'ASSIGNED' })).toBe(false);
    expect(canCancelTrip({ status: 'IN_PROGRESS' })).toBe(true);
    expect(canCancelTrip({ status: 'DELIVERED' })).toBe(false);
    expect(canCancelTrip({ status: 'CANCELLED' })).toBe(false);
  });
});

