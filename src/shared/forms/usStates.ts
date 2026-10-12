/**
 * USPS codes for the 50 US states plus DC — the one list behind every state field (CDL issuing
 * state, carrier address). WB-187: a shortened list made valid addresses/CDLs unrecordable.
 */
export const US_STATES: readonly string[] = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];

/** Canada Post codes for the 13 provinces and territories. */
export const CA_PROVINCES: readonly string[] = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

/** Every plate-issuing jurisdiction the vehicle form accepts — US states + DC + Canada (QA FE-012). */
export const PLATE_JURISDICTIONS: ReadonlySet<string> = new Set([...US_STATES, ...CA_PROVINCES]);
