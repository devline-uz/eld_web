// web/tz.md §8 — IFTA jurisdiction display names. `GET /reports/ifta/summary` returns the
// two-letter IFTA code (`OH`, `ON`; backend `reports/lib/jurisdiction.ts`), while W-12's design
// draws the full name (`Ohio`, `Ontario (CA)`). Pure lookup: an unknown value passes through
// unchanged so a new backend code is still shown, never hidden.
import { EMPTY } from './empty';

const US: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const CANADA: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan',
};

/** `OH` → `Ohio` · `ON` → `Ontario (CA)` · unknown → as given · empty → `—`. */
export function formatJurisdiction(code: string | null | undefined): string {
  if (!code) return EMPTY.dash;
  const key = code.trim().toUpperCase();
  if (US[key]) return US[key];
  if (CANADA[key]) return `${CANADA[key]} (CA)`;
  return code;
}
