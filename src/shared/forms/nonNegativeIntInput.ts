// Input props for a whole-number field that can never hold a negative value (odometer and the
// like). `type="number"` alone still lets `-`, `+`, `e` and `.` be typed or pasted, and ArrowDown /
// the wheel can step below zero when no `min` is set. These handlers close every path; the zod rule
// in `fields.ts` (e.g. `odometer()`'s `.min(0)`) still decides whether the finished value is valid.
import type React from 'react';

/** Digits only — a pasted/dropped string is accepted only if every character is a digit. */
const DIGITS_ONLY = /^\d*$/;

/** Clamp any raw input string to a non-negative whole number string ('' stays ''). */
export function sanitizeNonNegativeInt(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0, Math.trunc(n)));
}

/** Rejects every printable non-digit key, and ArrowDown/PageDown once the value is at 0 (or blank). */
export function blockNonDigitKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/\d/.test(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    const n = Number(e.currentTarget.value);
    if (!Number.isFinite(n) || n - 1 < 0) e.preventDefault();
  }
}

export function blockNonDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  if (!DIGITS_ONLY.test(e.clipboardData.getData('text').trim())) e.preventDefault();
}

export function blockNonDigitDrop(e: React.DragEvent<HTMLInputElement>) {
  if (!DIGITS_ONLY.test(e.dataTransfer.getData('text').trim())) e.preventDefault();
}

/**
 * React registers wheel listeners as passive, so `preventDefault` cannot stop a wheel step on a
 * focused number input — dropping focus does, and the page scrolls as the user expects.
 */
export function blurOnWheel(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
}

/** Spread onto an `<input>` (before `register(...)` / your own `onChange`). */
export const nonNegativeIntInputProps = {
  type: 'number',
  min: 0,
  step: 1,
  inputMode: 'numeric',
  onKeyDown: blockNonDigitKey,
  onPaste: blockNonDigitPaste,
  onDrop: blockNonDigitDrop,
  onWheel: blurOnWheel,
} as const satisfies React.InputHTMLAttributes<HTMLInputElement>;
