// owner: web-settings-admin — W-17 Company profile: which country the form is in, every field's
// rule for that country, and the normalised body the save sends. Pure — the page and the tests
// both run it. The country-specific rules themselves live in `shared/forms/international`.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { ZodTypeAny } from 'zod';
import type { CarrierRow } from '@/shared/api/settingsAdmin';
import { fields, LIMITS, VALIDATION_MESSAGES } from '@/shared/forms';
import {
  countryPhoneError,
  DEFAULT_COUNTRY,
  formatCountryPhone,
  isSubdivisionOf,
  isValidCity,
  isValidCompanyName,
  isValidPostalCode,
  isValidStreet,
  normalizePostalCode,
  normalizeText,
  postalCodeError,
  subdivisionLabel,
  subdivisionsOf,
  taxIdError,
  TEXT_RULE_MESSAGES,
  toCountryCode,
  toCountryE164,
  type CountryCode,
} from '@/shared/forms/international';
import type { CarrierFieldErrors } from './carrierErrors';

export type CompanyForm = Partial<CarrierRow>;

/** The free-typed / picked fields of the Company profile card that carry a rule. */
export type ProfileKey =
  | 'name'
  | 'dotNumber'
  | 'mcNumber'
  | 'ein'
  | 'phone'
  | 'complianceEmail'
  | 'addressLine1'
  | 'city'
  | 'state'
  | 'zip';

/** Fields whose rule changes with the country — re-checked when the country changes. */
export const COUNTRY_DEPENDENT_KEYS: readonly ProfileKey[] = ['phone', 'zip', 'state', 'ein'];

const TEXT_KEYS = ['name', 'dotNumber', 'mcNumber', 'ein', 'complianceEmail', 'addressLine1', 'city', 'state', 'zip'] as const;

const isBlank = (value: string | null | undefined) => !value || !value.trim();

/** `Select a state from the list.` / `Select a province from the list.` / `Select a region…` */
function subdivisionListMessage(country: CountryCode): string {
  return country === 'US'
    ? VALIDATION_MESSAGES.state
    : `Select a ${subdivisionLabel(country).toLowerCase()} from the list.`;
}

function zodMessage(rule: ZodTypeAny, value: string): string | undefined {
  const result = rule.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/** One field's message for `country`, or `undefined` when it is fine (or empty and optional). */
export function profileFieldError(key: ProfileKey, form: CompanyForm, country: CountryCode): string | undefined {
  const raw = form[key];
  const value = typeof raw === 'string' ? raw.trim() : '';
  switch (key) {
    case 'name':
      if (!value) return VALIDATION_MESSAGES.companyName;
      if (value.length > LIMITS.companyTextMax) return VALIDATION_MESSAGES.companyTextMax;
      return isValidCompanyName(value) ? undefined : TEXT_RULE_MESSAGES.companyName;
    case 'dotNumber':
      return zodMessage(fields.dotNumber(), value);
    case 'mcNumber':
      // A US FMCSA number wherever the carrier is based — optional everywhere.
      return value ? zodMessage(fields.mcNumber(), value) : undefined;
    case 'ein':
      return value ? (taxIdError(value, country) ?? undefined) : undefined;
    case 'phone':
      return countryPhoneError(value, country, true) ?? undefined;
    case 'complianceEmail':
      // The backend's `z.string().email()` also rejects `''`, so once the email holds a string it
      // must be valid — only a never-set (`null`) email may stay empty.
      if (!value && typeof raw !== 'string') return undefined;
      return zodMessage(fields.email(), value);
    case 'addressLine1':
      if (!value) return undefined;
      if (value.length > LIMITS.companyTextMax) return VALIDATION_MESSAGES.companyTextMax;
      return isValidStreet(value) ? undefined : TEXT_RULE_MESSAGES.street;
    case 'city':
      if (!value) return undefined;
      if (value.length > LIMITS.cityMax) return VALIDATION_MESSAGES.city;
      return isValidCity(value) ? undefined : TEXT_RULE_MESSAGES.city;
    case 'state':
      if (!value) return undefined;
      if (subdivisionsOf(country)) return isSubdivisionOf(value, country) ? undefined : subdivisionListMessage(country);
      return isValidCity(value) && value.length <= 50 ? undefined : TEXT_RULE_MESSAGES.city;
    case 'zip':
      if (!value) return undefined;
      return isValidPostalCode(value, country) ? undefined : postalCodeError(country);
  }
}

const PROFILE_KEYS: readonly ProfileKey[] = [...TEXT_KEYS, 'phone'];

/** Every Company profile field at once (Save). */
export function companyProfileErrors(form: CompanyForm, country: CountryCode): CarrierFieldErrors {
  const errors: CarrierFieldErrors = {};
  for (const key of PROFILE_KEYS) {
    const message = profileFieldError(key, form, country);
    if (message) errors[key] = message;
  }
  return errors;
}

/**
 * The country to open the form in: the stored `country`, else the one the stored data implies
 * (a Canadian province code, then the stored phone's own country), else the US.
 */
export function inferCountry(carrier: CompanyForm): CountryCode {
  const stored = toCountryCode(carrier.country);
  if (stored) return stored;
  const state = carrier.state?.trim().toUpperCase() ?? '';
  if (state && !isSubdivisionOf(state, 'US')) {
    for (const country of ['CA', 'MX', 'AU'] as const) if (isSubdivisionOf(state, country)) return country;
  }
  const phone = carrier.phone?.trim();
  const phoneCountry = phone?.startsWith('+') ? parsePhoneNumberFromString(phone)?.country : undefined;
  return phoneCountry ?? DEFAULT_COUNTRY;
}

/** The loaded row as the form shows it: the phone in the country's international format. */
export function toProfileForm(carrier: CarrierRow, country: CountryCode): CompanyForm {
  return { ...carrier, phone: carrier.phone ? formatCountryPhone(carrier.phone, country) : carrier.phone };
}

/**
 * What the save sends, kept apart from what the inputs display: text trimmed and single-spaced,
 * phone → E.164, postal code upper-cased in the country's spacing, country → ISO alpha-2.
 * `null`/`undefined` stay as they are (`toCarrierPatch` drops them).
 */
export function normalizeCompanyProfile(form: CompanyForm, country: CountryCode): CompanyForm {
  const out: CompanyForm = { ...form, country };
  for (const key of TEXT_KEYS) {
    const value = form[key];
    if (typeof value === 'string') out[key] = normalizeText(value);
  }
  if (typeof form.complianceEmail === 'string') out.complianceEmail = form.complianceEmail.trim();
  if (typeof form.zip === 'string') out.zip = normalizePostalCode(form.zip, country);
  if (typeof form.state === 'string' && subdivisionsOf(country)) out.state = form.state.trim().toUpperCase();
  if (typeof form.phone === 'string') {
    out.phone = isBlank(form.phone) ? '' : (toCountryE164(form.phone, country) ?? form.phone.trim());
  }
  return out;
}
