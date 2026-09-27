import { describe, expect, it } from 'vitest';
import { describeCondition } from './alertConditions';
import { countLabel } from './copy';

describe('describeCondition', () => {
  it('turns an engine key + minutes into the sentence shown under the rule name', () => {
    expect(describeCondition({ event: 'hos.break_due', params: { minutes: 30 } })).toBe('30-minute break is due within 30 minutes');
    expect(describeCondition({ event: 'device.offline', params: { minutes: 1 } })).toBe('ELD stopped reporting for 1 minute');
  });

  it('uses the plain label for events without a minutes threshold, and passes unknown keys through', () => {
    expect(describeCondition({ event: 'hos.violation' })).toBe('HOS violation recorded');
    expect(describeCondition({ event: 'custom.event' })).toBe('custom.event');
  });
});

describe('countLabel', () => {
  it('pluralises only when the count is not 1', () => {
    expect(countLabel(1, 'user')).toBe('1 user');
    expect(countLabel(0, 'user')).toBe('0 users');
    expect(countLabel(3, 'back-office user')).toBe('3 back-office users');
  });
});
