// owner: web-vehicles-drivers — home-terminal inputs shared by Add driver (11.8), Edit driver and
// Import drivers (11.7). Kept out of a component file so it can be imported without pulling a
// whole modal's fast-refresh boundary in (react-refresh/only-export-components).
//
// There is no Terminal table / endpoint yet (backend D-090), so the terminal *name* is typed by the
// user — no carrier's terminals are hardcoded here. The zone is what `formatRods` renders HOS/RODS
// in, so it is picked from the fixed list of US IANA zones below (an enum, not carrier data) and
// kept apart from the display name (WB-153).
export const HOME_TERMINAL_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
] as const;
