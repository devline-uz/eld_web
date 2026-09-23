import { DUTY_LABEL, type DutyStatus } from '@/shared/ui/Badge';
import { formatPercent } from '@/shared/format/numbers';

/** Accessible name of one Duty-donut legend row, e.g. `Driving: 12 units, 34%` (stage 3). */
export function dutyLegendLabel(status: DutyStatus, count: number, percent: number): string {
  return `${DUTY_LABEL[status]}: ${count} ${count === 1 ? 'unit' : 'units'}, ${formatPercent(percent)}`;
}
