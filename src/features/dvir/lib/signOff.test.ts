import { describe, expect, it } from 'vitest';
import { signOffBlockReason } from './signOff';

describe('signOffBlockReason (QA CODE-035)', () => {
  it('blocks PENDING', () => {
    expect(signOffBlockReason([{ status: 'OPEN' }], 'PENDING')).toMatch(/pending/i);
  });

  it('blocks REPAIRED while a defect is open or in progress, and with no defects', () => {
    expect(signOffBlockReason([{ status: 'OPEN' }], 'REPAIRED')).toMatch(/open defect/);
    expect(signOffBlockReason([{ status: 'IN_PROGRESS' }], 'REPAIRED')).toMatch(/open defect/);
    expect(signOffBlockReason([], 'REPAIRED')).toMatch(/Not required/);
  });

  it('allows REPAIRED once every defect is repaired or deferred, and DEFERRED / NOT_REQUIRED any time', () => {
    expect(signOffBlockReason([{ status: 'REPAIRED' }, { status: 'DEFERRED' }], 'REPAIRED')).toBeNull();
    expect(signOffBlockReason([{ status: 'OPEN' }], 'DEFERRED')).toBeNull();
    expect(signOffBlockReason([], 'NOT_REQUIRED')).toBeNull();
  });
});
