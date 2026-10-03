import { describe, expect, it } from 'vitest';
import type { CarrierRow } from '@/shared/api/settingsAdmin';
import { companyProfileErrors, inferCountry, normalizeCompanyProfile, profileFieldError } from './companyProfileRules';

const US: Partial<CarrierRow> = {
  name: 'Universal Logistics Inc.',
  dotNumber: '1234567',
  mcNumber: 'MC-892014',
  ein: '88-4192055',
  phone: '+1 614 555 0104',
  complianceEmail: 'compliance@universal-logistics.example',
  addressLine1: '4517 Washington Ave.',
  city: 'Columbus',
  state: 'OH',
  zip: '43004',
};

const UZ: Partial<CarrierRow> = {
  name: 'O‘zbekiston Logistics',
  dotNumber: '1234567',
  mcNumber: '',
  ein: '301234567',
  phone: '90 123 45 67',
  complianceEmail: 'ops@uzlog.uz',
  addressLine1: 'Amir Temur ko‘chasi 108',
  city: 'Toshkent',
  state: 'TK',
  zip: '100000',
};

describe('companyProfileRules', () => {
  it('a valid US profile and a valid Uzbek profile have no errors', () => {
    expect(companyProfileErrors(US, 'US')).toEqual({});
    expect(companyProfileErrors(UZ, 'UZ')).toEqual({});
  });

  it('reports every missing required field', () => {
    const errors = companyProfileErrors({ name: ' ', dotNumber: '', phone: '' }, 'US');
    expect(errors.name).toBe('Enter the company name.');
    expect(errors.dotNumber).toBeTruthy();
    expect(errors.phone).toBe('Phone number is required.');
  });

  it('MC number is optional in every country', () => {
    expect(profileFieldError('mcNumber', { mcNumber: '' }, 'US')).toBeUndefined();
    expect(profileFieldError('mcNumber', { mcNumber: '' }, 'UZ')).toBeUndefined();
    expect(profileFieldError('mcNumber', { mcNumber: 'MC-12AB' }, 'US')).toBeTruthy();
  });

  it('changing the country re-judges the same values', () => {
    // A US address read as Uzbek: the region and postal code no longer fit.
    expect(profileFieldError('state', US, 'UZ')).toBe('Select a region from the list.');
    expect(profileFieldError('zip', US, 'UZ')).toBe('Enter a valid postal code, e.g. 100000.');
    expect(profileFieldError('phone', { phone: '6145550104' }, 'UZ')).toBe(
      'Please enter a valid phone number for the selected country.',
    );
    // A US EIN is a fine shape for a country without tax-ID metadata.
    expect(profileFieldError('ein', US, 'UZ')).toBeUndefined();
    // …but a country-specific EIN rule does not leak abroad, and vice versa.
    expect(profileFieldError('ein', UZ, 'US')).toBe('Enter the EIN as 12-3456789.');
  });

  it('a country without a subdivision list takes free text', () => {
    expect(profileFieldError('state', { state: 'Greater London' }, 'GB')).toBeUndefined();
    expect(profileFieldError('state', { state: 'Bayern' }, 'DE')).toBeUndefined();
  });

  it('normalises what is sent: E.164 phone, ISO country, trimmed text, postal spacing', () => {
    const out = normalizeCompanyProfile(
      { ...UZ, name: '  O‘zbekiston   Logistics ', city: ' Toshkent ', phone: '+998 90 123 45 67' },
      'UZ',
    );
    expect(out.phone).toBe('+998901234567');
    expect(out.country).toBe('UZ');
    expect(out.name).toBe('O‘zbekiston Logistics');
    expect(out.city).toBe('Toshkent');
    expect(normalizeCompanyProfile({ phone: '(614) 555-0104' }, 'US').phone).toBe('+16145550104');
    expect(normalizeCompanyProfile({ zip: 'k1a0b1' }, 'CA').zip).toBe('K1A 0B1');
  });

  it('opens in the stored country, else the one the data implies, else the US', () => {
    expect(inferCountry({ country: 'gb' })).toBe('GB');
    expect(inferCountry({ state: 'ON' })).toBe('CA');
    expect(inferCountry({ phone: '+998901234567' })).toBe('UZ');
    expect(inferCountry({ state: 'OH', phone: '+1 614 555 0104' })).toBe('US');
    expect(inferCountry({})).toBe('US');
  });
});
