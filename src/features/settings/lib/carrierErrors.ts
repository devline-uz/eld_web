// owner: web-settings-admin — W-17 Company profile: what `PATCH /carrier` is sent, and how its
// 422/409 answer is put back under the form's fields (client.ts rule 6: `details` → field errors,
// anything unmapped → banner, never only the generic toast).
import { ApiError } from '@/shared/api/errors';
import type { CarrierRow } from '@/shared/api/settingsAdmin';
import { VALIDATION_MESSAGES as M } from '@/shared/forms';

/** Every form control that can carry an error, keyed by the backend `UpdateCarrierDto` name. */
export const CARRIER_FIELD_LABELS = {
  name: 'Company name',
  dotNumber: 'US DOT number',
  mcNumber: 'MC number',
  ein: 'EIN / Tax ID',
  phone: 'Main phone',
  complianceEmail: 'Compliance email',
  addressLine1: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  hosRuleset: 'HOS ruleset',
  cycleRestart: 'Cycle restart',
  timezone: 'Home terminal time zone',
  distanceUnit: 'Distance unit',
  unassignedThresholdMin: 'Unassigned driving threshold',
  dvirRetentionMonths: 'DVIR retention',
  allowPersonalConveyance: 'Allow personal conveyance',
  allowYardMove: 'Allow yard move',
  eldIdentifier: 'ELD identifier',
  eldRegistrationId: 'ELD registration ID',
  erodsMode: 'eRODS mode',
} as const;

export type CarrierFieldKey = keyof typeof CARRIER_FIELD_LABELS;
export type CarrierFieldErrors = Partial<Record<CarrierFieldKey, string>>;

const FIELD_KEYS = Object.keys(CARRIER_FIELD_LABELS) as CarrierFieldKey[];

/**
 * The body for `PATCH /carrier`: only the fields the form edits, and never a `null`.
 * The form is seeded from the whole `GET /carrier` row, whose unset columns are `null`
 * (`ein`, `eldRegistrationId`, `logoUrl` on the seeded carrier). `UpdateCarrierDto` takes
 * `z.string().optional()` — a `null` is a 422 ("Expected string, received null") on a field the
 * user never touched, and `logoUrl` is not even on this form. A `null` here means "never set and
 * not edited" (an edited input always holds a string), so leaving it out changes nothing.
 */
export function toCarrierPatch(form: Partial<CarrierRow>): Partial<CarrierRow> {
  const patch: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    const value = form[key];
    if (value !== null && value !== undefined) patch[key] = value;
  }
  return patch as Partial<CarrierRow>;
}

/** Other spellings a field might come back under (snake_case, legacy names, nested `address.*`). */
const ALIASES: Record<string, CarrierFieldKey> = {
  companyname: 'name',
  legalname: 'name',
  usdot: 'dotNumber',
  usdotnumber: 'dotNumber',
  dot: 'dotNumber',
  mc: 'mcNumber',
  taxid: 'ein',
  fein: 'ein',
  mainphone: 'phone',
  phonenumber: 'phone',
  email: 'complianceEmail',
  street: 'addressLine1',
  streetaddress: 'addressLine1',
  address: 'addressLine1',
  address1: 'addressLine1',
  zipcode: 'zip',
  postalcode: 'zip',
  postcode: 'zip',
};

const normalise = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const BY_NORMALISED = new Map<string, CarrierFieldKey>([
  ...FIELD_KEYS.map((key) => [normalise(key), key] as const),
  ...Object.entries(ALIASES),
]);

/** `address.zip` / `zip_code` / `usDotNumber` → the form field, or null. */
export function toCarrierField(path: string): CarrierFieldKey | null {
  const segments = path.split(/[.[\]]/).filter(Boolean);
  // The most specific segment first (`address.zip` → `zip`), then the whole path.
  for (const candidate of [...segments].reverse().concat(path)) {
    const hit = BY_NORMALISED.get(normalise(candidate));
    if (hit) return hit;
  }
  return null;
}

/** What the valid value looks like, per field — used when the backend sent zod's bare default. */
const FORMAT_COPY: Partial<Record<CarrierFieldKey, string>> = {
  name: M.companyName,
  dotNumber: M.dotNumber,
  mcNumber: M.mcNumber,
  ein: M.ein,
  phone: M.phone,
  complianceEmail: M.email,
  city: M.city,
  state: M.state,
  zip: M.zip,
  unassignedThresholdMin: M.unassignedThreshold,
  dvirRetentionMonths: M.dvirRetention,
  eldIdentifier: 'The ELD identifier is exactly 4 characters, letters and digits only.',
  eldRegistrationId: 'The ELD registration ID is exactly 4 characters, letters and digits only.',
};

/** zod's own default messages say nothing about the field ("Invalid email", "Required", …). */
const ZOD_DEFAULT_RE = /^(Invalid( [a-z]+)?|Required|Expected .+, received .+)$/;

function fieldMessage(field: CarrierFieldKey, message: string): string {
  if (!ZOD_DEFAULT_RE.test(message.trim())) return message;
  return FORMAT_COPY[field] ?? `${CARRIER_FIELD_LABELS[field]}: ${message}`;
}

/** A path-less error may still name its field: `details.field`, a P2002 `target`, or the text. */
function fieldFromDetails(error: ApiError): CarrierFieldKey | null {
  const { field, target, fields } = error.details as { field?: unknown; target?: unknown; fields?: unknown };
  for (const raw of [field, target, fields].flat()) {
    if (typeof raw === 'string') {
      const hit = toCarrierField(raw);
      if (hit) return hit;
    }
  }
  // The field named first in the text (`zip does not match state OH` → zip).
  let named: CarrierFieldKey | null = null;
  let at = Infinity;
  for (const key of FIELD_KEYS) {
    const index = error.message.search(new RegExp(`\\b${key}\\b`));
    if (index >= 0 && index < at) [named, at] = [key, index];
  }
  return named;
}

const META_KEYS = new Set(['field', 'target', 'fields', 'code', 'reason', 'constraint', 'modelName']);

export interface CarrierSaveErrors {
  fields: CarrierFieldErrors;
  /** Errors that name no form field — shown in the banner, never dropped. */
  banner: string[];
}

/**
 * `PATCH /carrier` failure → per-field messages + banner lines. The live backend answers a DTO
 * failure with `422 VALIDATION_FAILED` and `details.issues: [{ path: 'zip', code, message }]`
 * (`ZodValidationPipe`); a service rule answers with `details.field` (`eldRegistrationId`).
 * Returns null for anything that is not a validation-style answer (5xx, 403, network).
 */
export function mapCarrierSaveError(error: unknown): CarrierSaveErrors | null {
  if (!(error instanceof ApiError) || ![400, 409, 422].includes(error.status)) return null;
  const fields: CarrierFieldErrors = {};
  const banner: string[] = [];

  // Without `details.issues`, `fieldErrors` reads `details` as a field → message map, so the
  // service-rule keys (`{ field: 'eldRegistrationId' }`, a P2002 `target`) are not fields.
  const byIssues = Array.isArray(error.details.issues);
  for (const [path, message] of Object.entries(error.fieldErrors)) {
    if (!byIssues && META_KEYS.has(path)) continue;
    const field = path ? toCarrierField(path) : null;
    if (field) {
      fields[field] ??= fieldMessage(field, message);
    } else {
      banner.push(path ? `${path}: ${message}` : message);
    }
  }

  if (Object.keys(fields).length === 0 && banner.length === 0) {
    // No per-path issues: the whole error is one message — put it under the field it names.
    const field = fieldFromDetails(error);
    if (field) fields[field] = fieldMessage(field, error.message);
    else banner.push(error.message && error.message !== 'Request failed' ? error.message : error.userMessage);
  }
  return { fields, banner };
}
