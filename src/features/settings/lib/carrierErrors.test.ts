import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { mapCarrierSaveError, toCarrierField, toCarrierPatch } from './carrierErrors';

describe('toCarrierField — backend path → form field', () => {
  it.each([
    ['dotNumber', 'dotNumber'],
    ['us_dot_number', 'dotNumber'],
    ['usDotNumber', 'dotNumber'],
    ['mc_number', 'mcNumber'],
    ['tax_id', 'ein'],
    ['street_address', 'addressLine1'],
    ['zip_code', 'zip'],
    ['postalCode', 'zip'],
    ['address.zip', 'zip'],
    ['address.city', 'city'],
    ['compliance_email', 'complianceEmail'],
    ['eldRegistrationId', 'eldRegistrationId'],
  ])('%s → %s', (path, field) => {
    expect(toCarrierField(path)).toBe(field);
  });

  it('returns null for a field this form does not have', () => {
    expect(toCarrierField('logoUrl')).toBeNull();
  });
});

describe('mapCarrierSaveError', () => {
  it('ignores non-validation failures', () => {
    expect(mapCarrierSaveError(new ApiError(500, { code: 'INTERNAL_ERROR' }))).toBeNull();
    expect(mapCarrierSaveError(new Error('x'))).toBeNull();
  });

  it('associates a path-less error through a P2002-style `target`', () => {
    const error = new ApiError(409, { code: 'CONFLICT', message: 'Unique constraint failed', details: { target: ['dot_number'] } });
    expect(mapCarrierSaveError(error)).toEqual({ fields: { dotNumber: 'Unique constraint failed' }, banner: [] });
  });

  it('associates a path-less error through the field it names in its message', () => {
    const error = new ApiError(422, { code: 'VALIDATION_FAILED', message: 'zip does not match state OH' });
    expect(mapCarrierSaveError(error)?.fields).toEqual({ zip: 'zip does not match state OH' });
  });
});

describe('toCarrierPatch', () => {
  it('drops nulls and anything the form does not edit', () => {
    expect(
      toCarrierPatch({ id: 'carrier', name: 'Acme', ein: null, mcNumber: '', erodsMode: 'TEST', ...{ logoUrl: null } } as never),
    ).toEqual({ name: 'Acme', mcNumber: '', erodsMode: 'TEST' });
  });
});
