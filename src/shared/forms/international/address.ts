// Unicode-aware text rules for names and addresses. No ASCII-only or English-only pattern:
// `ООО Ромашка`, `株式会社テスト`, `O‘zbekiston Logistics`, `Müller GmbH`, `Société Générale`,
// `Straße des 17. Juni 135`, `ул. Тверская, д. 7, кв. 12`, `Amir Temur ko‘chasi 108` all pass.

/** Apostrophe forms used by real place names (ASCII, typographic, Uzbek ‘ ʻ, modifier ʼ). */
const APOSTROPHES = "'’‘ʻʼ";

/** A city / town: starts with a letter; then letters, combining marks, spaces, `.` `,` `-` `()` and apostrophes. */
const PLACE_NAME_RE = new RegExp(`^\\p{L}[\\p{L}\\p{M} .,()\\-${APOSTROPHES}]*$`, 'u');

/** A street line: letters, marks and digits of any script plus the punctuation addresses use. */
const STREET_RE = new RegExp(`^[\\p{L}\\p{M}\\p{N} .,/#№°()&:\\-${APOSTROPHES}]+$`, 'u');

/** Control and format characters — never part of a typed name. */
const CONTROL_RE = /[\p{Cc}\p{Cf}]/u;
const HAS_LETTER_OR_DIGIT_RE = /[\p{L}\p{N}]/u;

export const TEXT_RULE_MESSAGES = {
  city: 'Use letters, spaces, periods, apostrophes and hyphens only.',
  street: 'Use letters, digits, spaces and common address punctuation only.',
  companyName: 'Enter a company name with at least one letter or digit.',
} as const;

export const isValidCity = (value: string) => PLACE_NAME_RE.test(value.trim());

export const isValidStreet = (value: string) => {
  const trimmed = value.trim();
  return STREET_RE.test(trimmed) && HAS_LETTER_OR_DIGIT_RE.test(trimmed);
};

/** Any script; only control characters and a value with no letter or digit at all are refused. */
export const isValidCompanyName = (value: string) => {
  const trimmed = value.trim();
  return !CONTROL_RE.test(trimmed) && HAS_LETTER_OR_DIGIT_RE.test(trimmed);
};

/** Keystroke filter for a city: drops every character `isValidCity` never accepts. */
export function filterCityInput(raw: string, max: number): string {
  return raw.replace(new RegExp(`[^\\p{L}\\p{M} .,()\\-${APOSTROPHES}]`, 'gu'), '').slice(0, max);
}

/** Collapses runs of whitespace and trims — the stored form of every free-text field. */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
