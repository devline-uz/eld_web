// web/tz.md §14.2 — one zod rule per backend DTO field, with its exact error string.
// Compose these into form schemas; never re-implement a rule inside a feature.
import { z } from 'zod';
import { LIMITS, VALIDATION_MESSAGES as M } from './messages';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;
const ELD_ID_RE = /^[A-Z0-9]{4}$/;
const PHONE_RE = /^(\+[1-9]\d{7,14}|\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4})$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const requiredString = (message: string = M.required) =>
  z.string({ required_error: message }).trim().min(1, message);

/** RFC-lite — the backend does the authoritative check. */
export const email = () => requiredString(M.email).regex(EMAIL_RE, M.email);

/** 11.14 — an eRODS transfer only goes to a government address. */
export const inspectorEmail = () =>
  email()
    .refine((value) => /\.?fmcsa\.dot\.gov$/i.test(value.split('@')[1] ?? ''), M.inspectorEmail);

/** The only password in the panel: the mobile-app password an admin sets in `Add driver`. */
export const driverPassword = () =>
  z.string({ required_error: M.password }).min(LIMITS.passwordMin, M.password);

export const vin = () => requiredString(M.vin).toUpperCase().regex(VIN_RE, M.vin);

export const unitNumber = () => requiredString(M.unitNumber).max(LIMITS.unitNumberMax, M.unitNumber);

export const username = () =>
  requiredString(M.username)
    .min(LIMITS.usernameMin, M.username)
    .max(LIMITS.usernameMax, M.username)
    .regex(USERNAME_RE, M.username);

export const cdlNumber = () =>
  requiredString(M.cdlNumber).max(LIMITS.cdlNumberMax, M.cdlNumber);

export const odometer = () =>
  z
    .number({ required_error: M.odometer, invalid_type_error: M.odometer })
    .int(M.odometer)
    .min(0, M.odometer)
    .max(LIMITS.odometerMax, M.odometer);

export const outputFileComment = () =>
  requiredString(M.outputFileComment).max(LIMITS.outputFileCommentMax, M.outputFileComment);

/** FMCSA requires a meaningful annotation — 4 characters minimum, never 1. */
export const annotation = () =>
  requiredString(M.annotation)
    .min(LIMITS.annotationMin, M.annotation)
    .max(LIMITS.annotationMax, M.annotation);

export const editReason = () =>
  requiredString(M.editReason)
    .min(LIMITS.editReasonMin, M.editReason)
    .max(LIMITS.editReasonMax, M.editReason);

export const messageBody = () =>
  requiredString(M.messageBody).max(LIMITS.messageBodyMax, M.messageBody);

export const ticketSubject = () =>
  requiredString(M.ticketSubject)
    .min(LIMITS.ticketSubjectMin, M.ticketSubject)
    .max(LIMITS.ticketSubjectMax, M.ticketSubject);

export const eldIdentifier = () =>
  requiredString(M.eldIdentifier).toUpperCase().regex(ELD_ID_RE, M.eldIdentifier);

export const phone = () => requiredString(M.phone).regex(PHONE_RE, M.phone);

export const isoDay = () => requiredString(M.required).regex(ISO_DAY_RE, M.required);

/** `.csv`, 5 MB — checked on the client and again on the server (§17). */
export const csvFile = () =>
  z
    .instanceof(File, { message: M.csvFile })
    .refine((file) => file.size <= LIMITS.fileBytesMax, M.csvFile)
    .refine((file) => file.name.toLowerCase().endsWith('.csv'), M.csvFile);

/** Up to 5 images, 5 MB each. */
export const imageFiles = () =>
  z
    .array(z.instanceof(File, { message: M.images }))
    .max(LIMITS.imagesMax, M.images)
    .refine(
      (files) => files.every((file) => file.type.startsWith('image/')),
      M.images,
    )
    .refine((files) => files.every((file) => file.size <= LIMITS.fileBytesMax), M.images);

/** Whole days between two `YYYY-MM-DD` days, inclusive of both ends. */
export function daySpan(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** A date range capped at `maxDays`, reported on the `to` field. */
export const dayRange = (maxDays: number, message: string) =>
  z
    .object({ from: isoDay(), to: isoDay() })
    .refine((value) => {
      const span = daySpan(value.from, value.to);
      return Number.isFinite(span) && span >= 1 && span <= maxDays;
    }, { message, path: ['to'] });

/** 11.14 — an FMCSA transfer covers at most 8 days. */
export const transferRange = () => dayRange(LIMITS.transferRangeDays, M.transferRange);

/** A log range is capped at 62 days. */
export const logRange = () => dayRange(LIMITS.logRangeDays, M.logRange);
