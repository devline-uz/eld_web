// owner: web-settings-admin — the alert-rule event vocabulary, shared by the New/Edit rule modal
// (the `When` select) and the Alert rules list (the human sentence under each rule name).
import type { AlertRuleCondition } from '@/shared/api/settingsAdmin';

/** The event vocabulary the rule engine evaluates (`conditions[].event`). */
export const EVENT_OPTIONS: { value: string; label: string; minutesLabel?: string }[] = [
  { value: 'hos.break_due', label: '30-minute break is due', minutesLabel: 'within (minutes)' },
  { value: 'hos.violation', label: 'HOS violation recorded' },
  { value: 'device.offline', label: 'ELD stopped reporting', minutesLabel: 'for (minutes)' },
  {
    value: 'unidentified.created',
    label: 'Unassigned driving detected',
    minutesLabel: 'longer than (minutes)',
  },
  { value: 'maintenance.overdue', label: 'Maintenance is overdue' },
  { value: 'safety.harsh', label: 'Harsh driving event' },
  { value: 'geofence.exit', label: 'Unit left a geofence' },
];

export const EVENT_BY_VALUE = new Map(EVENT_OPTIONS.map((o) => [o.value, o]));

/**
 * `hos.break_due` + `{ minutes: 30 }` → "30-minute break is due within 30 minutes". The list used
 * to print the raw engine key (`hos.break_due`) where the design shows a sentence.
 */
export function describeCondition(condition: AlertRuleCondition): string {
  const option = EVENT_BY_VALUE.get(condition.event);
  if (!option) return condition.event;
  const minutes = condition.params?.minutes;
  if (!option.minutesLabel || typeof minutes !== 'number') return option.label;
  const preposition = option.minutesLabel.replace(' (minutes)', '');
  return `${option.label} ${preposition} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
