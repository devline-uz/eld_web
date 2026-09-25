// web/tz.md §14.2 — one zod rule per backend DTO field, with its exact error string.
// Compose these into form schemas; never re-implement a rule inside a feature.
import { z } from 'zod';
import { LIMITS, VALIDATION_MESSAGES as M } from './messages';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;
const ELD_ID_RE = /^[A-Z0-9]{4}$/;
const PHONE_RE = /^(\+[1-9]\d{7,14}|\d{10})$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOT_NUMBER_RE = /^\d{1,8}$/;
const MC_NUMBER_RE = /^(MC-)?\d{1,8}$/;
const EIN_RE = /^\d{2}-\d{7}$/;
const US_ZIP_RE = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_RE = /^[A-Z]\d[A-Z] \d[A-Z]\d$/;
const PLACE_NAME_RE = /^\p{L}[\p{L} .'-]*$/u;

export const requiredString = (message: string = M.required) =>
  z.string({ required_error: message }).trim().min(1, message);

/** RFC-lite — the backend does the authoritative check. */
export const email = () => requiredString(M.email).regex(EMAIL_RE, M.email);

/**
 * 11.14 — an eRODS transfer only goes to a government address. The domain must be `fmcsa.dot.gov`
 * itself or one of its subdomains; a lookalike that merely *ends with* those characters
 * (`evilfmcsa.dot.gov`) is a different, privately registered domain (web/bugs.md WB-094).
 */
const INSPECTOR_DOMAIN_RE = /^(?:[a-z0-9-]+\.)*fmcsa\.dot\.gov$/i;

export const inspectorEmail = () =>
  email().refine(
    (value) => INSPECTOR_DOMAIN_RE.test(value.split('@')[1] ?? ''),
    M.inspectorEmail,
  );

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

/**
 * 11.2 Add/Edit vehicle — `Year`. The upper bound is "not in the future", evaluated inside the
 * `refine` at validation time so a long-lived tab never freezes last year's cutoff (WD note).
 */
export const vehicleYear = () =>
  z
    .number({ required_error: M.yearMin, invalid_type_error: M.yearMin })
    .int(M.yearMin)
    .min(LIMITS.vehicleYearMin, M.yearMin)
    .refine((value) => value <= new Date().getFullYear(), M.yearFuture);

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

/** E.164 (`+14155552671`) or a 10-digit US number; spaces, `(`, `)` and `-` between the digits are
 * formatting only (`+1 614 555 0104`, `(614) 555-0188`). */
export const phone = () =>
  requiredString(M.phone).refine((value) => PHONE_RE.test(value.replace(/[ ()-]/g, '')), M.phone);

// W-17 Company profile. The matching keystroke filters live in `inputFilters.ts`.

/** USDOT number — 1 to 8 digits. */
export const dotNumber = () => requiredString(M.dotNumber).regex(DOT_NUMBER_RE, M.dotNumber);

/** MC (operating authority) docket number — 1 to 8 digits, optionally written `MC-892014`. */
export const mcNumber = () => requiredString(M.mcNumber).regex(MC_NUMBER_RE, M.mcNumber);

/** Federal EIN — `12-3456789`. */
export const ein = () => requiredString(M.ein).regex(EIN_RE, M.ein);

/** US ZIP (`43215` / `43215-1234`), or a Canadian postal code (`M5V 2T6`) when `canadian`. */
export const postalCode = (canadian = false) =>
  canadian
    ? requiredString(M.postalCodeCa).toUpperCase().regex(CA_POSTAL_RE, M.postalCodeCa)
    : requiredString(M.zip).regex(US_ZIP_RE, M.zip);

/** City — letters, spaces, `.`, `'` and `-` only. */
export const city = () =>
  requiredString(M.city).max(LIMITS.cityMax, M.city).regex(PLACE_NAME_RE, M.city);

/** Company name / street address — free text, capped at `LIMITS.companyTextMax`. */
export const companyText = () => requiredString().max(LIMITS.companyTextMax, M.companyTextMax);

/**
 * W-22 Custom webhook — `config.url`. The backend (`WebhooksService.readUrl`) only needs a
 * non-empty string and does not restrict the scheme, so http is accepted; https is the default
 * the placeholder and hint steer to (WB-251).
 */
export const webhookUrl = () =>
  requiredString(M.webhookUrl).refine((value) => {
    try {
      const parsed = new URL(value);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }, M.webhookUrl);

/**
 * W-22 Custom webhook — `config.secret`, the HMAC key the worker signs every delivery with
 * (`X-OneBook-Signature`). The backend requires it to be non-empty and sets no other rule. It
 * is not trimmed: the receiver must verify with exactly the characters entered.
 */
export const webhookSecret = () =>
  z.string({ required_error: M.webhookSecret }).refine((value) => value.trim().length > 0, M.webhookSecret);

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
