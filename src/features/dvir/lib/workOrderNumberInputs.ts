// owner: web-dvir-safety — shared input guards for the work-order `Parts cost` and `Odometer at
// service` fields (`CreateWorkOrderModal`, `EditWorkOrderModal`). Neither value can be negative,
// and the odometer is a whole number of miles (`odometerMi` is `z.number().int().min(0)` on the
// server). The keys that would type a sign, an exponent or (odometer only) a decimal separator into
// a `type="number"` input are blocked, and anything pasted is sanitized before it reaches state.
import type { KeyboardEvent } from 'react';

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
