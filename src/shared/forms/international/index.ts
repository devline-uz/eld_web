// Country-aware form rules (web/decisions.md WD-103). Every country-specific rule lives in its
// own module and is driven by maintained metadata, never by a hand-written regex per country:
//   countries    — ISO 3166-1 codes + calling codes (libphonenumber-js), names (Intl.DisplayNames)
//   countryPhone — parse / validate / format / E.164 against the selected country (libphonenumber-js)
//   postalCode   — per-country patterns (postcode-validator), permissive fallback
//   subdivisions — ISO 3166-2 pick lists + what each country calls its regions
//   taxId        — business tax IDs (stdnum entity validators), permissive fallback
//   address      — Unicode name / city / street rules
export * from './countries';
export * from './countryPhone';
export * from './postalCode';
export * from './subdivisions';
export * from './taxId';
export * from './address';
