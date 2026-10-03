// A phone number checked against ONE selected country (the carrier's country), as opposed to
// `../phoneNumber.ts`, which detects the country from a `+` number. Lengths, prefixes, mobile
// and landline patterns and the grouping all come from the `libphonenumber-js` `max` metadata.
//
//   typed in      `901234567`, `+998901234567`, `+998 90 123 45 67`  (country UZ)
//   shown         `+998 90 123 45 67`                                  (formatInternational)
//   stored/sent   `+998901234567`                                      (E.164)
import {
  AsYouType,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/examples.mobile.json';
import { PHONE_MAX_DIGITS, caretAfterDigits } from '../phoneNumber';
import { callingCode } from './countries';

export const COUNTRY_PHONE_MESSAGES = {
  required: 'Phone number is required.',
  invalid: 'Please enter a valid phone number for the selected country.',
} as const;

/** Digits, spaces, `()`, `.`, `-` and one leading `+` — nothing else is ever kept. */
function clean(raw: string): string {
  const plus = raw.trimStart().startsWith('+');
  const digits = raw.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
  return plus ? `+${digits}` : digits;
}

/** The number as `country` reads it: `+…` is international, anything else is national. */
function parse(value: string, country: CountryCode): PhoneNumber | undefined {
  const text = clean(value);
  if (!text.replace('+', '')) return undefined;
  return parsePhoneNumberFromString(text, country);
}

/** Valid AND dialled with the country's calling code (`+1` covers US/CA/PR…, by design). */
export function isValidCountryPhone(value: string, country: CountryCode): boolean {
  const number = parse(value, country);
  return Boolean(number?.isValid() && `+${number.countryCallingCode}` === callingCode(country));
}

/** The message for `value`, or `null` when it is fine. `required` decides what empty means. */
export function countryPhoneError(value: string | null | undefined, country: CountryCode, required: boolean): string | null {
  if (!clean(value ?? '').replace('+', '')) return required ? COUNTRY_PHONE_MESSAGES.required : null;
  return isValidCountryPhone(value ?? '', country) ? null : COUNTRY_PHONE_MESSAGES.invalid;
}

/** E.164 (`+998901234567`) of a valid number, else `undefined`. */
export function toCountryE164(value: string | null | undefined, country: CountryCode): string | undefined {
  if (!value || !isValidCountryPhone(value, country)) return undefined;
  return parse(value, country)?.number;
}

/**
 * The display value once the field is left or loaded: a valid number in the international
 * format (`+44 20 7946 0958`); anything else exactly as typed, so the error points at it.
 */
export function formatCountryPhone(value: string | null | undefined, country: CountryCode): string {
  const trimmed = value?.trim() ?? '';
  const number = trimmed ? parse(trimmed, country) : undefined;
  return number?.isValid() ? number.formatInternational() : trimmed;
}

/** `+998 91 234 56 78` — an example mobile number for the placeholder. */
export function countryPhonePlaceholder(country: CountryCode): string {
  return getExampleNumber(country, examples)?.formatInternational() ?? callingCode(country);
}

/**
 * One keystroke / paste in the phone input: letters dropped, a `+` put in front of the first
 * digit automatically (the number is always typed internationally), the digits re-grouped the
 * way the selected country writes them, and the caret kept beside the same digit.
 */
export function applyCountryPhoneInput(
  previous: string,
  raw: string,
  caret: number,
  country: CountryCode,
  inputType?: string,
): { value: string; caret: number } {
  let text = raw;
  let at = Math.max(0, Math.min(caret, raw.length));
  const digitsOf = (s: string) => s.replace(/\D/g, '');
  // A backspace that only removed a space removes the digit before it instead.
  if (raw.length < previous.length && digitsOf(raw) === digitsOf(previous) && inputType === 'deleteContentBackward') {
    for (let i = at - 1; i >= 0; i -= 1) {
      if (/\d/.test(text[i]!)) {
        text = text.slice(0, i) + text.slice(i + 1);
        at = i;
        break;
      }
    }
  }
  const digitsBefore = Math.min(digitsOf(text.slice(0, at)).length, PHONE_MAX_DIGITS);
  const digits = text.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
  if (!digits) return text.trim() === '+' && previous === '' ? { value: '+', caret: 1 } : { value: '', caret: 0 };
  const value = new AsYouType(country).input(`+${digits}`);
  return { value, caret: caretAfterDigits(value, digitsBefore) };
}
