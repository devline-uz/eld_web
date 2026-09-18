// owner: web-auth-rbac — W-26 `Active sessions` (GET /me/sessions, DELETE /me/sessions/:id).
// ⛔ GAP B-50: rows carry no `current` flag and no location. Until they do, no row is marked
// `● Current`, every row offers `Sign out`, and LOCATION shows `—` (web/decisions.md WD-048).
// `Sign out everywhere` revokes every listed session — this one included — then signs out here.
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { toUserMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthProvider';
import { EMPTY, formatRelative, useNowTick } from '@/shared/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { useMySessions, useRevokeAllSessions, useRevokeSession } from '../api';
import { deviceLabel } from '../userAgent';

const HEAD = 'px-4 text-left text-table-head text-text-muted uppercase';

export function SessionsCard() {
  const sessions = useMySessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const now = useNowTick();
  const [confirmAll, setConfirmAll] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const rows = sessions.data ?? [];

  function revokeOne(id: string) {
    setPendingId(id);
    revoke.mutate(id, {
      onError: (error) => toast({ kind: 'error', title: toUserMessage(error) }),
      onSettled: () => setPendingId(null),
    });
  }

  async function signOutEverywhere() {
    try {
      await revokeAll.mutateAsync(rows.map((row) => row.id));
      setConfirmAll(false);
      signOut();
    } catch (error) {
      setConfirmAll(false);
      toast({ kind: 'error', title: toUserMessage(error) });
    }
  }

  return (
    <section
      id="account-section-sessions"
      tabIndex={-1}
      aria-labelledby="account-sessions-title"
      className="scroll-mt-page focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card padded={false}>
        <div className="px-card py-4">
          <SectionHeader
            title={<span id="account-sessions-title">Active sessions</span>}
            subtitle="Signing out ends access on that device immediately"
            action={
              rows.length > 0 ? (
                <Button
                  variant="danger-outline"
                  iconLeft={<LogOut size={16} strokeWidth={1.75} aria-hidden="true" />}
                  onClick={() => setConfirmAll(true)}
                >
                  Sign out everywhere
                </Button>
              ) : null
            }
          />
        </div>

        {sessions.isPending ? (
          <LoadingState rows={2} className="px-card pb-2" />
        ) : sessions.isError ? (
          <ErrorState
            title="Could not load your sessions"
            description="Try again in a moment."
            onRetry={() => void sessions.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<LogOut size={24} strokeWidth={1.75} aria-hidden="true" />}
            title="No active sessions"
            description="Devices you sign in on appear here."
          />
        ) : (
          <table className="w-full">
            <caption className="sr-only">Active sessions</caption>
            <thead>
              <tr className="h-table-head border-y border-border bg-bg-subtle">
                <th scope="col" className={`${HEAD} pl-card`}>
                  DEVICE
                </th>
                <th scope="col" className={HEAD}>
                  LOCATION
                </th>
                <th scope="col" className={HEAD}>
                  IP ADDRESS
                </th>
                <th scope="col" className={HEAD}>
                  LAST ACTIVE
                </th>
                <th scope="col" className="pr-card">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const device = deviceLabel(row.userAgent, row.deviceLabel);
                return (
                  <tr key={row.id} className="h-row border-b border-border last:border-b-0">
                    <td className="pl-card text-body-strong text-text">{device}</td>
                    <td className="px-4 text-body text-text-secondary">{row.location || EMPTY.dash}</td>
                    <td className="px-4 text-body tabular text-text-secondary">{row.ip || EMPTY.dash}</td>
                    <td className="px-4 text-body tabular">
                      {row.current ? (
                        <span className="font-semibold text-success">Now · this device</span>
                      ) : (
                        <span className="text-text-secondary">{formatRelative(row.lastSeenAt, now)}</span>
                      )}
                    </td>
                    <td className="pr-card text-right">
                      {row.current ? (
                        <Badge tone="success" dot>
                          Current
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Sign out ${device}`}
                          loading={pendingId === row.id}
                          disabled={pendingId !== null && pendingId !== row.id}
                          onClick={() => revokeOne(row.id)}
                        >
                          Sign out
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {confirmAll ? (
        <Modal
          open
          size="sm"
          onClose={() => setConfirmAll(false)}
          title="Sign out everywhere?"
          subtitle="Every session ends immediately, including this one."
          footer={
            <>
              <Button variant="secondary" size="lg" onClick={() => setConfirmAll(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="lg"
                loading={revokeAll.isPending}
                onClick={() => void signOutEverywhere()}
              >
                Sign out everywhere
              </Button>
            </>
          }
        >
          <p className="text-body text-text-secondary">You will need to sign in again on this device.</p>
        </Modal>
      ) : null}
    </section>
  );
}
