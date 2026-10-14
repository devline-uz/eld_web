import { describe, expect, it } from 'vitest';
import { clearable } from './clearable';

describe('clearable (CODE-010)', () => {
  it('sends a non-empty value as is', () => {
    expect(clearable('ABC123', 'XYZ')).toBe('ABC123');
    expect(clearable('ABC123', null)).toBe('ABC123');
  });

  it('sends null when the user emptied a field that had a value', () => {
    expect(clearable('', 'ABC123')).toBeNull();
    expect(clearable('   ', 'ABC123')).toBeNull();
    expect(clearable(undefined, 'ABC123')).toBeNull();
  });

  it('omits a field that was empty before and after', () => {
    expect(clearable('', '')).toBeUndefined();
    expect(clearable(undefined, null)).toBeUndefined();
    expect(clearable('', undefined)).toBeUndefined();
  });
});
