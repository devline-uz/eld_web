import { formatCarrierDateTime } from '@/shared/format/datetime';

// LIVE-027 — some server notification bodies embed a raw ISO instant ("…since
// 2026-10-08T09:13:00.000Z"). Rows already stored keep that text, so the panel rewrites any ISO
// timestamp into the carrier zone the rest of the panel uses ("Oct 08, 03:13 MDT").
const ISO_INSTANT = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})\b/g;

export function humanizeTimestamps(text: string, carrierTimezone: string, now: Date = new Date()): string {
  return text.replace(ISO_INSTANT, (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : formatCarrierDateTime(date, carrierTimezone, now);
  });
}
