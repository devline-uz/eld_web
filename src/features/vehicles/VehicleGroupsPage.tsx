// owner: web-vehicles-drivers — Vehicle groups (WD-116), beside W-03 Vehicles and Trailers; same
// gate: `vehicles` (READ lists, FULL creates/edits/deletes — backend `VehicleGroupsController`).
// `GET /vehicle-groups` returns the whole list (no paging), so search runs in memory.
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Plus, Search } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useIsOffline, OFFLINE_TOOLTIP } from '@/shared/realtime/RealtimeProvider';
import { usePageHeader } from '@/app/layouts/Topbar';
import { ApiError } from '@/shared/api/errors';
import {
  useDeleteVehicleGroup,
  useVehicleGroups,
  type VehicleGroupRow,
} from '@/shared/api/vehicles';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { DataTable } from '@/shared/ui/DataTable';
import { InventoryTabs } from '@/shared/ui/InventoryTabs';
import { GroupColorDot } from '@/shared/ui/GroupColor';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, TOAST_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { VehicleGroupModal } from './components/VehicleGroupModal';

const menuItem = 'cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle';

export default function VehicleGroupsPage() {
  const { can } = usePermission();
  const canFull = can('vehicles', 'FULL');
  const isOffline = useIsOffline();
  const { toast } = useToast();
  const list = useVehicleGroups();
  const groups = useMemo(() => list.data ?? [], [list.data]);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<VehicleGroupRow | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<VehicleGroupRow | null>(null);
  const deleteMutation = useDeleteVehicleGroup();

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? groups.filter(
            (g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q),
          )
        : groups,
    [groups, q],
  );

  usePageHeader({
    title: 'Vehicle groups',
    subtitle: list.isSuccess
      ? `${groups.length} group${groups.length === 1 ? '' : 's'}`
      : undefined,
  });

  const columns: ColumnDef<VehicleGroupRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'GROUP',
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <GroupColorDot color={row.original.color} />
          <span className="font-semibold text-text">{row.original.name}</span>
        </span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'DESCRIPTION',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-text-secondary">{row.original.description || '—'}</span>
      ),
    },
    {
      accessorKey: 'vehicleCount',
      header: 'UNITS',
      cell: ({ row }) => (
        <span className="tabular-nums text-text">{row.original.vehicleCount}</span>
      ),
    },
  ];

  function confirmDelete() {
    if (!deleteGroup || deleteMutation.isPending) return;
    const group = deleteGroup;
    deleteMutation.mutate(group.id, {
      onSuccess: () => {
        toast({ kind: 'success', ...TOAST_COPY.vehicleGroupDeleted(group.name) });
        setDeleteGroup(null);
      },
      onError: (error) => {
        toast({
          kind: 'error',
          title: error instanceof ApiError ? error.userMessage : 'Something went wrong.',
        });
      },
    });
  }

  if (list.error instanceof ApiError && list.error.isForbidden)
    return <ForbiddenState screenName="Vehicle groups" />;

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-between xl:shrink-0">
        <InventoryTabs />
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search group name…"
              aria-label="Search group name"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <Can perm="vehicles" level="FULL">
            <Button
              variant="primary"
              className="w-btn-add"
              iconLeft={<Plus size={16} strokeWidth={1.75} />}
              onClick={() => setCreateOpen(true)}
              disabled={isOffline}
              title={isOffline ? OFFLINE_TOOLTIP : undefined}
            >
              New group
            </Button>
          </Can>
        </div>
      </div>

      <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
        {list.isPending ? (
          <LoadingState className="p-4" />
        ) : list.isError ? (
          <ErrorState
            title="Could not load vehicle groups"
            description="The group list did not load. Your data is safe — try again in a moment."
            onRetry={() => void list.refetch()}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            {...EMPTY_STATE_COPY.vehicleGroups}
            actions={
              canFull ? [{ label: 'New group', onClick: () => setCreateOpen(true) }] : undefined
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            {...searchEmptyState(search.trim())}
            description="Check the spelling or try another group name."
            actions={[{ label: 'Clear search', onClick: () => setSearch('') }]}
          />
        ) : (
          <div className="xl:min-h-0 xl:overflow-y-auto">
            <DataTable
              data={rows}
              columns={columns}
              caption="Vehicle groups"
              getRowId={(r) => r.id}
              rowActions={
                canFull
                  ? (row) => (
                      <>
                        <DropdownMenu.Item onSelect={() => setEditGroup(row)} className={menuItem}>
                          Edit group
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="my-1 h-px bg-border" />
                        <DropdownMenu.Item
                          onSelect={() => setDeleteGroup(row)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                        >
                          Delete group
                        </DropdownMenu.Item>
                      </>
                    )
                  : undefined
              }
            />
          </div>
        )}
      </Card>

      {createOpen && <VehicleGroupModal groups={groups} onClose={() => setCreateOpen(false)} />}
      {editGroup && (
        <VehicleGroupModal group={editGroup} groups={groups} onClose={() => setEditGroup(null)} />
      )}
      {deleteGroup && (
        <ConfirmDelete
          open
          onClose={() => setDeleteGroup(null)}
          onConfirm={confirmDelete}
          loading={deleteMutation.isPending}
          title={`Delete group ${deleteGroup.name}?`}
          description={`The group is removed from the IFTA and Activity report filters. Its ${deleteGroup.vehicleCount} unit${deleteGroup.vehicleCount === 1 ? '' : 's'} stay in the fleet, ungrouped, and their logs and reports are kept.`}
          confirmLabel="Delete group"
        />
      )}
    </div>
  );
}
