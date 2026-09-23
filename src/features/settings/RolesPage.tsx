// owner: web-settings-admin — W-19 Settings · Roles & permissions (web/tz.md §10 W-19).
// Design: web/roles and screens/admin panel/Settings — permission matrix across roles.jpg
import { Fragment, useMemo, useState } from 'react';
import { Plus, RefreshCw, Check, Eye, Minus, Search } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { formatCarrier } from '@/shared/format/datetime';
import {
  useRolesList,
  useUpdateRole,
  useDeleteRole,
  useAuditLog,
  useCarrier,
  type RoleRow,
} from '@/shared/api/settingsAdmin';
import type { PermissionKey, PermissionLevel, Role } from '@/shared/auth/permissions';
import { ROLE_PERMISSIONS, isRole } from '@/shared/auth/permissions';
import { PERMISSION_MATRIX_GROUPS } from './components/permissionMatrix';
import { CreateRoleModal } from './components/CreateRoleModal';
import { SETTINGS_TOAST } from './lib/copy';

type Tab = 'matrix' | 'roles' | 'access-log';

const NEXT_LEVEL: Record<PermissionLevel, PermissionLevel> = { NONE: 'READ', READ: 'FULL', FULL: 'NONE' };

const ROLE_COLUMNS: { key: RoleRow['key']; label: string }[] = [
  { key: 'ADMIN', label: 'ADMIN' },
  { key: 'FLEET_MANAGER', label: 'FLEET MANAGER' },
  { key: 'DISPATCHER', label: 'DISPATCHER' },
  { key: 'VIEWER', label: 'VIEWER' },
];

function LevelIcon({ level }: { level: PermissionLevel }) {
  if (level === 'FULL') return <Check size={16} strokeWidth={2} className="mx-auto text-success" />;
  if (level === 'READ') return <Eye size={16} strokeWidth={1.75} className="mx-auto text-warning" />;
  return <Minus size={16} strokeWidth={1.75} className="mx-auto text-text-muted" />;
}

const LEVEL_NAME: Record<PermissionLevel, string> = {
  FULL: 'Full access',
  READ: 'Read only',
  NONE: 'No access',
};

export default function RolesPage() {
  const { can } = usePermission();
  const canFull = can('roles', 'FULL');
  const { toast } = useToast();
  const rolesQuery = useRolesList();
  const carrierQuery = useCarrier();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [tab, setTab] = useState<Tab>('matrix');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const roles = rolesQuery.rows;
  const roleByKey = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r])), [roles]);
  const userCount = roles.reduce((sum, r) => sum + (r.userCount ?? 0), 0);

  const auditLogQuery = useAuditLog({ objectType: 'Role', limit: 25 });

  function cycleCell(roleKey: string, keys: PermissionKey[]) {
    const role = roleByKey[roleKey];
    const firstKey = keys[0];
    // Only the ADMIN column is locked (§11.19, the "Admin cannot be edited" chip) — the backend
    // marks all four seeded roles `isSystem: true`, so gating on that flag here would have also
    // silently no-opped clicks on the FLEET_MANAGER/DISPATCHER/VIEWER columns the design and the
    // `isAdminCol` disabled-state below both treat as editable (web/bugs.md WB-033).
    if (!role || role.key === 'ADMIN' || !firstKey) return;
    const current = role.permissions[firstKey] ?? 'NONE';
    const next = NEXT_LEVEL[current];
    const permissions = { ...role.permissions };
    for (const k of keys) permissions[k] = next;
    updateRole.mutate(
      { id: role.id, dto: { permissions } },
      {
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  /**
   * WB-209 — `Reset to defaults` puts the three editable built-in columns back to the shipped
   * permission maps in `shared/auth/permissions.ts` (the same table the client enforces with).
   * There is no bulk endpoint, so it fans out one `PATCH /roles/:id` per role; ADMIN is never
   * touched (§11.19) and custom roles are left alone. A partial failure is reported as one.
   */
  async function resetToDefaults() {
    if (resetting) return;
    const targets = roles.filter((r) => r.key !== 'ADMIN' && isRole(r.key));
    if (targets.length === 0) {
      setConfirmReset(false);
      return;
    }
    setResetting(true);
    const results = await Promise.allSettled(
      targets.map((r) => updateRole.mutateAsync({ id: r.id, dto: { permissions: ROLE_PERMISSIONS[r.key as Role] } })),
    );
    setResetting(false);
    setConfirmReset(false);
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) {
      toast({ kind: 'success', ...SETTINGS_TOAST.permissionsReset });
      return;
    }
    toast({ kind: 'error', ...SETTINGS_TOAST.permissionsResetFailed(failed, targets.length) });
  }

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return PERMISSION_MATRIX_GROUPS;
    const needle = search.trim().toLowerCase();
    return PERMISSION_MATRIX_GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => r.label.toLowerCase().includes(needle)) })).filter(
      (g) => g.rows.length > 0,
    );
  }, [search]);

  if (rolesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingState rows={8} />
      </div>
    );
  }

  if (rolesQuery.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => rolesQuery.refetch()} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Roles & permissions</h1>
          <p className="text-page-sub text-text-muted">
            {roles.length} roles · {userCount} users assigned
          </p>
        </div>
        <Can perm="roles" level="FULL">
          <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
            Create role
          </Button>
        </Can>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['matrix', 'Permission matrix'],
              ['roles', 'Roles'],
              ['access-log', 'Access log'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                  : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
              }
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'matrix' && (
          <div className="flex items-center gap-2">
            <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
              <Search size={16} strokeWidth={1.75} className="text-text-muted" />
              <input
                type="search"
                aria-label="Search permission"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permission…"
                className="w-56 bg-transparent text-body outline-none"
              />
            </div>
            {canFull && (
              <Button
                variant="secondary"
                iconLeft={<RefreshCw size={16} strokeWidth={1.75} />}
                loading={resetting}
                disabled={resetting}
                onClick={() => setConfirmReset(true)}
              >
                Reset to defaults
              </Button>
            )}
          </div>
        )}
      </div>

      {tab === 'matrix' && (
        <Card padded={false}>
          <div className="flex items-center justify-between p-card pb-0">
            <SectionHeader title="Permission matrix" subtitle="Changes apply immediately to every user with that role" />
            <span className="h-6 shrink-0 rounded-md bg-bg-subtle px-2 text-caption leading-6 text-text-muted">
              Admin cannot be edited
            </span>
          </div>
          <table className="mt-4 w-full border-collapse text-body">
            <thead className="h-table-head">
              <tr className="border-b border-border">
                <th className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted">
                  PERMISSION
                </th>
                {ROLE_COLUMNS.map((c) => (
                  <th key={c.key} className="w-32 px-3 text-center text-table-head font-semibold uppercase tracking-wide text-text-muted">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <Fragment key={group.title}>
                  <tr className="bg-bg-subtle">
                    <td colSpan={5} className="px-3 py-1.5 text-table-head font-semibold uppercase tracking-wide text-text-muted">
                      {group.title}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.id} className="h-row border-b border-border">
                      <td className="px-3 text-text">{row.label}</td>
                      {ROLE_COLUMNS.map((c) => {
                        const role = roleByKey[c.key];
                        const primaryKey = row.keys[0] as PermissionKey;
                        const level = role?.permissions[primaryKey] ?? 'NONE';
                        const isAdminCol = c.key === 'ADMIN';
                        return (
                          <td key={c.key} className="px-3 text-center">
                            <button
                              type="button"
                              disabled={isAdminCol || !canFull}
                              title={isAdminCol ? 'Admin cannot be edited' : undefined}
                              aria-label={`${row.label} — ${c.label}: ${LEVEL_NAME[level]}`}
                              onClick={() => cycleCell(c.key, row.keys)}
                              className="mx-auto flex size-7 items-center justify-center rounded-md hover:bg-bg-subtle disabled:cursor-not-allowed"
                            >
                              <LevelIcon level={level} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border p-card text-caption text-text-muted">
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Check size={14} className="text-success" /> Full access
              </span>
              <span className="flex items-center gap-1">
                <Eye size={14} className="text-warning" /> Read only
              </span>
              <span className="flex items-center gap-1">
                <Minus size={14} className="text-text-muted" /> No access
              </span>
            </span>
            {/* WB-233 — a "Last changed by <carrier name> · <today>" line used to sit here, built
                from `new Date()` and the carrier name. The role DTO has no updatedAt/updatedBy,
                so it is removed; the Access log tab carries the real change history. */}
          </div>
        </Card>
      )}

      {tab === 'roles' && (
        <div className="grid grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-card-title font-semibold text-text">{role.name}</p>
                  <p className="text-card-sub text-text-muted">{role.description || '—'}</p>
                  <p className="mt-2 text-caption text-text-muted">{role.userCount ?? 0} users</p>
                </div>
                {role.isSystem ? (
                  <Badge tone="neutral">System role</Badge>
                ) : (
                  canFull && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditTarget(role)}>
                        Edit
                      </Button>
                      <Button variant="danger-outline" size="sm" onClick={() => setDeleteTarget(role)}>
                        Delete
                      </Button>
                    </div>
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'access-log' && (
        <Card padded={false}>
          {auditLogQuery.isLoading ? (
            <LoadingState className="p-4" />
          ) : auditLogQuery.isError ? (
            <ErrorState onRetry={() => auditLogQuery.refetch()} />
          ) : (auditLogQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No events match these filters" description="Try a wider date range or clear the filters." />
          ) : (
            <table className="w-full border-collapse text-body">
              <thead className="h-table-head">
                <tr className="border-b border-border">
                  <th className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted">TIMESTAMP</th>
                  <th className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted">ACTION</th>
                  <th className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted">OBJECT</th>
                </tr>
              </thead>
              <tbody>
                {auditLogQuery.data?.items.map((entry) => (
                  <tr key={entry.id} className="h-row border-b border-border last:border-0">
                    <td className="px-3 tabular-nums text-text">
                      {formatCarrier(entry.createdAt, carrierQuery.data?.timezone ?? 'UTC', 'dateTimeSeconds')}
                    </td>
                    <td className="px-3">
                      <Badge tone={entry.action === 'DELETE' ? 'danger' : entry.action === 'CREATE' ? 'success' : 'info'}>
                        {entry.action}
                      </Badge>
                    </td>
                    <td className="px-3 text-text">{entry.objectLabel ?? entry.objectType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {createOpen && <CreateRoleModal templates={roles} onClose={() => setCreateOpen(false)} />}
      {editTarget && <CreateRoleModal templates={roles} role={editTarget} onClose={() => setEditTarget(null)} />}
      <ConfirmDelete
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void resetToDefaults()}
        title="Reset permissions to defaults?"
        description="Fleet manager, Dispatcher and Viewer go back to the permissions OneBook ships with. Admin and any custom roles are left unchanged. Users keep their role — only what that role can do changes."
        confirmLabel="Reset to defaults"
        loading={resetting}
      />
      <ConfirmDelete
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRole.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast({ kind: 'success', title: `Role ${deleteTarget.name} deleted` });
              setDeleteTarget(null);
            },
            onError: (error) => {
              toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
              setDeleteTarget(null);
            },
          });
        }}
        title={`Delete ${deleteTarget?.name ?? 'role'}?`}
        description="Users with this role keep their access until reassigned. This cannot be undone."
        loading={deleteRole.isPending}
      />
    </div>
  );
}
