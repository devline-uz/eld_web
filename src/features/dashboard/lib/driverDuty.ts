// owner: web-dashboard-fleet — QA LIVE-002 / CODE-020: one definition of "on duty" for the
// `Drivers on duty` KPI, the `Duty status · now` donut and its subtitle.
import type { DriverDutyStatus, LiveFleetUnit } from '@/shared/api/liveFleet';
import type { DutyStatus } from '@/shared/ui/Badge';

/** A donut slice: the driver's HOS duty status, or UNKNOWN when it could not be computed. */
export type DonutDutyStatus = DriverDutyStatus | 'UNKNOWN';

/** Legend / ring order. UNKNOWN is last and only drawn when non-zero. */
export const DONUT_SEGMENTS: DonutDutyStatus[] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY', 'UNKNOWN'];

/**
 * "On duty" exactly as the Drivers list counts it (`useDriverRosterCounts`: every driver whose
 * duty status is not OFF_DUTY), and as the backend's `counts.onDuty` does.
 */
export const ON_DUTY_SEGMENTS: readonly DonutDutyStatus[] = ['DRIVING', 'ON_DUTY', 'SLEEPER'];

/** Older API / fixtures without `driverDutyStatus`: derive it from the live marker. IDLE and
 * YARD_MOVE are on duty, PC is off duty; ELD_OFFLINE / INACTIVE hide the status -> unknown. */
const FROM_LIVE_STATUS: Record<DutyStatus, DonutDutyStatus> = {
  DRIVING: 'DRIVING',
  ON_DUTY: 'ON_DUTY',
  IDLE: 'ON_DUTY',
  YARD_MOVE: 'ON_DUTY',
  SLEEPER: 'SLEEPER',
  OFF_DUTY: 'OFF_DUTY',
  PERSONAL_CONVEYANCE: 'OFF_DUTY',
  ELD_OFFLINE: 'UNKNOWN',
  INACTIVE: 'UNKNOWN',
};

type DutyUnit = Pick<LiveFleetUnit, 'driverId' | 'dutyStatus' | 'driverDutyStatus'>;

/**
 * The assigned driver's duty status for the donut — their own HOS status (`driverDutyStatus`),
 * never the unit's live marker: an ELD-offline or out-of-service unit still has a driver who is
 * driving / on duty, and the Drivers list counts them so. `null` for a unit without a driver.
 */
export function driverDutyOf(unit: DutyUnit): DonutDutyStatus | null {
  if (!unit.driverId) return null;
  if (unit.driverDutyStatus !== undefined) return unit.driverDutyStatus ?? 'UNKNOWN';
  return FROM_LIVE_STATUS[unit.dutyStatus] ?? 'UNKNOWN';
}

export interface DriverDutySummary {
  /** Units with a driver signed in — every slice below sums to this. */
  assigned: number;
  onDuty: number;
  counts: Record<DonutDutyStatus, number>;
}

export function summarizeDriverDuty(units: DutyUnit[]): DriverDutySummary {
  const counts: Record<DonutDutyStatus, number> = { DRIVING: 0, ON_DUTY: 0, SLEEPER: 0, OFF_DUTY: 0, UNKNOWN: 0 };
  let assigned = 0;
  for (const unit of units) {
    const status = driverDutyOf(unit);
    if (status === null) continue;
    assigned += 1;
    counts[status] += 1;
  }
  const onDuty = ON_DUTY_SEGMENTS.reduce((sum, status) => sum + counts[status], 0);
  return { assigned, onDuty, counts };
}
