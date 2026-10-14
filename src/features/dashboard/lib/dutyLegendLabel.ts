import { DUTY_LABEL } from '@/shared/ui/Badge';
import { formatPercent } from '@/shared/format/numbers';
import type { DonutDutyStatus } from './driverDuty';

/** Legend text of a donut slice; UNKNOWN = a driver whose HOS status could not be computed. */
export const DONUT_LABEL: Record<DonutDutyStatus, string> = {
  DRIVING: DUTY_LABEL.DRIVING,
  ON_DUTY: DUTY_LABEL.ON_DUTY,
  SLEEPER: DUTY_LABEL.SLEEPER,
  OFF_DUTY: DUTY_LABEL.OFF_DUTY,
  UNKNOWN: 'Status unknown',
};

/** Accessible name of one Duty-donut legend row, e.g. `Driving: 12 drivers, 34%` (stage 3). The
 * slices count assigned drivers (QA LIVE-002), not units. */
export function dutyLegendLabel(status: DonutDutyStatus, count: number, percent: number): string {
  return `${DONUT_LABEL[status]}: ${count} ${count === 1 ? 'driver' : 'drivers'}, ${formatPercent(percent)}`;
}
