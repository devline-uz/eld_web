// owner: web-reports-transfer — W-12…W-14 `Scheduled reports` (GET/PATCH/DELETE /reports/schedules).
//
// QA fix (web/bugs.md): schedules could be created but never listed, edited, paused or deleted.
// `Edit` reuses `ScheduleReportModal` in edit mode; `Pause`/`Resume` is `PATCH { enabled }`;
// `Delete` confirms first and says what survives (§5.9). Row actions exist only for `reports` FULL.
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { usePermission } from '@/shared/auth/usePermission';
import {
  useDeleteReportSchedule,
  useReportSchedules,
  useUpdateReportSchedule,
  type ReportScheduleRow,
} from '@/shared/api/reports';
import { formatCarrier } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { TOAST_COPY } from '@/shared/ui/copy';
import { DataTable } from '@/shared/ui/DataTable';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { REPORT_LABEL, frequencyLabel, refusalText } from '../reportMeta';
import { ActionAlert } from './ActionAlert';
import { ScheduleReportModal } from './ScheduleReportModal';

const ITEM = 'cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle';
const DANGER_ITEM = 'cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft';

export interface ScheduledReportsCardProps {
  /** Carrier zone — `NEXT RUN` is company time (§8.3). */
  timezone: string;
}

export function ScheduledReportsCard({ timezone }: ScheduledReportsCardProps) {
  const { can } = usePermission();
  const canFull = can('reports', 'FULL');
  const { toast } = useToast();
  const list = useReportSchedules();
  const toggle = useUpdateReportSchedule();
  const remove = useDeleteReportSchedule();
  const [editTarget, setEditTarget] = useState<ReportScheduleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportScheduleRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<ReportScheduleRow, unknown>[]>(
    () => [
      {
        id: 'report',
        header: 'REPORT',
        cell: ({ row }) => <span className="font-semibold text-text">{REPORT_LABEL[row.original.reportType]}</span>,
      },
      { id: 'format', header: 'FORMAT', cell: ({ row }) => row.original.format },
      { id: 'frequency', header: 'FREQUENCY', cell: ({ row }) => frequencyLabel(row.original.cron) },
      {
        id: 'recipients',
        header: 'RECIPIENTS',
        cell: ({ row }) =>
          row.original.recipients.length > 0 ? (
            <span className="break-all">{row.original.recipients.join(', ')}</span>
          ) : (
            <span className="text-text-muted">{EMPTY.dash}</span>
          ),
      },
      {
        id: 'nextRun',
        header: 'NEXT RUN',
        cell: ({ row }) =>
          row.original.enabled && row.original.nextRunAt ? (
            <span className="tabular-nums">{formatCarrier(row.original.nextRunAt, timezone, 'MMM dd, yyyy HH:mm')}</span>
          ) : (
            <span className="text-text-muted">{EMPTY.dash}</span>
          ),
      },
      {
        id: 'status',
        header: 'STATUS',
        cell: ({ row }) =>
          row.original.enabled ? (
            <Badge tone="success" dot>
              Active
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Paused
            </Badge>
          ),
      },
    ],
    [timezone],
  );

  const setEnabled = (row: ReportScheduleRow, enabled: boolean) => {
    setActionError(null);
    const name = REPORT_LABEL[row.reportType];
    toggle.mutate(
      { id: row.id, patch: { enabled } },
      {
        onSuccess: () =>
          toast({ kind: 'success', ...(enabled ? TOAST_COPY.reportScheduleResumed(name) : TOAST_COPY.reportSchedulePaused(name)) }),
        onError: (error) => setActionError(refusalText(error)),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const name = REPORT_LABEL[deleteTarget.reportType];
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ kind: 'success', ...TOAST_COPY.reportScheduleDeleted(name) });
        setDeleteTarget(null);
      },
      onError: (error) => {
        setActionError(refusalText(error));
        setDeleteTarget(null);
      },
    });
  };

  const rows = list.data ?? [];
  return (
    <Card padded={false}>
      <div className="p-card">
        <SectionHeader title="Scheduled reports" subtitle="Delivered by email on every run" />
      </div>
      {actionError && (
        <div className="px-card pb-3">
          <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}
      {list.isError ? (
        <ErrorState
          title="Could not load scheduled reports"
          description={refusalText(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <DataTable
          caption="Scheduled reports"
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          isLoading={list.isLoading}
          rowActions={
            canFull
              ? (row: ReportScheduleRow) => (
                  <>
                    <DropdownMenu.Item onSelect={() => setEditTarget(row)} className={ITEM}>
                      Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setEnabled(row, !row.enabled)} className={ITEM}>
                      {row.enabled ? 'Pause' : 'Resume'}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setDeleteTarget(row)} className={DANGER_ITEM}>
                      Delete
                    </DropdownMenu.Item>
                  </>
                )
              : undefined
          }
          emptyState={
            <EmptyState
              title="No scheduled reports"
              description="Use Schedule a report to email a report on a repeating period."
            />
          }
        />
      )}

      {canFull && editTarget && (
        <ScheduleReportModal
          key={editTarget.id}
          open
          onClose={() => setEditTarget(null)}
          reportType={editTarget.reportType}
          params={editTarget.params}
          timezone={editTarget.timezone}
          schedule={editTarget}
        />
      )}
      {canFull && (
        <ConfirmDelete
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          loading={remove.isPending}
          title={deleteTarget ? `Delete the ${REPORT_LABEL[deleteTarget.reportType]} schedule?` : 'Delete schedule?'}
          description="No more reports will be emailed from this schedule. Reports it already generated stay in Recently generated."
        />
      )}
    </Card>
  );
}
