// owner: web-settings-admin — W-18 Settings · Users (web/tz.md §10 W-18).
// Design: web/roles and screens/admin panel/Settings — back-office users and invitations.jpg
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, UserPlus, Mail, Filter } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { formatRelative } from '@/shared/format/relative';
import { orDash } from '@/shared/format/empty';
import { ApiError } from '@/shared/api/errors';
import { useUsersList, useRolesList, useResendInvite, useUpdateUser, type UserRow } from '@/shared/api/settingsAdmin';
import { ROLE_LABEL, isRole } from '@/shared/auth/permissions';
import { InviteUserModal } from './components/InviteUserModal';
import { UserFiltersDrawer, UserFilterChips } from './components/UserFiltersDrawer';
import { EMPTY_USER_FILTERS, countActiveUserFilters, matchesUserFilters, parseUserFilters, writeUserFilters } from './lib/filters';

type Segment = 'ALL' | 'ADMIN' | 'FLEET_MANAGER' | 'VIEWER';

const ROLE_BADGE_TONE: Record<string, 'violet' | 'info' | 'success' | 'neutral'> = {
  ADMIN: 'violet',
  FLEET_MANAGER: 'info',
  DISPATCHER: 'success',
  VIEWER: 'neutral',
};

const STATUS_TONE = { ACTIVE: 'success', INVITED: 'warning', DISABLED: 'neutral' } as const;
const STATUS_LABEL = { ACTIVE: 'Active', INVITED: 'Invited', DISABLED: 'Disabled' } as const;

export default function UsersPage() {
  const { can } = usePermission();
  const canFull = can('users', 'FULL');
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const usersQuery = useUsersList();
  const rolesQuery = useRolesList();
  const resendInvite = useResendInvite();
  const updateUser = useUpdateUser();

  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  // WB-113 — nothing on the server stops an admin from disabling themself or the last active
  // ADMIN either (this is a UI guard only; the write must also be refused server-side).
  const [blockedDisable, setBlockedDisable] = useState<{ user: UserRow; reason: 'self' | 'lastAdmin' } | null>(null);
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const filters = useMemo(() => parseUserFilters(params), [params]);

  function applyFilters(next: typeof filters) {
    setParams(writeUserFilters(params, next), { replace: true });
  }

  const rows = usersQuery.rows;

  const counts = useMemo(
    () => ({
      all: rows.length,
      admin: rows.filter((r) => r.role.key === 'ADMIN').length,
      fleetManager: rows.filter((r) => r.role.key === 'FLEET_MANAGER').length,
      viewer: rows.filter((r) => r.role.key === 'VIEWER').length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (segment === 'ADMIN') out = out.filter((r) => r.role.key === 'ADMIN');
    if (segment === 'FLEET_MANAGER') out = out.filter((r) => r.role.key === 'FLEET_MANAGER');
    if (segment === 'VIEWER') out = out.filter((r) => r.role.key === 'VIEWER');
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      out = out.filter(
        (r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle),
      );
    }
    out = out.filter((r) => matchesUserFilters(r, filters));
    return out;
  }, [rows, segment, search, filters]);

  const pending = rows.filter((r) => r.status === 'INVITED');

  // WB-113 — count of active ADMIN accounts, to refuse disabling the last one.
  const activeAdminCount = rows.filter((r) => r.role.key === 'ADMIN' && r.status === 'ACTIVE').length;

  function handleDisableToggle(user: UserRow) {
    const nextStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    updateUser.mutate(
      { id: user.id, dto: { status: nextStatus } },
      {
        onSuccess: () => toast({ kind: 'success', title: nextStatus === 'DISABLED' ? 'User disabled' : 'User enabled' }),
        onError: (error) =>
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  // WB-113 — refuse in the UI, with a clear reason, rather than disabling yourself or the last
  // active admin in one click. Enabling a disabled user is never blocked.
  function attemptDisableToggle(user: UserRow) {
    const nextStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    if (nextStatus === 'DISABLED') {
      if (currentUser && user.id === currentUser.id) {
        setBlockedDisable({ user, reason: 'self' });
        return;
      }
      if (user.role.key === 'ADMIN' && user.status === 'ACTIVE' && activeAdminCount <= 1) {
        setBlockedDisable({ user, reason: 'lastAdmin' });
        return;
      }
    }
    handleDisableToggle(user);
  }

  function handleResendInvite(user: UserRow) {
    resendInvite.mutate(user.id, {
      onSuccess: () => toast({ kind: 'success', title: 'Invitation resent', description: `A new invite was sent to ${user.email}.` }),
      onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
    });
  }

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      id: 'user',
      header: 'USER',
      cell: ({ row }) => {
        const name = `${row.original.firstName} ${row.original.lastName}`;
        return (
          <span className="flex items-center gap-3 py-1">
            <Avatar name={name} size="md" />
            <span>
              <span className="block text-body-strong text-text">{name}</span>
              <span className="block text-caption text-text-muted">{row.original.email}</span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'role',
      header: 'ROLE',
      cell: ({ row }) => {
        const key = row.original.role.key;
        return <Badge tone={ROLE_BADGE_TONE[key] ?? 'neutral'}>{ROLE_LABEL[isRole(key) ? key : 'VIEWER'] ?? row.original.role.name}</Badge>;
      },
    },
    {
      id: 'terminal',
      header: 'TERMINAL',
      cell: ({ row }) => <span className="text-text">{row.original.homeTerminalName ?? 'All terminals'}</span>,
    },
    {
      id: 'lastActive',
      header: 'LAST ACTIVE',
      cell: ({ row }) => <span className="text-text-secondary">{orDash(row.original.lastActiveAt, formatRelative)}</span>,
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: ({ row }) => <Badge tone={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
    },
  ];

  const isLoading = usersQuery.isLoading || rolesQuery.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Users</h1>
          <p className="text-page-sub text-text-muted">
            {counts.all} back-office users · {counts.admin} admins
          </p>
        </div>
        <Can perm="users" level="FULL">
          <Button variant="primary" iconLeft={<UserPlus size={16} strokeWidth={1.75} />} onClick={() => setInviteOpen(true)}>
            Invite user
          </Button>
        </Can>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['ALL', `All ${counts.all}`],
              ['ADMIN', `Admins ${counts.admin}`],
              ['FLEET_MANAGER', `Fleet managers ${counts.fleetManager}`],
              ['VIEWER', `Viewers ${counts.viewer}`],
            ] as [Segment, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={segment === value}
              onClick={() => setSegment(value)}
              className={
                segment === value
                  ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                  : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user or email…"
              className="w-64 bg-transparent text-body outline-none"
            />
          </div>
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters{countActiveUserFilters(filters) > 0 ? ` · ${countActiveUserFilters(filters)}` : ''}
          </Button>
        </div>
      </div>

      <UserFilterChips
        filters={filters}
        onRemove={(patch) => applyFilters({ ...filters, ...patch })}
        onClearAll={() => applyFilters(EMPTY_USER_FILTERS)}
      />

      <Card padded={false}>
        {isLoading ? (
          <LoadingState className="p-4" />
        ) : usersQuery.isError ? (
          <ErrorState onRetry={() => usersQuery.refetch()} />
        ) : filtered.length === 0 ? (
          search || countActiveUserFilters(filters) > 0 ? (
            <EmptyState
              {...searchEmptyState(search || 'these filters')}
              actions={[
                {
                  label: search ? 'Clear search' : 'Clear filters',
                  onClick: () => (search ? setSearch('') : applyFilters(EMPTY_USER_FILTERS)),
                },
              ]}
            />
          ) : (
            <EmptyState title="No users yet" description="Invite your first back-office user." />
          )
        ) : (
          <DataTable
            data={filtered}
            columns={columns}
            caption="Users"
            getRowId={(r) => r.id}
            rowActions={
              canFull
                ? (row) => (
                    <>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Edit user
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Change role
                      </DropdownMenu.Item>
                      {row.status === 'INVITED' && (
                        <DropdownMenu.Item
                          onSelect={() => handleResendInvite(row)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                        >
                          Resend invitation
                        </DropdownMenu.Item>
                      )}
                      {row.status === 'INVITED' && (
                        <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
                          Revoke invitation
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        onSelect={() => attemptDisableToggle(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                      >
                        {row.status === 'DISABLED' ? 'Enable user' : 'Disable user'}
                      </DropdownMenu.Item>
                    </>
                  )
                : undefined
            }
          />
        )}
      </Card>

      {pending.length > 0 && (
        <Card>
          <SectionHeader
            title="Pending invitations"
            subtitle={`${pending.length} invitation${pending.length === 1 ? '' : 's'} waiting to be accepted`}
            action={
              canFull ? (
                <Button variant="secondary" iconLeft={<Mail size={16} strokeWidth={1.75} />}>
                  Resend all
                </Button>
              ) : undefined
            }
            className="mb-3"
          />
          <div className="flex flex-col gap-2">
            {pending.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={`${user.firstName} ${user.lastName}`} size="md" />
                  <div>
                    <p className="text-body-strong text-text">{user.email}</p>
                    <p className="text-caption text-text-muted">
                      {user.role.name} · {user.homeTerminalName ?? 'All terminals'}
                      {user.invitedByName ? ` · invited by ${user.invitedByName}` : ''}
                      {user.invitedAt ? ` on ${orDash(user.invitedAt, (d) => formatRelative(d))}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="warning">Invited</Badge>
                  {canFull && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleResendInvite(user)}>
                        Resend
                      </Button>
                      <Button variant="danger-outline" size="sm">
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {inviteOpen && <InviteUserModal roles={rolesQuery.rows} onClose={() => setInviteOpen(false)} />}

      <UserFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
      />

      {/* WB-113 — refusal, not a confirmation: neither case has a path forward from here. */}
      <Modal
        open={Boolean(blockedDisable)}
        onClose={() => setBlockedDisable(null)}
        title="Can't disable this user"
        size="sm"
        footer={
          <Button variant="secondary" size="lg" onClick={() => setBlockedDisable(null)}>
            Close
          </Button>
        }
      >
        <p className="text-body text-text-secondary">
          {blockedDisable?.reason === 'self'
            ? 'You cannot disable your own account. Ask another admin to do this.'
            : 'This is the last active admin. Promote another user to Admin before disabling this account.'}
        </p>
      </Modal>
    </div>
  );
}
