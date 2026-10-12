import { describe, expect, it } from 'vitest';
import { formatEnumLabel } from './enumLabel';

describe('formatEnumLabel (QA UI-020)', () => {
  it('turns raw enum codes into sentence case', () => {
    expect(formatEnumLabel('IN_PROGRESS')).toBe('In progress');
    expect(formatEnumLabel('AIR_LINES')).toBe('Air lines');
    expect(formatEnumLabel('EXHAUST')).toBe('Exhaust');
    expect(formatEnumLabel('Brakes')).toBe('Brakes');
    expect(formatEnumLabel(null)).toBe('—');
    expect(formatEnumLabel('')).toBe('—');
  });
});
