import { describe, expect, it } from 'vitest';
import {
  applyCountryPhoneInput,
  callingCode,
  COUNTRY_OPTIONS,
  COUNTRY_PHONE_MESSAGES,
  countryLabel,
  countryPhoneError,
  formatCountryPhone,
  isValidCity,
  isValidCompanyName,
  isValidPostalCode,
  isValidStreet,
  normalizePostalCode,
  postalCodeLabel,
  subdivisionLabel,
  subdivisionsOf,
  taxIdError,
  taxIdLabel,
  toCountryCode,
  toCountryE164,
  type CountryCode,
} from './index';

describe('countries', () => {
  it('lists ISO 3166-1 alpha-2 codes with their calling codes', () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
    expect(COUNTRY_OPTIONS.every((o) => /^[A-Z]{2}$/.test(o.value))).toBe(true);
    expect(countryLabel('UZ')).toContain('Uzbekistan (+998)');
    expect(countryLabel('GB')).toContain('United Kingdom (+44)');
    expect(callingCode('DE')).toBe('+49');
    expect(callingCode('FR')).toBe('+33');
    expect(callingCode('US')).toBe('+1');
  });

  it('reads a stored value as an ISO code, or nothing', () => {
    expect(toCountryCode(' uz ')).toBe('UZ');
    expect(toCountryCode('Uzbekistan')).toBeUndefined();
    expect(toCountryCode(null)).toBeUndefined();
  });
});

describe('phone — validated against the selected country', () => {
  const valid: [CountryCode, string, string, string][] = [
    ['US', '6145550111', '+1 614 555 0111', '+16145550111'],
    ['US', '+1 650 253 0000', '+1 650 253 0000', '+16502530000'],
    ['GB', '020 7946 0958', '+44 20 7946 0958', '+442079460958'],
    ['DE', '030 123456', '+49 30 123456', '+4930123456'],
    ['UZ', '901234567', '+998 90 123 45 67', '+998901234567'],
    ['UZ', '+998901234567', '+998 90 123 45 67', '+998901234567'],
    ['UZ', '+998 90 123 45 67', '+998 90 123 45 67', '+998901234567'],
    ['FR', '01 42 68 53 00', '+33 1 42 68 53 00', '+33142685300'],
    ['CA', '613-555-0123', '+1 613 555 0123', '+16135550123'],
  ];

  it.each(valid)('%s %s → shown %s, stored %s', (country, typed, shown, e164) => {
    expect(countryPhoneError(typed, country, true)).toBeNull();
    expect(formatCountryPhone(typed, country)).toBe(shown);
    expect(toCountryE164(typed, country)).toBe(e164);
  });

  it('accepts mobile and landline numbers alike', () => {
    expect(countryPhoneError('07400 123456', 'GB', true)).toBeNull(); // mobile
    expect(countryPhoneError('020 7946 0958', 'GB', true)).toBeNull(); // landline
  });

  it('rejects a number that is not valid for the selected country', () => {
    expect(countryPhoneError('12345', 'US', true)).toBe(COUNTRY_PHONE_MESSAGES.invalid);
    expect(countryPhoneError('90123456', 'UZ', true)).toBe(COUNTRY_PHONE_MESSAGES.invalid); // one digit short
    expect(countryPhoneError('+998901234567', 'DE', true)).toBe(COUNTRY_PHONE_MESSAGES.invalid); // another country
    expect(countryPhoneError('6145550111', 'UZ', true)).toBe(COUNTRY_PHONE_MESSAGES.invalid); // US national under UZ
    expect(toCountryE164('12345', 'US')).toBeUndefined();
  });

  it('says when a required number is missing', () => {
    expect(countryPhoneError('', 'US', true)).toBe(COUNTRY_PHONE_MESSAGES.required);
    expect(countryPhoneError('+', 'US', true)).toBe(COUNTRY_PHONE_MESSAGES.required);
    expect(countryPhoneError('', 'US', false)).toBeNull();
  });

  it('puts the + in by itself, formats while typing and drops letters', () => {
    expect(applyCountryPhoneInput('', '9', 1, 'UZ')).toEqual({ value: '+9', caret: 2 });
    expect(applyCountryPhoneInput('', '99890123', 8, 'UZ').value).toBe('+998 90 123');
    expect(applyCountryPhoneInput('', '+99890abc1', 10, 'UZ').value).toBe('+998 90 1');
    expect(applyCountryPhoneInput('', '16145550', 8, 'US').value).toBe('+1 614 555 0');
    expect(applyCountryPhoneInput('', 'abc', 3, 'US').value).toBe('');
    expect(applyCountryPhoneInput('', '+', 1, 'US').value).toBe('+');
    expect(applyCountryPhoneInput('+9', '+', 1, 'US').value).toBe('');
  });

  it('re-reads the same digits under a new country', () => {
    // Typed nationally under UZ, then the country changes: still the same digits, now judged as DE.
    expect(countryPhoneError('901234567', 'UZ', true)).toBeNull();
    expect(countryPhoneError('901234567', 'DE', true)).toBe(COUNTRY_PHONE_MESSAGES.invalid);
  });
});

describe('postal codes', () => {
  it.each([
    ['US', '43215'],
    ['US', '43215-1234'],
    ['CA', 'A1A 1A1'],
    ['CA', 'k1a0b1'],
    ['GB', 'SW1A 1AA'],
    ['GB', 'sw1a1aa'],
    ['DE', '10115'],
    ['FR', '75001'],
    ['UZ', '100000'],
  ] as [CountryCode, string][])('%s accepts %s', (country, value) => {
    expect(isValidPostalCode(value, country)).toBe(true);
  });

  it.each([
    ['US', '4321'],
    ['US', 'A1A 1A1'],
    ['CA', '43215'],
    ['GB', '12345'],
    ['DE', '1011'],
    ['UZ', '10000'],
  ] as [CountryCode, string][])('%s rejects %s', (country, value) => {
    expect(isValidPostalCode(value, country)).toBe(false);
  });

  it('does not force a country without metadata into a fixed format', () => {
    expect(isValidPostalCode('00962', 'AE')).toBe(true);
    expect(isValidPostalCode('АБ-12', 'AE')).toBe(true);
    expect(isValidPostalCode('!', 'AE')).toBe(false);
  });

  it('normalises case and the conventional space', () => {
    expect(normalizePostalCode(' k1a0b1 ', 'CA')).toBe('K1A 0B1');
    expect(normalizePostalCode('sw1a1aa', 'GB')).toBe('SW1A 1AA');
    expect(normalizePostalCode('10115', 'DE')).toBe('10115');
  });

  it('is called ZIP only in the US', () => {
    expect(postalCodeLabel('US')).toBe('ZIP');
    expect(postalCodeLabel('GB')).toBe('Postal code');
    expect(postalCodeLabel('UZ')).toBe('Postal code');
  });
});

describe('state / province / region', () => {
  it('names the level the way each country does', () => {
    expect(subdivisionLabel('US')).toBe('State');
    expect(subdivisionLabel('CA')).toBe('Province');
    expect(subdivisionLabel('GB')).toBe('Region/County');
    expect(subdivisionLabel('UZ')).toBe('Region');
    expect(subdivisionLabel('NO')).toBe('State / Province / Region');
  });

  it('has its own list per country, and none (free text) for others', () => {
    expect(subdivisionsOf('US')?.map((s) => s.code)).toContain('OH');
    expect(subdivisionsOf('CA')?.map((s) => s.code)).toContain('ON');
    expect(subdivisionsOf('CA')?.map((s) => s.code)).not.toContain('OH');
    expect(subdivisionsOf('UZ')?.map((s) => s.code)).toContain('TK');
    expect(subdivisionsOf('GB')).toBeUndefined();
  });
});

describe('tax IDs', () => {
  it('keeps the US EIN format for the US only', () => {
    expect(taxIdLabel('US')).toBe('EIN / Tax ID');
    expect(taxIdLabel('DE')).toBe('Tax ID / Business ID');
    expect(taxIdError('12-3456789', 'US')).toBeNull();
    expect(taxIdError('123456789', 'US')).not.toBeNull();
  });

  it('uses the country’s own check digits where the metadata exists', () => {
    expect(taxIdError('732 829 320', 'FR')).toBeNull(); // SIREN
    expect(taxIdError('732 829 321', 'FR')).not.toBeNull(); // bad check digit
  });

  it('never rejects a legitimate ID of a kind the metadata does not know', () => {
    expect(taxIdError('SC123456', 'GB')).toBeNull(); // Companies House number
    expect(taxIdError('HRB 12345', 'DE')).toBeNull(); // Handelsregister
    expect(taxIdError('301234567', 'UZ')).toBeNull(); // STIR — no metadata
    expect(taxIdError('!!', 'UZ')).not.toBeNull();
  });
});

describe('names and addresses — any script', () => {
  it.each(['ООО Ромашка', '株式会社テスト', 'O‘zbekiston Logistics', 'Müller GmbH', 'Société Générale', 'Universal Logistics Inc.'])(
    'company name %s',
    (name) => expect(isValidCompanyName(name)).toBe(true),
  );

  it('refuses a company name with no letter or digit', () => {
    expect(isValidCompanyName('---')).toBe(false);
  });

  it.each(['Straße des 17. Juni 135', 'ул. Тверская, д. 7, кв. 12', 'Amir Temur ko‘chasi 108', '4517 Washington Ave.', '12 Rue de l’Église', '東京都千代田区丸の内1-1'])(
    'street %s',
    (street) => expect(isValidStreet(street)).toBe(true),
  );

  it.each(['Toshkent', 'Farg‘ona', 'Saint-Étienne', 'München', "Coeur d'Alene", 'Москва', '東京'])('city %s', (city) =>
    expect(isValidCity(city)).toBe(true),
  );

  it('refuses digits in a city', () => {
    expect(isValidCity('Dayton 45')).toBe(false);
  });
});
