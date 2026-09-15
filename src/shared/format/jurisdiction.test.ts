import { describe, expect, it } from 'vitest';
import { formatJurisdiction } from './jurisdiction';

describe('formatJurisdiction', () => {
  it('names a US state from its IFTA code, as the W-12 design draws it', () => {
    expect(formatJurisdiction('OH')).toBe('Ohio');
    expect(formatJurisdiction('DC')).toBe('District of Columbia');
    expect(formatJurisdiction(' ky ')).toBe('Kentucky');
  });

  it('suffixes a Canadian province with (CA)', () => {
    expect(formatJurisdiction('ON')).toBe('Ontario (CA)');
    expect(formatJurisdiction('BC')).toBe('British Columbia (CA)');
  });

  it('passes an unknown value through unchanged', () => {
    expect(formatJurisdiction('Total')).toBe('Total');
    expect(formatJurisdiction('Ohio')).toBe('Ohio');
  });

  it('renders a missing value as an em dash', () => {
    expect(formatJurisdiction('')).toBe('—');
    expect(formatJurisdiction(null)).toBe('—');
    expect(formatJurisdiction(undefined)).toBe('—');
  });
});
