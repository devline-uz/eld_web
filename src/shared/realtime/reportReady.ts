// owner: web-realtime — shell-level `report.ready` (web/tz.md §7.3 row, §13.3 toast).
//
// Since B-49 the worker's `report.ready` reaches the API gateway over the Redis bridge, so it
// really arrives on the auto-joined `user:{id}` room. The shell handles it on every screen:
//  • always — invalidate every report query and seed `qk.report(id)` with the READY row;
//  • outside `/reports/*` — the `Report ready` toast with `Download` (once per report id).
// Inside `/reports/*` the report screens own the toast (`features/reports/useReportJobs`, which
// also de-duplicates against their 3 s `reportStatus` poll) — the shell stays silent there so a
// report is never announced twice (web/decisions.md WD-094). The poll remains the fallback for a
// frame missed across a reconnect (§7 has no resume/seq).
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { ApiError } from '@/shared/api/errors';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import {
  fetchReport,
  fetchReportDownload,
  fileSizeLabel,
  reportTypeLabel,
  saveFile,
} from '@/shared/api/reportFiles';
import type { ReportRow } from '@/shared/api/reports';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useToast, type ToastInput } from '@/shared/ui/Toast';
import { useRealtimeEvent } from './useRealtimeEvent';

/** Routes whose screens announce READY reports themselves. */
export const REPORT_SCREEN_PREFIX = '/reports';

const announced = new Set<string>();

/** Test hook. */
export function resetShellReportAnnouncements(): void {
  announced.clear();
}

export function shellReportReadyToast(
  report: Pick<ReportRow, 'type' | 'fileSizeBytes'>,
  onDownload: () => void,
): ToastInput {
  const size = fileSizeLabel(report.fileSizeBytes);
  const copy = TOAST_COPY.reportReady(size);
  return {
    kind: 'success',
    title: copy.title,
    description: report.type === 'FMCSA_PACK' ? copy.description : `${reportTypeLabel(report.type)} · ${size}`,
    action: { label: 'Download', altText: `Download ${reportTypeLabel(report.type)}`, onClick: onDownload },
  };
}

function isReportScreen(pathname: string): boolean {
  return pathname === REPORT_SCREEN_PREFIX || pathname.startsWith(`${REPORT_SCREEN_PREFIX}/`);
}

export function useReportReadyShell(): void {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const { toast } = useToast();

  useRealtimeEvent('report.ready', ({ reportId }) => {
    void queryClient.invalidateQueries({ queryKey: qkRoot.reports });
    const screenOwnsToast = isReportScreen(pathname);
    fetchReport(reportId)
      .then((report) => {
        queryClient.setQueryData(qk.report(report.id), report);
        if (screenOwnsToast || report.status !== 'READY' || announced.has(report.id)) return;
        announced.add(report.id);
        toast(
          shellReportReadyToast(report, () => {
            // A fresh presigned URL at click time — never cached (§17).
            fetchReportDownload(report.id)
              .then((file) => saveFile(file.downloadUrl, file.fileName))
              .catch((error: unknown) =>
                toast({
                  kind: 'error',
                  title: error instanceof ApiError ? error.userMessage : TOAST_COPY.networkError.title,
                }),
              );
          }),
        );
      })
      .catch(() => undefined);
  });
}
