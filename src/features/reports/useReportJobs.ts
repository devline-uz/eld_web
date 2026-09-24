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
import { useQueryClient, type UseMutationResult } from '@tanstack/react-query';
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
import { useRealtimeEvent } from '@/shared/realtime/useRealtimeEvent';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useToast, type ToastInput } from '@/shared/ui/Toast';
import { reportLabel, fileSizeLabel, refusalText, saveFile } from './reportMeta';

/**
 * WB-146 — `mutation.isPending` is only true on the NEXT render, so the two clicks of a real
 * double click both land while the button is still enabled and two reports get queued. Disabling
 * the button is therefore necessary but never sufficient: this ref closes the same-tick window,
 * and the flag clears when the mutation settles.
 */
export interface GuardedMutation<TData, TError, TVars> {
  isPending: boolean;
  mutate: (
    variables: TVars,
    options?: { onSuccess?: (data: TData) => void; onError?: (error: TError) => void },
  ) => void;
}

export function useGuardedMutate<TData, TError, TVars, TContext>(
  mutation: UseMutationResult<TData, TError, TVars, TContext>,
): GuardedMutation<TData, TError, TVars> {
  const inFlight = useRef(false);
  return {
    isPending: mutation.isPending,
    mutate: (variables, options) => {
      if (inFlight.current || mutation.isPending) return;
      inFlight.current = true;
      mutation.mutate(variables, {
        onSuccess: options?.onSuccess,
        onError: options?.onError,
        onSettled: () => {
          inFlight.current = false;
        },
      });
    },
  };
}

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
  const queryClient = useQueryClient();
  const announce = useAnnounceReport();

  useRealtimeEvent('report.ready', (payload) => {
    void queryClient.invalidateQueries({ queryKey: qkRoot.reports });
    fetchReport(payload.reportId)
      .then((report) => {
        queryClient.setQueryData(qk.report(report.id), report);
        announce(report);
      })
      .catch(() => undefined);
  });
}

export interface TrackedReportJob {
  /** Follow the job returned by `POST /reports/generate` until it settles. */
  track: (reportId: string) => void;
  /** True while the tracked job is QUEUED/RUNNING — keeps the button in its loading state. */
  isPending: boolean;
  /** The worker's failure, verbatim, until dismissed — rendered by the screen's `ActionAlert`. */
  error: string | null;
  clearError: () => void;
}

/**
 * WB-166 — `Generate report` / `Download PDF` used to give no on-screen confirmation at all:
 * `generate.isPending` cleared the moment the `POST` resolved and the only completion signal was
 * the `report.ready` socket event, which never arrives in mock (`src/mocks/dev/fakeSocket.ts`) and
 * can be missed on a reconnect in production (§7 has no resume/seq). This follows the queued job
 * with the named `reportStatus` policy (3 s, stops at READY/FAILED) and announces it exactly like
 * the FMCSA pack does, so the toast fires whichever signal lands first — `useAnnounceReport`
 * de-duplicates per report id.
 */
export function useTrackedReport(): TrackedReportJob {
  const [reportId, setReportId] = useState<string | null>(null);
  const [dismissedFailure, setDismissedFailure] = useState<string | null>(null);
  const job = useReport(reportId);
  const announce = useAnnounceReport();

  const report = job.data && job.data.id === reportId ? job.data : undefined;

  useEffect(() => {
    if (report) announce(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce is idempotent per report id
  }, [report?.id, report?.status]);

  return {
    track: (id) => {
      setDismissedFailure(null);
      setReportId(id);
    },
    isPending: Boolean(reportId) && (report === undefined || isReportPending(report.status)),
    error:
      report?.status === 'FAILED' && dismissedFailure !== report.id
        ? (report.error ?? 'Report generation failed.')
        : null,
    clearError: () => {
      if (report) setDismissedFailure(report.id);
    },
  };
}

export interface ExportJob {
  start: (input: QueueShortcutInput) => void;
  isPending: boolean;
  /** The server's refusal or the worker's failure, verbatim — rendered in place by the screen. */
  error: string | null;
  clearError: () => void;
}

export interface ExportJobOptions {
  /**
   * B-96 — `Download PDF` / `Download IFTA PDF` moved from `POST /reports/generate` (FULL) to this
   * same READ shortcut with `format=PDF`, but WB-166 still wants the on-screen `Report ready`
   * confirmation those buttons had. `Export CSV` stays silent (its own original behaviour) unless
   * this is set.
   */
  announce?: boolean;
}

export function useExportWhenReady(options: ExportJobOptions = {}): ExportJob {
  const queue = useQueueReport();
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedFailure, setDismissedFailure] = useState<string | null>(null);
  const job = useReport(reportId);
  const downloaded = useRef<string | null>(null);
  const announce = useAnnounceReport();
  // WB-146 — same-tick guard: `queue.isPending` only flips on the next render.
  const inFlight = useRef(false);

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
    if (options.announce) announce(report);
    fetchReportDownload(report.id)
      .then((file) => saveFile(file.downloadUrl, file.fileName))
      .catch((cause: unknown) => setError(refusalText(cause)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `announce` is idempotent per report id, `options.announce` is a caller-fixed flag
  }, [report]);

  return {
    start: (input) => {
      if (inFlight.current || queue.isPending) return;
      inFlight.current = true;
      setError(null);
      queue.mutate(input, {
        onSuccess: (queued) => setReportId(queued.reportId),
        onError: (cause) => setError(refusalText(cause)),
        onSettled: () => {
          inFlight.current = false;
        },
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
