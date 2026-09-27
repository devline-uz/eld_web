// owner: web-vehicles-drivers — display text for the Unit profile "Unit activity" feed (B-5).
// `GET /vehicles/:id/activities` returns raw audit codes (`CREATE`, `CALIBRATE_ODOMETER`,
// source `AUDIT`, details `traceId=…`); the design shows sentences ("Duty status changed to
// Driving", "ELD · automatic"). The mapping lives here so the page never prints a bare enum.

const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: 'Unit created',
  UPDATE: 'Unit details updated',
  DELETE: 'Unit deleted',
  CALIBRATE_ODOMETER: 'Odometer calibrated',
  ASSIGN_DRIVER: 'Driver assigned',
  UNASSIGN_DRIVER: 'Driver unassigned',
  PAIR_DEVICE: 'ELD device paired',
  UNPAIR_DEVICE: 'ELD device unpaired',
  DVIR_PRE_TRIP: 'Pre-trip DVIR submitted',
  DVIR_POST_TRIP: 'Post-trip DVIR submitted',
};

const SOURCE_LABELS: Record<string, string> = {
  AUDIT: 'Web panel',
  DVIR: 'Mobile app',
};

function sentenceCase(code: string): string {
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

export function activityLabel(code: string): string {
  return ACTIVITY_LABELS[code] ?? (/^[A-Z0-9_]+$/.test(code) ? sentenceCase(code) : code);
}

export function activitySource(code: string): string {
  return SOURCE_LABELS[code] ?? code;
}

/** A bare `traceId=…` is a support reference, not a detail a fleet manager can read. */
export function activityDetails(details: string | null | undefined): string {
  if (!details || /^traceId=[\w-]+$/.test(details.trim())) return '—';
  return details;
}

const FUEL_LABELS: Record<string, string> = {
  DIESEL: 'Diesel',
  GASOLINE: 'Gasoline',
  CNG: 'CNG',
  LNG: 'LNG',
  ELECTRIC: 'Electric',
};

export function fuelLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return FUEL_LABELS[code] ?? code;
}
