// owner: web-reports-transfer — W-15 `Previous transfers` (GET /transfers) + transfer detail drawer.
// A row that is not final yet follows `GET /transfers/:id` every 5 s until it is (WB-028).
// `TEST_ONLY` rows read `Test only` — a file that was built but never reached FMCSA.
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Download } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Can } from '@/shared/auth/Can';
import { qkRoot } from '@/shared/api/queryKeys';
import {
  TRANSFER_FINAL_STATUSES,
  downloadTransferFile,
  useTransfer,
  useTransfersList,
  type TransferRow,
} from '@/shared/api/reports';
import { formatCarrier } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { DataTable } from '@/shared/ui/DataTable';
import { Drawer } from '@/shared/ui/Modal';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { TRANSFER_METHOD_LABEL, TRANSFER_RESULT_BADGE, rangeLabel, refusalText, saveFile } from '../reportMeta';
import { ActionAlert } from './ActionAlert';

const dayOf = (iso: string) => iso.slice(0, 10);

function ResultCell({ row, onRetry }: { row: TransferRow; onRetry: (row: TransferRow) => void }) {
  const final = TRANSFER_FINAL_STATUSES.includes(row.status);
  const live = useTransfer(final ? null : row.id);
  const queryClient = useQueryClient();
  const status = live.data?.status ?? row.status;

  useEffect(() => {
    if (!final && live.data && TRANSFER_FINAL_STATUSES.includes(live.data.status)) {
      void queryClient.invalidateQueries({ queryKey: qkRoot.transfers });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the transfer's status only
  }, [live.data?.status]);

  const badge = TRANSFER_RESULT_BADGE[status];
  return (
    <span className="flex items-center justify-end gap-2">
      <Badge tone={badge.tone} dot>
        {badge.label}
      </Badge>
      {status === 'FAILED' && (
        <Can perm="reportsTransfer" level="FULL">
          <Button variant="link" onClick={() => onRetry(row)}>
            Retry
          </Button>
        </Can>
      )}
    </span>
  );
}

export interface PreviousTransfersCardProps {
  timezone: string;
  /** Opens 11.14 pre-filled — the user sends again deliberately; nothing is retried automatically. */
  onRetry: (row: TransferRow) => void;
}

export function PreviousTransfersCard({ timezone, onRetry }: PreviousTransfersCardProps) {
  const { user } = useAuth();
  // Primitives, not the user object: column definitions must stay referentially stable or
  // TanStack Table remounts every cell (and an open drawer loses its trigger).
  const userId = user?.id;
  const userName = user?.fullName;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useTransfersList(expanded ? { page, limit } : { page: 1, limit: 5 });

  const columns = useMemo<ColumnDef<TransferRow, unknown>[]>(
    () => [
      {
        id: 'sentAt',
        header: 'Sent at',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-text">
            {formatCarrier(row.original.sentAt ?? row.original.createdAt, timezone, 'MMM dd, yyyy HH:mm')}
          </span>
        ),
      },
      { id: 'method', header: 'Method', cell: ({ row }) => TRANSFER_METHOD_LABEL[row.original.method] },
      {
        id: 'comment',
        header: 'Comment',
        cell: ({ row }) => (
          <button type="button" className="text-left text-primary hover:underline" onClick={() => setOpenId(row.original.id)}>
            {row.original.outputFileComment || EMPTY.dash}
          </button>
        ),
      },
      {
        id: 'period',
        header: 'Period',
        cell: ({ row }) => <span className="tabular-nums">{rangeLabel(dayOf(row.original.rangeStart), dayOf(row.original.rangeEnd))}</span>,
      },
      {
        id: 'sentBy',
        header: 'Sent by',
        // ⛔ B-46: the row carries `requestedById` only; `/users` is ADMIN-only.
        cell: ({ row }) =>
          userId && userName && row.original.requestedById === userId ? (
            <span className="flex items-center gap-2">
              <Avatar name={userName} size="sm" />
              {userName}
            </span>
          ) : (
            <span className="text-text-muted">{EMPTY.dash}</span>
          ),
      },
      {
        id: 'result',
        header: 'Result',
        meta: { numeric: true },
        cell: ({ row }) => <ResultCell row={row.original} onRetry={onRetry} />,
      },
    ],
    [timezone, userId, userName, onRetry],
  );

  return (
    <Card padded={false}>
      <div className="p-card">
        <SectionHeader
          title="Previous transfers"
          action={
            !expanded ? (
              <Button variant="secondary" iconLeft={<ChevronRight size={16} strokeWidth={1.75} />} onClick={() => setExpanded(true)}>
                View all
              </Button>
            ) : undefined
          }
        />
      </div>
      {list.isError ? (
        <ErrorState title="Could not load transfers" description={refusalText(list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Previous transfers"
            data={list.data?.items ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            isLoading={list.isLoading}
            emptyState={<EmptyState title="No transfers yet" description="Files sent to a safety official are listed here." />}
          />
          {expanded && list.data && list.data.total > 0 && (
            <Pagination
              page={list.data.page}
              limit={limit}
              total={list.data.total}
              totalPages={list.data.totalPages}
              itemLabel="transfers"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </>
      )}
      <TransferDrawer id={openId} timezone={timezone} onClose={() => setOpenId(null)} />
    </Card>
  );
}

function TransferDrawer({ id, timezone, onClose }: { id: string | null; timezone: string; onClose: () => void }) {
  const transfer = useTransfer(id);
  const [error, setError] = useState<string | null>(null);
  const t = transfer.data;
  return (
    <Drawer
      open={Boolean(id)}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Transfer"
      subtitle={t?.fileName}
      footer={
        t ? (
          <Button
            variant="secondary"
            size="lg"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            onClick={() => {
              setError(null);
              downloadTransferFile(t.id)
                .then((blob) => saveFile(blob, t.fileName))
                .catch((cause: unknown) => setError(refusalText(cause)));
            }}
          >
            Download a copy
          </Button>
        ) : undefined
      }
    >
      <ActionAlert message={error} />
      {transfer.isError ? (
        <ErrorState title="Could not load the transfer" description={refusalText(transfer.error)} onRetry={() => void transfer.refetch()} />
      ) : t ? (
        <dl className="flex flex-col gap-3 text-body">
          <Detail label="Result" value={<Badge tone={TRANSFER_RESULT_BADGE[t.status].tone} dot>{TRANSFER_RESULT_BADGE[t.status].label}</Badge>} />
          <Detail label="Method" value={TRANSFER_METHOD_LABEL[t.method]} />
          <Detail label="Comment" value={t.outputFileComment || EMPTY.dash} />
          <Detail label="Period" value={rangeLabel(dayOf(t.rangeStart), dayOf(t.rangeEnd))} />
          <Detail label="eRODS mode" value={t.erodsMode === 'TEST' ? 'TEST' : 'PRODUCTION'} />
          <Detail label="Created" value={formatCarrier(t.createdAt, timezone, 'MMM dd, yyyy HH:mm:ss')} />
          <Detail label="Sent at" value={t.sentAt ? formatCarrier(t.sentAt, timezone, 'MMM dd, yyyy HH:mm:ss') : EMPTY.dash} />
          <Detail label="Reference" value={t.referenceId ?? EMPTY.dash} />
          <Detail label="Response" value={t.responseCode ?? EMPTY.dash} />
          <Detail label="Attempts" value={String(t.attempts)} />
        </dl>
      ) : null}
    </Drawer>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right tabular-nums text-text">{value}</dd>
    </div>
  );
}
