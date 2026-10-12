import { describe, expect, it } from 'vitest';
import { HOS_RULESET_OPTIONS, hosRulesetLabel } from './hosRuleset';

describe('UI-005 hosRulesetLabel', () => {
  it('names the ruleset the backend sends, passenger rules included', () => {
    expect(hosRulesetLabel('US_70_8_PROPERTY')).toBe('Property-carrying · 70 hr / 8 day');
    expect(hosRulesetLabel('US_60_7_PROPERTY', 70 * 3600)).toBe('Property-carrying · 60 hr / 7 day');
    expect(hosRulesetLabel('US_70_8_PASSENGER')).toBe('Passenger-carrying · 70 hr / 8 day');
    expect(hosRulesetLabel('US_60_7_PASSENGER')).toBe('Passenger-carrying · 60 hr / 7 day');
  });

  it('without a ruleset, reads the cycle limit and never claims property-carrying', () => {
    expect(hosRulesetLabel(undefined, 70 * 3600)).toBe('70 hr / 8 day');
    expect(hosRulesetLabel(null, 60 * 3600)).toBe('60 hr / 7 day');
    expect(hosRulesetLabel(undefined, 34 * 3600)).toBe('34:00 cycle');
    expect(hosRulesetLabel(undefined)).toBeUndefined();
  });

  it('offers all four rulesets to the driver form', () => {
    expect(HOS_RULESET_OPTIONS.map((o) => o.value)).toEqual(['US_70_8_PROPERTY', 'US_60_7_PROPERTY', 'US_70_8_PASSENGER', 'US_60_7_PASSENGER']);
  });
});
