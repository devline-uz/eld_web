// owner: web-architect — report-file helpers needed outside `features/reports` (the shell's
// `report.ready` toast, web/tz.md §7.3 / §13.3). `features/reports/reportMeta.ts` still carries its
// own copies of these three; it should re-export from here (hand-off in web/decisions.md WD-094).
import type { ReportDownload, ReportRow, ReportType } from './reports';
import { client } from './client';
import { endpoints } from './endpoints';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  IFTA: 'IFTA mileage report',
  ACTIVITY: 'Activity report',
  DVIR: 'DVIR report',
  FMCSA_PACK: 'FMCSA audit pack',
  UNIDENTIFIED: 'Unidentified driving report',
  SAFETY: 'Safety report',
  RODS: 'Driver logs (RODS)',
  IDLE_FUEL: 'Idle & fuel report',
};

export function reportTypeLabel(type: string): string {
  return (REPORT_TYPE_LABEL as Record<string, string | undefined>)[type] ?? type;
}

/** `2.4 MB` — the size in the `Report ready` toast. */
export function fileSizeLabel(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isSameOrigin(href: string): boolean {
  try {
    return new URL(href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Hands a file to the browser. A cross-origin presigned URL ignores `download`, so it opens in a
 * new tab (the object's `Content-Disposition` names the file). The URL is never stored or logged.
 */
export function saveFile(source: Blob | string, fileName: string): void {
  const href = typeof source === 'string' ? source : URL.createObjectURL(source);
  const crossOrigin = typeof source === 'string' && !isSameOrigin(href);
  const link = document.createElement('a');
  link.href = href;
  if (crossOrigin) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    link.download = fileName;
    link.rel = 'noopener';
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(href), 0);
}

// WB-249 — moved here from `reports.ts` (which re-exports them) so the shell's `report.ready`
// handler does not hoist the whole reports module, with `drivers.ts` and `hosLogs.ts`, into the
// initial chunk.
/** One-shot read for the `report.ready` handler (the event carries no size). */
export function fetchReport(id: string): Promise<ReportRow> {
  return client.get<ReportRow>(endpoints.reports.detail(id));
}

/** A fresh 7-day presigned URL, fetched at click time — never cached, never logged (§17). */
export function fetchReportDownload(id: string): Promise<ReportDownload> {
  return client.get<ReportDownload>(endpoints.reports.download(id));
}
