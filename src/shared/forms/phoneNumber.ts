// International phone input (11.8 Add driver). Every rule — calling codes, national formats and
// per-country validity — comes from `libphonenumber-js` (full `max` metadata, so validation uses
// each country's real number patterns, not only its lengths). Nothing here hand-rolls a country
// list or a mask. Pure functions: the input component and the zod rule both build on them.
import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js/max';
import { z } from 'zod';
import { VALIDATION_MESSAGES as M } from './messages';

/** E.164 caps a number at 15 digits, calling code included. */
export const PHONE_MAX_DIGITS = 15;

/** Only these characters may appear in a typed or pasted number; anything else is rejected. */
const ALLOWED_RE = /^[\d\s().\-+]*$/;

/** The digits of `raw`, capped at E.164's 15. Letters and punctuation are dropped. */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

/**
 * The display value for whatever was typed or pasted: always `+` first, then the digits grouped
 * the way the detected country writes them (`+998 90 123 45 67`, `+1 234 567 8900`). A number
 * pasted without `+` (`998901234567`) gets one; extra or misplaced `+` signs, letters and
 * brackets are dropped. No digits → `''`, never a lone `+`.
 */
export function formatPhoneInput(raw: string): string {
  const digits = phoneDigits(raw);
  if (!digits) return '';
  return new AsYouType().input(`+${digits}`);
}

/**
 * The display value for a phone number already on file. Stored values predate this input and may
 * be E.164, formatted (`+1 614 555 0100`), a bare US national number (`(614) 555-0100`, read as
 * `defaultCountry`) or an international one written with `00` / no `+`.
 */
export function phoneForDisplay(
  stored: string | null | undefined,
  defaultCountry: CountryCode = 'US',
): string {
  const trimmed = stored?.trim() ?? '';
  if (!trimmed) return '';
  if (!trimmed.startsWith('+')) {
    const national = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (national?.isValid()) return formatPhoneInput(national.number);
    if (trimmed.startsWith('00')) return formatPhoneInput(trimmed.slice(2));
  }
  return formatPhoneInput(trimmed);
}

/**
 * The country the number belongs to, or `undefined` while it is still ambiguous. Shared calling
 * codes (`+1` = US/CA/…, `+7` = RU/KZ, `+44` = GB/GG/JE/IM) are only resolved once enough
 * national digits have been typed — AsYouType never guesses early.
 */
export function detectPhoneCountry(value: string): CountryCode | undefined {
  const digits = phoneDigits(value);
  if (!digits) return undefined;
  const typer = new AsYouType();
  typer.input(`+${digits}`);
  return typer.getCountry();
}

/** The E.164 form (`+998901234567`) of a valid number, or `undefined`. */
export function toE164(value: string): string | undefined {
  const digits = phoneDigits(value);
  if (!digits) return undefined;
  const parsed = parsePhoneNumberFromString(`+${digits}`);
  return parsed?.isValid() ? parsed.number : undefined;
}

export type PhoneProblem = 'invalid' | 'invalidCountry' | 'incomplete';

export const PHONE_PROBLEM_MESSAGES: Record<PhoneProblem, string> = {
  invalid: M.phone,
  invalidCountry: M.phoneCountryCode,
  incomplete: M.phoneIncomplete,
};

/**
 * Why `value` is not a valid international number, or `null` when it is (or is empty — the field
 * is optional). Structure first (letters, a `+` anywhere but position 0, more than one `+`), then
 * the detected country's own rules.
 */
export function phoneProblem(value: string): PhoneProblem | null {
  const trimmed = value.trim();
  if (!ALLOWED_RE.test(trimmed)) return 'invalid';
  if (trimmed.lastIndexOf('+') > 0) return 'invalid';
  const allDigits = trimmed.replace(/\D/g, '');
  if (!allDigits) return trimmed === '' || trimmed === '+' ? null : 'invalid';
  if (allDigits.length > PHONE_MAX_DIGITS) return 'invalid';
  const e164 = `+${allDigits}`;
  switch (validatePhoneNumberLength(e164)) {
    case 'INVALID_COUNTRY':
      return 'invalidCountry';
    case 'NOT_A_NUMBER':
    case 'TOO_SHORT':
      return 'incomplete';
    case 'TOO_LONG':
    case 'INVALID_LENGTH':
      return 'invalid';
    default:
      return isValidPhoneNumber(e164) ? null : 'invalid';
  }
}

/**
 * Optional international phone: `''` / `+` / `undefined` → `undefined`; a valid number → its
 * E.164 form (what the API receives); anything else fails with the matching §14 message.
 */
export const internationalPhone = () =>
  z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const problem = value === undefined ? null : phoneProblem(value);
      if (problem) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_PROBLEM_MESSAGES[problem] });
      }
    })
    .transform((value) => (value === undefined ? undefined : toE164(value)));

export type PhoneInputChange = { value: string; caret: number };

/**
 * One keystroke / paste / cut in the phone input, as the browser reports it: the previous display
 * value, the raw new value, the caret after the edit and the `InputEvent.inputType`. Returns the
 * reformatted value and where the caret belongs in it.
 *
 * The caret is mapped through the count of digits before it, so it stays next to the same digit
 * however the grouping changes. A backspace / delete that only removed a formatting character
 * (a space) removes the neighbouring digit instead, so deleting never gets stuck on a space.
 */
export function applyPhoneInput(
  previous: string,
  raw: string,
  caret: number,
  inputType?: string,
): PhoneInputChange {
  let text = raw;
  let at = Math.max(0, Math.min(caret, raw.length));
  const onlyFormattingRemoved =
    raw.length < previous.length && phoneDigits(raw) === phoneDigits(previous);
  if (onlyFormattingRemoved && inputType === 'deleteContentBackward') {
    const i = lastDigitIndexBefore(text, at);
    if (i >= 0) {
      text = text.slice(0, i) + text.slice(i + 1);
      at = i;
    }
  } else if (onlyFormattingRemoved && inputType === 'deleteContentForward') {
    const i = firstDigitIndexFrom(text, at);
    if (i >= 0) text = text.slice(0, i) + text.slice(i + 1);
  }

  const digitsBefore = Math.min(text.slice(0, at).replace(/\D/g, '').length, PHONE_MAX_DIGITS);
  const value = formatPhoneInput(text);
  if (!value) {
    // A `+` typed into an empty field is kept so the user sees their keystroke; a lone `+` left
    // behind by deleting is not (and is treated as empty anyway).
    const typedPlus = previous === '' && text.trim() === '+';
    return typedPlus ? { value: '+', caret: 1 } : { value: '', caret: 0 };
  }
  return { value, caret: caretAfterDigits(value, digitsBefore) };
}

/** The index just after the `count`-th digit of `value` (just after the `+` for 0). */
export function caretAfterDigits(value: string, count: number): number {
  if (count <= 0) return value.startsWith('+') ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i]!)) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return value.length;
}

function lastDigitIndexBefore(text: string, index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) if (/\d/.test(text[i]!)) return i;
  return -1;
}

function firstDigitIndexFrom(text: string, index: number): number {
  for (let i = index; i < text.length; i += 1) if (/\d/.test(text[i]!)) return i;
  return -1;
}
