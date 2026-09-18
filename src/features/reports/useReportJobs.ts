// owner: web-reports-transfer — the asynchronous side of every report screen.
//
//  • `useReportReadyToasts` subscribes to `user:{id}` for the screen's lifetime (§7.5) and turns
//    `report.ready` into the `Report ready` toast (§13.3).
//  • `useExportWhenReady` queues a job, follows it with the named `reportStatus` policy (3 s, stops
//    at READY/FAILED) and saves the file once it is READY — the `Export CSV` button.
//
// ⚠️ The §13.3 toast carries a `Download` action, but `ToastInput` (shared/ui/Toast.tsx) has no
// action slot yet — hand-off to web-design-system, recorded in web/decisions.md WD-041. Until then
// the READY row in `Recently generated` carries the download.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import {
  fetchReport,
  fetchReportDownload,
  isReportPending,
  useQueueReport,
  useReport,
  type QueueShortcutInput,
  type ReportRow,
} from '@/shared/api/reports';
import { useRoom } from '@/shared/realtime/useRoom';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useToast, type ToastInput } from '@/shared/ui/Toast';
import { reportLabel, fileSizeLabel, refusalText, saveFile } from './reportMeta';

/** A report is announced once per session, whether WS or polling saw READY first. */
const announced = new Set<string>();

export function resetAnnouncedReports(): void {
  announced.clear();
}

export function reportReadyToast(
  report: Pick<ReportRow, 'type' | 'fileSizeBytes'>,
  onDownload: () => void,
): ToastInput {
  const size = fileSizeLabel(report.fileSizeBytes);
  const copy = TOAST_COPY.reportReady(size);
  return {
    kind: 'success',
    title: copy.title,
    description: report.type === 'FMCSA_PACK' ? copy.description : `${reportLabel(report.type)} · ${size}`,
    // §13.3 — `Download` fetches a fresh presigned URL at click time (GET /reports/:id/download).
    action: { label: 'Download', altText: `Download ${reportLabel(report.type)}`, onClick: onDownload },
  };
}

/** Announces a READY report once per session — used by the WS handler and the 3 s poll fallback. */
export function useAnnounceReport() {
  const { toast } = useToast();
  return (report: ReportRow) => {
    if (report.status !== 'READY' || announced.has(report.id)) return;
    announced.add(report.id);
    toast(
      reportReadyToast(report, () => {
        fetchReportDownload(report.id)
          .then((file) => saveFile(file.downloadUrl, file.fileName))
          .catch((error: unknown) => toast({ kind: 'error', title: refusalText(error) }));
      }),
    );
  };
}

export function useReportReadyToasts(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const announce = useAnnounceReport();

  useRoom(user ? `user:${user.id}` : null, {
    'report.ready': (payload) => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.reports });
      fetchReport(payload.reportId)
        .then((report) => {
          queryClient.setQueryData(qk.report(report.id), report);
          announce(report);
        })
        .catch(() => undefined);
    },
  });
}

export interface ExportJob {
  start: (input: QueueShortcutInput) => void;
  isPending: boolean;
  /** The server's refusal or the worker's failure, verbatim — rendered in place by the screen. */
  error: string | null;
  clearError: () => void;
}

export function useExportWhenReady(): ExportJob {
  const queue = useQueueReport();
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedFailure, setDismissedFailure] = useState<string | null>(null);
  const job = useReport(reportId);
  const downloaded = useRef<string | null>(null);

  const report = job.data && job.data.id === reportId ? job.data : undefined;
  const settled = Boolean(report && !isReportPending(report.status));
  const failure =
    report?.status === 'FAILED' && dismissedFailure !== report.id
      ? (report.error ?? 'Report generation failed.')
      : null;

  // Side effect only: save the file once the polled job is READY. State changes happen in the
  // async callback, never synchronously in the effect body.
  useEffect(() => {
    if (!report || report.status !== 'READY' || downloaded.current === report.id) return;
    downloaded.current = report.id;
    fetchReportDownload(report.id)
      .then((file) => saveFile(file.downloadUrl, file.fileName))
      .catch((cause: unknown) => setError(refusalText(cause)));
  }, [report]);

  return {
    start: (input) => {
      setError(null);
      queue.mutate(input, {
        onSuccess: (queued) => setReportId(queued.reportId),
        onError: (cause) => setError(refusalText(cause)),
      });
    },
    isPending: queue.isPending || (Boolean(reportId) && !settled),
    error: error ?? failure,
    clearError: () => {
      setError(null);
      if (report) setDismissedFailure(report.id);
    },
  };
}
