// owner: web-hos-logs — LIVE-005: the "Recorded by ELD …" line of the 24-hour grid header.
import { EMPTY } from '@/shared/format';
import type { RecordingEld } from '@/shared/api/hosLogs';

function eldLabel(eld: RecordingEld): string {
  const unit = eld.unitNumber ? `Unit #${eld.unitNumber.replace(/^#+/, '')}` : null;
  if (eld.serial) return unit ? `${eld.serial} (${unit})` : eld.serial;
  return `${unit ?? EMPTY.dash} (no ELD paired)`;
}

/**
 * Appendix A §4.8 — the ELD identifier the day was recorded on, from the log-day payload.
 * `undefined` (still loading, or an older server) says nothing rather than "Not assigned".
 */
export function recordedBySubtitle(recordedBy: RecordingEld[] | undefined, zone: string): string {
  const zonePart = `all times ${zone}`;
  if (recordedBy === undefined) return `Recorded by ELD ${EMPTY.dash} · ${zonePart}`;
  if (recordedBy.length === 0) return `No ELD records on this day · ${zonePart}`;
  return `Recorded by ELD ${recordedBy.map(eldLabel).join(', ')} · ${zonePart}`;
}
