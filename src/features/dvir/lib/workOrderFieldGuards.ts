// owner: web-dvir-safety — shared field guards for the work-order modals (`CreateWorkOrderModal`,
// `EditWorkOrderModal`): `Parts cost`, `Odometer at service` and `Due date`. Neither value can be negative,
// and the odometer is a whole number of miles (`odometerMi` is `z.number().int().min(0)` on the
// server). The keys that would type a sign, an exponent or (odometer only) a decimal separator into
// a `type="number"` input are blocked, and anything pasted is sanitized before it reaches state.
import type { KeyboardEvent } from 'react';
import { dateOnlyKey, dateOnlyToInstant } from '@/shared/format/datetime';

const COST_BLOCKED_KEYS = new Set(['-', '+', 'e', 'E']);
const ODOMETER_BLOCKED_KEYS = new Set(['-', '+', 'e', 'E', '.', ',']);

export function blockCostKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (COST_BLOCKED_KEYS.has(e.key)) e.preventDefault();
}

export function blockOdometerKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (ODOMETER_BLOCKED_KEYS.has(e.key)) e.preventDefault();
}

/** Drops any minus sign, so a pasted negative becomes its absolute value. */
export function sanitizeCost(value: string): string {
  return value.replace(/-/g, '');
}

/** Drops any minus sign and everything from the first decimal separator on. */
export function sanitizeOdometer(value: string): string {
  return value.replace(/-/g, '').replace(/[.,].*$/, '');
}

// The server's `CreateWorkOrderDto` / `UpdateWorkOrderDto` limits (backend modules/service/dto/
// service.dto.ts). A value past one of them used to go out and come back as a 422 the form never
// showed, so `Create work order` looked like it did nothing.
export const WORK_ORDER_LIMITS = {
  costUsd: 1_000_000,
  /** Same 7-digit ceiling as every other odometer field (`logs.dto.ts`). */
  odometerMi: 9_999_999,
  estimatedLaborHours: 999,
  title: 200,
  vendor: 120,
  description: 2000,
} as const;

/** `null` when empty or a valid amount within `CreateWorkOrderDto.costUsd`, otherwise the inline error message. */
export function getCostError(value: string, label: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return `${label} cannot be negative.`;
  if (n > WORK_ORDER_LIMITS.costUsd) return `${label} cannot exceed ${WORK_ORDER_LIMITS.costUsd.toLocaleString('en-US')} USD.`;
  return null;
}

/** `null` when empty or a valid whole number within `CreateWorkOrderDto.odometerMi`, otherwise the inline error message. */
export function getOdometerError(value: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 'Odometer at service cannot be negative.';
  if (!Number.isInteger(n)) return 'Odometer at service must be a whole number.';
  if (n > WORK_ORDER_LIMITS.odometerMi) return `Odometer at service cannot exceed ${WORK_ORDER_LIMITS.odometerMi.toLocaleString('en-US')} mi.`;
  return null;
}

/** `null` when empty or 0–999 hours (`CreateWorkOrderDto.estimatedLaborHours`), otherwise the inline error message. */
export function getLaborHoursError(value: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 'Estimated labor cannot be negative.';
  if (n > WORK_ORDER_LIMITS.estimatedLaborHours) return `Estimated labor cannot exceed ${WORK_ORDER_LIMITS.estimatedLaborHours} hours.`;
  return null;
}

/** Backend issue path → the work-order modal field that shows it. */
export const WORK_ORDER_FIELD_LABELS: Record<string, string> = {
  vehicleId: 'Unit',
  title: 'Title',
  vendor: 'Assign to',
  priority: 'Priority',
  dueAt: 'Due date',
  costUsd: 'Estimated parts cost',
  odometerMi: 'Odometer at service',
  estimatedLaborHours: 'Estimated labor',
  description: 'Work to perform',
  defectIds: 'Defects to include',
};

/** `null` when empty or not before `today` (both `yyyy-MM-dd`, so a string compare orders them),
 * otherwise the inline error message for the work-order `Due date` field. */
export function getDueDateError(value: string, today: string): string | null {
  if (value === '') return null;
  return value < today ? 'Due date cannot be in the past.' : null;
}

/**
 * `Due date` input (`yyyy-MM-dd`) → `dueAt` ISO instant. `new Date('yyyy-MM-dd')` reads a date-only
 * string as UTC midnight, which is the previous evening anywhere west of UTC, so the list showed
 * the day before the one picked. CODE-038 — the instant is midnight of the picked day in the
 * carrier zone, the zone every DVIR & Maintenance list renders dates in (not the browser's).
 */
export function dueDateToIso(value: string, timeZone: string): string | undefined {
  return dateOnlyToInstant(value, timeZone);
}

/** `dueAt` ISO instant → `Due date` input value: the carrier-zone calendar day (CODE-038). */
export function isoToDueDate(iso: string | null | undefined, timeZone: string): string {
  return dateOnlyKey(iso, timeZone);
}
