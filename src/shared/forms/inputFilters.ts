// Keystroke/paste filters for text inputs: each one strips the characters a field can never hold,
// so a letter never lands in a phone or a digit-only number. They only shape what is typed — the
// zod rule in `fields.ts` still decides whether the finished value is valid.
import { LIMITS } from './messages';

/** Longest phone the input takes — `+` and 15 E.164 digits, or a spaced/bracketed US number. */
export const PHONE_MAX_LENGTH = 20;

/** Digits, spaces, `(`, `)`, `-`, and a `+` only as the first character. */
export function phone(value: string): string {
  const lead = value.trimStart().startsWith('+') ? '+' : '';
  return (lead + value.replace(/[^\d ()-]/g, '')).slice(0, PHONE_MAX_LENGTH);
}

/** Digits only, cut to `max`. */
export function digits(value: string, max: number): string {
  return value.replace(/\D/g, '').slice(0, max);
}

/** MC number — digits, optionally after an `MC-` prefix (typing `m` or `mc` starts it). */
export function mcNumber(value: string): string {
  const [, prefix = '', rest = ''] = /^\s*(m(?:c-?)?)?(.*)$/is.exec(value) ?? [];
  const d = digits(rest, LIMITS.mcNumberMax);
  if (!prefix) return d;
  return d ? `MC-${d}` : prefix.toUpperCase();
}

/** EIN — up to 9 digits, the hyphen placed after the second (`12-3456789`). */
export function ein(value: string): string {
  const d = digits(value, 9);
  return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
}

/** US ZIP — up to 9 digits, the hyphen placed after the fifth (`43215-1234`). */
export function usZip(value: string): string {
  const d = digits(value, 9);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Canadian postal code — `A1A 1A1`, upper-cased, letters and digits in their slots only. */
export function caPostal(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let out = '';
  for (const ch of chars) {
    if (out.length === 6) break;
    const wantLetter = out.length % 2 === 0;
    if (wantLetter ? /[A-Z]/.test(ch) : /\d/.test(ch)) out += ch;
  }
  return out.length > 3 ? `${out.slice(0, 3)} ${out.slice(3)}` : out;
}

/** City — letters (any script), spaces, `.`, `'`, `-`. */
export function city(value: string): string {
  return value.replace(/[^\p{L} .'-]/gu, '').slice(0, LIMITS.cityMax);
}

/** E-mail — no whitespace can ever be part of an address. */
export function email(value: string): string {
  return value.replace(/\s/g, '');
}

/** 24-hour `HH:MM:SS` — digits only, colons placed automatically, and each digit must fit its slot
 * (no hour 25, no minute 60), so an impossible time can't be typed at all. */
export function time24(value: string): string {
  let d = '';
  for (const ch of value.replace(/\D/g, '')) {
    if (d.length === 6) break;
    const n = Number(ch);
    const slot = d.length;
    const fits =
      slot === 0 ? n <= 2 : slot === 1 ? d[0] !== '2' || n <= 3 : slot === 2 || slot === 4 ? n <= 5 : true;
    if (fits) d += ch;
  }
  return d.replace(/^(\d{2})(\d{1,2})?(\d{1,2})?$/, (_, h: string, m?: string, sec?: string) =>
    [h, m, sec].filter(Boolean).join(':'),
  );
}

/** Non-negative decimal — digits and one `.`, at most `intDigits` before it and `fracDigits` after. */
export function decimal(value: string, intDigits: number, fracDigits: number): string {
  const [int = '', ...rest] = value.replace(/[^\d.]/g, '').split('.');
  const whole = int.slice(0, intDigits);
  if (rest.length === 0 || fracDigits === 0) return whole;
  return `${whole}.${rest.join('').slice(0, fracDigits)}`;
}
