// UI-005 — the driver's HOS ruleset (backend `HosRuleset`, §395.3(b): 60 h / 7 days or 70 h / 8
// days, property- or passenger-carrying) as one label, wherever a screen names the rule set.
// Never hard-coded "Property-carrying · 70 hr / 8 day": read it off the driver / clocks response.
import type { HosRuleset } from '@/shared/api/carrier';
import { formatHosHours } from '@/shared/format/hos';

export const HOS_RULESET_LABEL: Record<HosRuleset, string> = {
  US_70_8_PROPERTY: 'Property-carrying · 70 hr / 8 day',
  US_60_7_PROPERTY: 'Property-carrying · 60 hr / 7 day',
  US_70_8_PASSENGER: 'Passenger-carrying · 70 hr / 8 day',
  US_60_7_PASSENGER: 'Passenger-carrying · 60 hr / 7 day',
};

/** The select options of the driver form: the four rulesets, labelled as above. */
export const HOS_RULESET_OPTIONS = (Object.keys(HOS_RULESET_LABEL) as HosRuleset[]).map((value) => ({
  value,
  label: HOS_RULESET_LABEL[value],
}));

/**
 * The rule set a driver's clocks run on. `ruleset` (from `GET /drivers/:id/hos` / the roster /
 * the driver row) wins; a backend that predates it falls back to the cycle limit — the 60/7 or
 * 70/8 cycle, without inventing property vs passenger. Nothing known yet → undefined (no claim).
 */
export function hosRulesetLabel(ruleset: HosRuleset | null | undefined, cycleLimitSec?: number): string | undefined {
  if (ruleset && ruleset in HOS_RULESET_LABEL) return HOS_RULESET_LABEL[ruleset];
  if (cycleLimitSec === undefined) return undefined;
  if (cycleLimitSec === 70 * 3600) return '70 hr / 8 day';
  if (cycleLimitSec === 60 * 3600) return '60 hr / 7 day';
  return `${formatHosHours(cycleLimitSec)} cycle`;
}
