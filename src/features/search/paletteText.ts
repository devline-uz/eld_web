// 11.28 result lines — `Unit #101 · On duty · 1 violation · 1 warning`,
// `Unit #101 · Freightliner Cascadia`, `VIN 1FUJGLDR8LLLL1234 · John Smith`.
import type { SearchDriverHit, SearchVehicleHit } from '@/shared/api/search';

const DUTY_LABEL: Record<NonNullable<SearchDriverHit['dutyStatus']>, string> = {
  DRIVING: 'Driving',
  ON_DUTY: 'On duty',
  SLEEPER: 'Sleeper',
  OFF_DUTY: 'Off duty',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `dutyStatus` / `openWarnings` are always `null` on the live `GET /search` (backend D-098): the
 * duty slot renders `—` rather than a guessed status; an unknown warning count is omitted, the
 * same as zero (web/decisions.md WD-093). */
export function driverSubtitle(hit: SearchDriverHit): string {
  const parts: string[] = [];
  if (hit.unitNumber) parts.push(`Unit #${hit.unitNumber}`);
  else if (hit.homeTerminalName) parts.push(hit.homeTerminalName);
  parts.push(hit.dutyStatus ? DUTY_LABEL[hit.dutyStatus] : '—');
  if (hit.openViolations) parts.push(plural(hit.openViolations, 'violation'));
  if (hit.openWarnings) parts.push(plural(hit.openWarnings, 'warning'));
  return parts.join(' · ');
}

export function vehicleLabel(hit: SearchVehicleHit): string {
  const model = [hit.make, hit.model].filter(Boolean).join(' ');
  return model ? `Unit #${hit.unitNumber} · ${model}` : `Unit #${hit.unitNumber}`;
}

export function vehicleSubtitle(hit: SearchVehicleHit): string {
  return [`VIN ${hit.vin}`, hit.driverName].filter(Boolean).join(' · ');
}
