// owner: web-settings-admin — W-21 Settings · Alert rules (web/tz.md §10 W-21).
// Design: web/roles and screens/admin panel/Settings — notification channels and alert rules.jpg
// Q-2 — SMS is permanently disabled here; see the `Notification channels` card below.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Search, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useAlertRulesList, useUpdateAlertRule, useDeleteAlertRule, useCarrier, type AlertRuleRow, type AlertSeverity } from '@/shared/api/settingsAdmin';
import { NewAlertRuleModal } from './components/NewAlertRuleModal';
import { SETTINGS_REASON, SETTINGS_TOAST } from './lib/copy';

type Segment = 'ALL' | 'ACTIVE' | 'MUTED';

const SEVERITY_ICON: Record<AlertSeverity, ReactNode> = {
  CRITICAL: <AlertTriangle size={16} strokeWidth={1.75} className="text-danger" />,
  WARNING: <ShieldCheck size={16} strokeWidth={1.75} className="text-warning" />,
  INFO: <Info size={16} strokeWidth={1.75} className="text-info" />,
};
/** ⛔ GAP B-87 — shown next to the two organisation-level switches. */
const CHANNEL_DISABLED_REASON = SETTINGS_REASON.orgChannels;

const SEVERITY_BG: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-danger-soft',
  WARNING: 'bg-warning-soft',
  INFO: 'bg-info-soft',
};

export default function AlertRulesPage() {
  const { can } = usePermission();
  const canFull = can('alertRules', 'FULL');
  const { toast } = useToast();
  const rulesQuery = useAlertRulesList();
  const carrierQuery = useCarrier();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ rule: AlertRuleRow; mode: 'edit' | 'duplicate' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRuleRow | null>(null);

  const rows = rulesQuery.rows;
  const active = rows.filter((r) => r.enabled).length;
  const muted = rows.length - active;

  const filtered = useMemo(() => {
    let out = rows;
    if (segment === 'ACTIVE') out = out.filter((r) => r.enabled);
    if (segment === 'MUTED') out = out.filter((r) => !r.enabled);
    if (search.trim()) out = out.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));
    return out;
  }, [rows, segment, search]);

  function toggleEnabled(rule: AlertRuleRow) {
    updateRule.mutate(
      { id: rule.id, dto: { enabled: !rule.enabled } },
      { onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Alert rules</h1>
          <p className="text-page-sub text-text-muted">
            {rows.length} rules · {active} active
          </p>
        </div>
        <Can perm="alertRules" level="FULL">
          <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
            New rule
          </Button>
        </Can>
      </div>

      <Card>
        {/* ⛔ GAP B-87 — there is no organisation-level notification-channel resource
            (`GET/PATCH /notification-channels`). The Email and Webhook rows used to be `<span>`s
            painted to look exactly like the working per-rule switch below, so they read as live
            controls and did nothing (WB-216). They are now real, visibly disabled switches with
            the reason on screen, and the Email row shows the carrier's real compliance address
            instead of a hardcoded one. Per-rule delivery is set on each rule. */}
        <SectionHeader
          title="Notification channels"
          subtitle="Set per rule below — organisation-wide channel defaults are not available yet"
          className="mb-3"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-body-strong text-text">Email</p>
              <p className="text-caption text-text-muted">
                {carrierQuery.data?.complianceEmail ?? 'No compliance email set on the company profile'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked
              aria-label="Email channel"
              disabled
              title={CHANNEL_DISABLED_REASON}
              className="relative h-6 w-10 shrink-0 cursor-not-allowed rounded-full bg-primary opacity-60"
            >
              <span className="absolute right-0.5 top-0.5 size-5 rounded-full bg-bg-surface" />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3" title="SMS is not available">
            <div>
              <p className="flex items-center gap-2 text-body-strong text-text">
                <span>SMS</span> <Badge tone="neutral">Not available</Badge>
              </p>
              <p className="text-caption text-text-muted">
                SMS is not part of this product — these alerts are delivered by email instead
              </p>
            </div>
            <span className="relative inline-flex h-6 w-10 cursor-not-allowed items-center rounded-full bg-border opacity-60">
              <span className="absolute left-0.5 size-5 rounded-full bg-bg-surface" />
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-body-strong text-text">Webhook</p>
              <p className="text-caption text-text-muted">Configured under Settings · Integrations</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={false}
              aria-label="Webhook channel"
              disabled
              title={CHANNEL_DISABLED_REASON}
              className="relative h-6 w-10 shrink-0 cursor-not-allowed rounded-full bg-border opacity-60"
            >
              <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-bg-surface" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-caption text-text-muted">{CHANNEL_DISABLED_REASON}</p>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['ALL', `All ${rows.length}`],
              ['ACTIVE', `Active ${active}`],
              ['MUTED', `Muted ${muted}`],
            ] as [Segment, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={segment === value}
              onClick={() => setSegment(value)}
              className={segment === value ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse' : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            type="search"
            aria-label="Search rule"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rule…"
            className="w-56 bg-transparent text-body outline-none"
          />
        </div>
      </div>

      <Card padded={false}>
        <div className="p-card pb-0">
          <SectionHeader title="Rules" subtitle="Evaluated in real time against ELD telemetry" />
        </div>
        {rulesQuery.isLoading ? (
          <LoadingState className="p-4" />
        ) : rulesQuery.isError ? (
          <ErrorState onRetry={() => rulesQuery.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No alert rules yet" description="Create a rule to get notified when telemetry crosses a threshold." />
        ) : (
          <div className="flex flex-col">
            {filtered.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${SEVERITY_BG[rule.severity]}`}>
                  {SEVERITY_ICON[rule.severity]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-body-strong text-text">
                    {rule.name}
                    {rule.channels.includes('IN_APP') && <Badge tone="neutral">In-app</Badge>}
                    {rule.channels.includes('EMAIL') && <Badge tone="neutral">Email</Badge>}
                  </p>
                  <p className="text-caption text-text-muted">{rule.conditions.map((c) => c.event).join(', ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-caption text-text-secondary">{(rule.recipients.roles ?? []).join(', ') || '—'}</p>
                  <Badge tone={rule.enabled ? 'success' : 'neutral'}>{rule.enabled ? 'Active' : 'Muted'}</Badge>
                </div>
                {canFull && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`Enable ${rule.name}`}
                      onClick={() => toggleEnabled(rule)}
                      className={`relative h-6 w-10 rounded-full ${rule.enabled ? 'bg-primary' : 'bg-border'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-bg-surface transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button aria-label="Rule actions" className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle">
                          ⋯
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" className="z-50 min-w-40 rounded-md border border-border bg-bg-surface p-1 shadow-pop">
                          <DropdownMenu.Item
                            onSelect={() => setEditTarget({ rule, mode: 'edit' })}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            Edit rule
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => setEditTarget({ rule, mode: 'duplicate' })}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            Duplicate
                          </DropdownMenu.Item>
                          {/* ⛔ GAP B-9 — `Test rule` needs `POST /alert-rules/:id/test`, which
                              does not exist on the live API; omitted rather than shown disabled. */}
                          {/* ⛔ GAP B-86 — a timed mute needs a `mutedUntil` field on the rule.
                              `PATCH /alert-rules/:id` only has the boolean `enabled`, so a
                              "24 h" mute would never un-mute itself. Disabled with the reason
                              rather than silently muting for ever (WB-218). */}
                          <DropdownMenu.Item
                            disabled
                            className="cursor-not-allowed rounded-md px-2 py-1.5 text-body text-text-muted outline-none"
                          >
                            Mute for 24 h
                          </DropdownMenu.Item>
                          <p className="px-2 pb-1 text-caption text-text-muted">
                            {SETTINGS_REASON.timedMute}
                          </p>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item
                            onSelect={() => setDeleteTarget(rule)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                          >
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {createOpen && <NewAlertRuleModal onClose={() => setCreateOpen(false)} />}
      {editTarget && (
        <NewAlertRuleModal
          key={`${editTarget.mode}-${editTarget.rule.id}`}
          rule={editTarget.rule}
          mode={editTarget.mode}
          onClose={() => setEditTarget(null)}
        />
      )}
      <ConfirmDelete
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRule.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast({ kind: 'success', ...SETTINGS_TOAST.alertRuleDeleted(deleteTarget.name) });
              setDeleteTarget(null);
            },
            onError: (error) => {
              toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
              setDeleteTarget(null);
            },
          });
        }}
        title={`Delete ${deleteTarget?.name ?? 'rule'}?`}
        description="Deleting this rule stops new alerts from firing. Alerts it already sent stay in the notification history. This cannot be undone."
        loading={deleteRule.isPending}
      />
    </div>
  );
}
