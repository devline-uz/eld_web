import { describe, expect, it } from 'vitest';
import { VALIDATION_MESSAGES as M } from './messages';
import {
  LICENCE_FORMATS,
  licenceMessage,
  licenceNumber,
  licenceProblem,
  normalizeLicenceNumber,
} from './driverLicence';
import { driverSchema } from './driverSchema';

describe('licence number — generic rule', () => {
  it('trims and upper-cases', () => {
    expect(normalizeLicenceNumber('  w1234567 ')).toBe('W1234567');
    expect(licenceNumber().parse(' w1234567 ')).toBe('W1234567');
  });

  it('is required', () => {
    expect(licenceProblem('')).toBe('required');
    expect(licenceProblem('   ')).toBe('required');
    expect(licenceNumber().safeParse('').error?.issues[0]?.message).toBe(M.cdlNumber);
  });

  it('allows letters, digits and hyphens only', () => {
    expect(licenceProblem('OH-W8569238')).toBeNull();
    expect(licenceProblem('W12 34567')).toBe('charset');
    expect(licenceProblem('W1234_567')).toBe('charset');
    expect(licenceProblem('W1234567!')).toBe('charset');
    expect(licenceNumber().safeParse('W12 34567').error?.issues[0]?.message).toBe(
      M.cdlNumberCharset,
    );
  });

  it('is 4 to 20 characters', () => {
    expect(licenceProblem('W12')).toBe('length');
    expect(licenceProblem('W123')).toBeNull();
    expect(licenceProblem('A'.repeat(20))).toBeNull();
    expect(licenceProblem('A'.repeat(21))).toBe('length');
    expect(licenceMessage('length')).toBe(M.cdlNumberLength);
  });
});

describe('licence number — issuing-state format', () => {
  it.each([
    ['OH', 'W1234567'],
    ['OH', 'ab123456'],
    ['CA', 'D1234567'],
    ['TX', '12345678'],
    ['FL', 'S123456789012'],
    ['NY', '123456789'],
    ['IL', 'A12345678901'],
    ['WA', 'WDLABCD1234E'],
  ])('%s accepts %s', (state, number) => {
    expect(licenceProblem(number, state)).toBeNull();
  });

  it.each([
    ['CA', '12345678'],
    ['TX', 'W1234567'],
    ['FL', 'S12345'],
    ['PA', '1234567'],
    ['OH', 'ABC12345'],
  ])('%s rejects %s', (state, number) => {
    expect(licenceProblem(number, state)).toBe('stateFormat');
  });

  it('compares without hyphens and falls back to the generic rule for an unknown state', () => {
    expect(licenceProblem('OH-4471982', 'OH')).toBeNull();
    expect(licenceProblem('ANY-FORMAT-1', 'ZZ')).toBeNull();
    expect(licenceProblem('ANY-FORMAT-1')).toBeNull();
  });

  it('names the state in the message', () => {
    expect(licenceMessage('stateFormat', 'CA')).toBe(
      'This does not match the CA licence number format.',
    );
  });

  it('covers every issuing state the forms offer', () => {
    expect(Object.keys(LICENCE_FORMATS)).toHaveLength(51);
  });
});

describe('driverSchema — licence', () => {
  const base = {
    firstName: 'Marcus',
    lastName: 'Webb',
    email: 'marcus.webb@universal-logistics.example',
    username: 'marcus.webb',
    password: 'Onebook2026',
    cdlState: 'CA',
  };

  it('accepts a valid CA number and submits it upper-cased', () => {
    expect(driverSchema.parse({ ...base, cdlNumber: ' d1234567 ' }).cdlNumber).toBe('D1234567');
  });

  it('reports a wrong state format on cdlNumber', () => {
    const result = driverSchema.safeParse({ ...base, cdlNumber: '12345678' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['cdlNumber']);
    expect(result.error?.issues[0]?.message).toBe(
      'This does not match the CA licence number format.',
    );
  });
});
