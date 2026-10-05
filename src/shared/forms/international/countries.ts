// The country list behind every country field. Codes and calling codes come from the
// `libphonenumber-js` metadata (ISO 3166-1 alpha-2, every country and territory it can dial);
// names come from the browser's own `Intl.DisplayNames`. Nothing here is a hand-kept list.
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max';
import type { SelectOption } from '@/shared/ui/Select';

export type { CountryCode };

/** The country a carrier is assumed to be in when nothing on file says otherwise. */
export const DEFAULT_COUNTRY: CountryCode = 'US';

const CODES: readonly CountryCode[] = getCountries();
const CODE_SET = new Set<string>(CODES);

const regionNames: Intl.DisplayNames | null = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

/** `'UZ'` → `'Uzbekistan'` (falls back to the code itself). */
export function countryName(code: CountryCode): string {
  return regionNames?.of(code) ?? code;
}

/** `'UZ'` → `'+998'`. */
export function callingCode(code: CountryCode): string {
  return `+${getCountryCallingCode(code)}`;
}

/** `'UZ'` → `'🇺🇿'` — regional-indicator letters, no image assets. */
export function countryFlag(code: CountryCode): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** `'UZ'` → `'🇺🇿 Uzbekistan (+998)'`. */
export function countryLabel(code: CountryCode): string {
  return `${countryFlag(code)} ${countryName(code)} (${callingCode(code)})`;
}

/** Every country, sorted by name, ready for a `Select`. */
export const COUNTRY_OPTIONS: readonly SelectOption[] = CODES.map((code) => ({
  value: code,
  label: countryLabel(code),
  name: countryName(code),
}))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .map(({ value, label }) => ({ value, label }));

/** A stored country value (any case, padded) as an ISO code, or `undefined` when it is not one. */
export function toCountryCode(value: string | null | undefined): CountryCode | undefined {
  const code = value?.trim().toUpperCase();
  return isCountryCode(code) ? code : undefined;
}
