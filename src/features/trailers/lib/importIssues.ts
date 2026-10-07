// owner: web-vehicles-drivers — `trailers.0.number` → `Row 1 · number: …` from a 422 `details.issues`.
import type { ApiError } from '@/shared/api/errors';

export function importIssues(err: ApiError): string[] {
  const issues = err.details.issues;
  if (!Array.isArray(issues)) return [];
  return issues.slice(0, 5).map((issue) => {
    const { path, message } = issue as { path?: unknown; message?: unknown };
    const parts = (Array.isArray(path) ? path.join('.') : String(path ?? '')).split('.');
    const rowIndex = parts[0] === 'trailers' ? Number(parts[1]) : NaN;
    const field = parts.slice(2).join('.');
    const where = Number.isFinite(rowIndex) ? `Row ${rowIndex + 1}${field ? ` · ${field}` : ''}` : parts.join('.');
    return `${where}: ${String(message ?? 'Invalid value')}`;
  });
}
