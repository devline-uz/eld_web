import type { LogEventView } from '@/shared/api/hosLogs';
import { RECORD_STATUS } from '@/shared/api/hosLogs';

/** Faster than any legal CMV trip — an odometer gain above this pace is a data error. */
export const MAX_PLAUSIBLE_MPH = 90;
/** Rounding / sampling slack before a gain or loss is flagged. */
export const ODOMETER_SLACK_MI = 5;
export const ENGINE_HOURS_SLACK_H = 0.05;

export interface TelemetryFlag {
  odometer?: string;
  engineHours?: string;
}

/**
 * LIVE-015 — flags impossible telemetry on the day's live records, per unit and in time order:
 * an odometer or engine-hour reading that goes down, or an odometer gain no truck can make in the
 * elapsed time (e.g. +2,199 mi in the same second). Display only — nothing is changed or hidden;
 * the readings are what the ELD recorded, and the flag tells the reviewer not to trust them.
 */
export function telemetryFlags(events: ReadonlyArray<LogEventView>): Map<string, TelemetryFlag> {
  const flags = new Map<string, TelemetryFlag>();
  const lastOdo = new Map<string, { mi: number; at: number }>();
  const lastHours = new Map<string, number>();
  const live = events
    .filter((event) => event.recordStatus === RECORD_STATUS.active)
    .slice()
    .sort((a, b) => Date.parse(a.eventDateTime) - Date.parse(b.eventDateTime));

  for (const event of live) {
    const unit = event.vehicleId ?? '';
    const at = Date.parse(event.eventDateTime);
    const flag: TelemetryFlag = {};

    const mi = event.totalVehicleMiles;
    if (mi !== null && mi !== undefined) {
      const previous = lastOdo.get(unit);
      if (previous) {
        const gained = mi - previous.mi;
        const hours = Math.max(0, at - previous.at) / 3_600_000;
        if (gained < -ODOMETER_SLACK_MI) {
          flag.odometer = `Odometer went down by ${Math.round(-gained).toLocaleString('en-US')} mi since the previous record`;
        } else if (gained > MAX_PLAUSIBLE_MPH * hours + ODOMETER_SLACK_MI) {
          flag.odometer = `Odometer jumped ${Math.round(gained).toLocaleString('en-US')} mi in ${formatElapsed(hours)} — not physically possible`;
        }
      }
      lastOdo.set(unit, { mi, at });
    }

    const engine = event.totalEngineHours;
    if (engine !== null && engine !== undefined) {
      const previous = lastHours.get(unit);
      if (previous !== undefined && engine < previous - ENGINE_HOURS_SLACK_H) {
        flag.engineHours = `Engine hours went down from ${previous.toFixed(1)} h`;
      }
      lastHours.set(unit, engine);
    }

    if (flag.odometer || flag.engineHours) flags.set(event.id, flag);
  }
  return flags;
}

function formatElapsed(hours: number): string {
  const minutes = Math.round(hours * 60);
  return minutes < 60 ? `${minutes} min` : `${(hours).toFixed(1)} h`;
}
