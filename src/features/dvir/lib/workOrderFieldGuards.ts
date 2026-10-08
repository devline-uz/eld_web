// owner: web-dvir-safety — shared field guards for the work-order modals (`CreateWorkOrderModal`,
// `EditWorkOrderModal`): `Parts cost`, `Odometer at service` and `Due date`. Neither value can be negative,
// and the odometer is a whole number of miles (`odometerMi` is `z.number().int().min(0)` on the
// server). The keys that would type a sign, an exponent or (odometer only) a decimal separator into
// a `type="number"` input are blocked, and anything pasted is sanitized before it reaches state.
import type { KeyboardEvent } from 'react';
import { isValid, parse } from 'date-fns';
import { formatLocal } from '@/shared/format/datetime';

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

/** `null` when empty or a valid non-negative amount, otherwise the inline error message. */
export function getCostError(value: string, label: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isNaN(n) || n < 0 ? `${label} cannot be negative.` : null;
}

/** `null` when empty or a valid non-negative whole number, otherwise the inline error message. */
export function getOdometerError(value: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 'Odometer at service cannot be negative.';
  if (!Number.isInteger(n)) return 'Odometer at service must be a whole number.';
  return null;
}

/** `null` when empty or not before `today` (both `yyyy-MM-dd`, so a string compare orders them),
 * otherwise the inline error message for the work-order `Due date` field. */
export function getDueDateError(value: string, today: string): string | null {
  if (value === '') return null;
  return value < today ? 'Due date cannot be in the past.' : null;
}

/**
 * `Due date` input (`yyyy-MM-dd`) → `dueAt` ISO instant. `new Date('yyyy-MM-dd')` reads a date-only
 * string as UTC midnight, which is the previous evening anywhere west of UTC, so the list showed
 * the day before the one picked. The instant is local midnight of the picked day instead — the
 * same browser zone `formatLocal` renders `dueAt` in.
 */
export function dueDateToIso(value: string): string | undefined {
  if (value === '') return undefined;
  const date = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(date) ? date.toISOString() : undefined;
}

/** `dueAt` ISO instant → `Due date` input value, as the browser-local calendar day. */
export function isoToDueDate(iso: string | null | undefined): string {
  return iso ? formatLocal(iso, 'yyyy-MM-dd') : '';
}
