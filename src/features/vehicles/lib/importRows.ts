// owner: web-vehicles-drivers — 11.6 Import vehicles: CSV rows → `POST /vehicles/import` rows.
import type { ApiError } from '@/shared/api/errors';

const NUMERIC_COLUMNS = new Set(['year', 'odometerMi']);

/**
 * QA-B — `parseCsv` yields strings only, and `POST /vehicles/import` validates `year`/`odometerMi`
 * as numbers, so every import (even the downloaded template) came back `422 VALIDATION_FAILED`.
 * Blank cells are dropped so the server defaults apply; a non-numeric value is sent as typed so
 * the server's per-row 422 still names it.
 */
export function normalizeImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(row)) {
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === '' || value === undefined || value === null) continue;
    if (NUMERIC_COLUMNS.has(key) && typeof value === 'string' && /^-?\d+$/.test(value)) {
      out[key] = Number(value);
    } else if (key === 'fuelType' && typeof value === 'string') {
      out[key] = value.toUpperCase();
    } else if (key === 'sleeperBerth' && typeof value === 'string') {
      out[key] = /^(true|yes|1)$/i.test(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** `vehicles.0.year` → `Row 1 · year: Expected number, received string`. */
export function importIssues(err: ApiError): string[] {
  const issues = err.details.issues;
  if (!Array.isArray(issues)) return [];
  return issues.slice(0, 5).map((issue) => {
    const { path, message } = issue as { path?: unknown; message?: unknown };
    const parts = (Array.isArray(path) ? path.join('.') : String(path ?? '')).split('.');
    const rowIndex = parts[0] === 'vehicles' ? Number(parts[1]) : NaN;
    const field = parts.slice(2).join('.');
    const where = Number.isFinite(rowIndex) ? `Row ${rowIndex + 1}${field ? ` · ${field}` : ''}` : parts.join('.');
    return `${where}: ${String(message ?? 'Invalid value')}`;
  });
}
