// 11.8 Add driver / W-07 Edit driver — driver licence number rules. There is no standard library
// for US licence formats, so the per-state patterns below are a compact, maintainable map of the
// published AAMVA-style formats (digits `\d`, letters `[A-Z]`). The number is compared with its
// hyphens removed; a state missing from the map falls back to the generic rule only.
import type { FieldErrors, FieldValues, Resolver, ResolverResult } from 'react-hook-form';
import { z } from 'zod';
import { LIMITS, VALIDATION_MESSAGES as M } from './messages';

const CHARSET_RE = /^[A-Z0-9-]+$/;

export const LICENCE_FORMATS: Readonly<Record<string, RegExp>> = {
  AL: /^\d{1,8}$/,
  AK: /^\d{1,7}$/,
  AZ: /^([A-Z]\d{8}|[A-Z]{2}\d{2,5}|\d{9})$/,
  AR: /^\d{4,9}$/,
  CA: /^[A-Z]\d{7}$/,
  CO: /^(\d{9}|[A-Z]\d{3,6}|[A-Z]{2}\d{2,5})$/,
  CT: /^\d{9}$/,
  DE: /^\d{1,7}$/,
  DC: /^(\d{7}|\d{9})$/,
  FL: /^[A-Z]\d{12}$/,
  GA: /^\d{7,9}$/,
  HI: /^([A-Z]\d{8}|\d{9})$/,
  ID: /^([A-Z]{2}\d{6}[A-Z]|\d{9})$/,
  IL: /^[A-Z]\d{11,12}$/,
  IN: /^([A-Z]\d{9}|\d{9,10})$/,
  IA: /^(\d{9}|\d{3}[A-Z]{2}\d{4})$/,
  KS: /^([A-Z]\d[A-Z]\d[A-Z]|[A-Z]\d{8}|\d{9})$/,
  KY: /^([A-Z]\d{8,9}|\d{9})$/,
  LA: /^\d{1,9}$/,
  ME: /^(\d{7,8}|\d{7}[A-Z])$/,
  MD: /^[A-Z]\d{12}$/,
  MA: /^([A-Z]\d{8}|[A-Z]{2}\d{7}|\d{9})$/,
  MI: /^([A-Z]\d{10}|[A-Z]\d{12})$/,
  MN: /^[A-Z]\d{12}$/,
  MS: /^\d{9}$/,
  MO: /^([A-Z]\d{5,9}|[A-Z]\d{6}R|\d{8}[A-Z]{2}|\d{9}[A-Z]?)$/,
  MT: /^([A-Z]\d{8}|\d{9}|\d{13,14})$/,
  NE: /^[A-Z]\d{6,8}$/,
  NV: /^(\d{9,10}|\d{12}|X\d{8})$/,
  NH: /^(\d{2}[A-Z]{3}\d{5}|NHL\d{8})$/,
  NJ: /^[A-Z]\d{14}$/,
  NM: /^\d{8,9}$/,
  NY: /^([A-Z]\d{7}|[A-Z]\d{18}|\d{8,9}|\d{16}|[A-Z]{8})$/,
  NC: /^\d{1,12}$/,
  ND: /^([A-Z]{3}\d{6}|\d{9})$/,
  OH: /^([A-Z]\d{4,8}|[A-Z]{2}\d{3,7}|\d{8})$/,
  OK: /^([A-Z]\d{9}|\d{9})$/,
  OR: /^(\d{1,9}|[A-Z]\d{6}|[A-Z]{2}\d{5})$/,
  PA: /^\d{8}$/,
  RI: /^(\d{7}|[A-Z]\d{6})$/,
  SC: /^\d{5,11}$/,
  SD: /^(\d{6,10}|\d{12})$/,
  TN: /^\d{7,9}$/,
  TX: /^\d{7,8}$/,
  UT: /^\d{4,10}$/,
  VT: /^(\d{8}|\d{7}A)$/,
  VA: /^([A-Z]\d{8,11}|\d{9})$/,
  WA: /^[A-Z0-9]{12}$/,
  WV: /^(\d{7}|[A-Z]{1,2}\d{5,6})$/,
  WI: /^[A-Z]\d{13}$/,
  WY: /^\d{9,10}$/,
};

/** Trimmed and upper-cased — `w1234567 ` is `W1234567`. */
export function normalizeLicenceNumber(value: string): string {
  return value.trim().toUpperCase();
}

export type LicenceProblem = 'required' | 'charset' | 'length' | 'stateFormat';

/**
 * Why `value` is not an acceptable licence number (`null` when it is). `state` is the issuing
 * state; omitted or unknown, only the generic rule (charset + length) applies.
 */
export function licenceProblem(value: string, state?: string): LicenceProblem | null {
  const number = normalizeLicenceNumber(value);
  if (!number) return 'required';
  if (!CHARSET_RE.test(number)) return 'charset';
  if (number.length < LIMITS.cdlNumberMin || number.length > LIMITS.cdlNumberMax) return 'length';
  const format = state ? LICENCE_FORMATS[state.trim().toUpperCase()] : undefined;
  if (format && !format.test(number.replace(/-/g, ''))) return 'stateFormat';
  return null;
}

export function licenceMessage(problem: LicenceProblem, state?: string): string {
  switch (problem) {
    case 'required':
      return M.cdlNumber;
    case 'charset':
      return M.cdlNumberCharset;
    case 'length':
      return M.cdlNumberLength;
    case 'stateFormat':
      return M.cdlNumberStateFormat.replace('{state}', state ?? '');
  }
}

/** The licence number on its own: required, trimmed, upper-cased, charset and length. */
export const licenceNumber = () =>
  z
    .string({ required_error: M.cdlNumber })
    .transform(normalizeLicenceNumber)
    .superRefine((value, ctx) => {
      const problem = licenceProblem(value);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: licenceMessage(problem) });
    });

/**
 * Cross-field check for a form that has both `cdlNumber` and `cdlState`: the number must match its
 * issuing state's format. Reported on `cdlNumber`.
 */
export function refineLicenceForState(
  values: { cdlNumber: string; cdlState: string },
  ctx: z.RefinementCtx,
): void {
  if (licenceProblem(values.cdlNumber, values.cdlState) === 'stateFormat') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cdlNumber'],
      message: licenceMessage('stateFormat', values.cdlState),
    });
  }
}

/**
 * Wraps a form resolver so the issuing-state format is checked on blur too. A zod object-level
 * refinement only runs once every other field is valid, so on its own the state-format error
 * would appear only after the rest of the form was filled in. `skip` lets the Edit form leave an
 * unchanged stored number alone (it was accepted before these rules existed).
 */
export function withLicenceStateCheck<T extends FieldValues>(
  resolver: Resolver<T>,
  skip?: (values: T) => boolean,
): Resolver<T> {
  return async (values, context, options) => {
    const result = await resolver(values, context, options);
    const { cdlNumber, cdlState } = values as { cdlNumber?: unknown; cdlState?: unknown };
    if (typeof cdlNumber !== 'string' || typeof cdlState !== 'string') return result;
    if ((result.errors as FieldErrors).cdlNumber || skip?.(values)) return result;
    if (licenceProblem(cdlNumber, cdlState) !== 'stateFormat') return result;
    return {
      values: {},
      errors: {
        ...result.errors,
        cdlNumber: { type: 'custom', message: licenceMessage('stateFormat', cdlState) },
      },
    } as ResolverResult<T>;
  };
}
