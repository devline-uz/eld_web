// Business tax / registration IDs per country. The check digits and formats are the `stdnum`
// library's business-entity validators (`entityValidators` — EIN, BN, SIREN/SIRET, USt-IdNr,
// RFC, ИНН, NIP…). Where it has none for a country, or covers only some of the IDs businesses
// there actually use, a value is only checked for a sane shape, so a legitimate ID is never
// rejected for being a kind the library does not know.
import { validateEntity } from 'stdnum';
import { ein as einFilter } from '../inputFilters';
import { VALIDATION_MESSAGES as M } from '../messages';
import type { CountryCode } from './countries';

/** The US keeps its established `12-3456789` EIN entry format. */
const US_EIN_RE = /^\d{2}-\d{7}$/;

/**
 * Countries where `stdnum` knows only some of the common business IDs, so its verdict cannot be
 * final: GB (VAT only — no Companies House number or UTR), DE (VAT + Steuernummer, no HRB).
 */
const SHAPE_ONLY: ReadonlySet<CountryCode> = new Set<CountryCode>(['GB', 'DE']);

/** Letters (any script), digits and the usual separators — 3 to 20 characters (backend cap). */
const GENERIC_TAX_ID_RE = /^[\p{L}\d][\p{L}\d ./-]{1,18}[\p{L}\d]$/u;

export function taxIdLabel(country: CountryCode): string {
  return country === 'US' ? 'EIN / Tax ID' : 'Tax ID / Business ID';
}

export function taxIdPlaceholder(country: CountryCode): string | undefined {
  return country === 'US' ? '12-3456789' : undefined;
}

/** The message for a non-empty `value`, or `null` when it is acceptable for `country`. */
export function taxIdError(value: string, country: CountryCode): string | null {
  const trimmed = value.trim();
  if (country === 'US') return US_EIN_RE.test(trimmed) ? null : M.ein;
  if (!GENERIC_TAX_ID_RE.test(trimmed)) return 'Use 3–20 letters, digits, spaces, dots, slashes or hyphens.';
  if (SHAPE_ONLY.has(country)) return null;
  const result = validateEntity(country, trimmed);
  if (!result.checked || result.isValid) return null;
  return 'This is not a valid tax ID for the selected country.';
}

/** Keystroke filter: only characters a tax ID can contain; length capped at the backend's 20. */
export function filterTaxIdInput(raw: string, country: CountryCode): string {
  if (country === 'US') return einFilter(raw);
  return raw.replace(/[^\p{L}\d ./-]/gu, '').slice(0, 20);
}
