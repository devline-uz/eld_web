// owner: web-vehicles-drivers — the two seeded home terminals shared by Add driver (11.8) and
// Import drivers (11.7 default terminal). Kept out of a component file so it can be imported
// without pulling a whole modal's fast-refresh boundary in (react-refresh/only-export-components).
//
// `homeTerminalName` is what the roster, W-07 and the 11.23 terminal filter read; the zone is what
// `formatRods` renders HOS/RODS in — every entry is checked against the city it names.
export const TERMINALS = [
  { name: 'Columbus, OH', label: 'Columbus, OH (Eastern)', timezone: 'America/New_York' },
  { name: 'Raleigh, NC', label: 'Raleigh, NC (Eastern)', timezone: 'America/New_York' },
] as const;
