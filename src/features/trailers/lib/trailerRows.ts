// owner: web-vehicles-drivers — Trailers: CSV rows → import payloads.
import type { TrailerPayload } from '@/shared/api/trailers';

/** CSV rows → `ImportTrailersDto.trailers`; blank cells dropped, unknown columns ignored. */
export function toTrailerPayloads(rows: ReadonlyArray<Record<string, string>>): TrailerPayload[] {
  return rows.map((row) => {
    const number = (row.number ?? '').trim();
    const vin = (row.vin ?? '').trim().toUpperCase();
    return vin ? { number, vin } : { number };
  });
}
