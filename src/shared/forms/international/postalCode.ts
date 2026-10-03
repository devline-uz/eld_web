// Postal codes per country. The per-country patterns are `postcode-validator`'s metadata; a
// country it has no pattern for gets a permissive generic check, never the US ZIP format.
import { postcodeValidator, postcodeValidatorExistsForCountry } from 'postcode-validator';
import { VALIDATION_MESSAGES as M } from '../messages';
import type { CountryCode } from './countries';

/** Letters (any script) and digits, with single inner spaces or hyphens — 2 to 12 characters. */
const GENERIC_POSTAL_RE = /^[\p{L}\d](?:[\p{L}\d]|[ -](?=[\p{L}\d])){1,11}$/u;

/** A shape hint for the error message, where one exists. */
const EXAMPLES: Partial<Record<CountryCode, string>> = {
  CA: 'A1A 1A1',
  GB: 'SW1A 1AA',
  DE: '10115',
  FR: '75001',
  UZ: '100000',
  MX: '06600',
  AU: '2000',
};

export function postalCodeLabel(country: CountryCode): string {
  return country === 'US' ? 'ZIP' : 'Postal code';
}

export function postalCodeError(country: CountryCode): string {
  if (country === 'US') return M.zip;
  const example = EXAMPLES[country];
  return example ? `Enter a valid postal code, e.g. ${example}.` : 'Enter a valid postal code.';
}

/** Uppercase, trimmed, single-spaced — and the conventional space for CA / GB codes. */
export function normalizePostalCode(value: string, country: CountryCode): string {
  const upper = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (country === 'CA' || country === 'GB') {
    const compact = upper.replace(/\s/g, '');
    // CA is always 3+3; a GB code's inward part is always its last 3 characters.
    if (compact.length >= 5) return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }
  return upper;
}

/** True for a valid code of `country`; empty is the caller's decision (field is optional). */
export function isValidPostalCode(value: string, country: CountryCode): boolean {
  const normalized = normalizePostalCode(value, country);
  if (!normalized) return false;
  if (postcodeValidatorExistsForCountry(country)) return postcodeValidator(normalized, country);
  return GENERIC_POSTAL_RE.test(normalized);
}

/** Keystroke filter: no characters a postal code never has; length capped. */
export function filterPostalInput(raw: string): string {
  return raw.replace(/[^\p{L}\d -]/gu, '').slice(0, 12);
}
