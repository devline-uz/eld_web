// owner: web-vehicles-drivers — W-07 Driver profile › Activity (LIVE-024).
//
// The tab used to be a hard-coded "No activity recorded" even for drivers with edits, sign-ins and
// deactivations on file. It now reads the audit trail for this driver record
// (`GET /audit-log?objectType=Driver&objectId=…`, `auditLog` READ): profile edits, status changes,
// app sign-ins / sign-outs and access cut-offs. A role without `auditLog` is told so instead of
// being shown an empty list that looks like "nothing happened".
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';
import type { AuditEntry } from '@/shared/api/settingsAdmin';
import { usePermission } from '@/shared/auth/usePermission';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { formatCarrierDateTime } from '@/shared/format/datetime';
import { Card } from '@/shared/ui/Card';
import { ErrorState, LoadingState } from '@/shared/ui/states';

const ACTIVITY_LIMIT = 50;

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Driver created',
  UPDATE: 'Profile updated',
  DELETE: 'Driver deleted',
  LOGIN: 'Signed in to the app',
  LOGOUT: 'Signed out of the app',
  APP_ACCESS_REVOKED: 'App access revoked',
  RESET_PASSWORD: 'Password reset',
};

/** `EMAIL_CHANGE_CONFIRMED` → `Email change confirmed` for the verbs not named above. */
function driverActivityLabel(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actorOf(entry: AuditEntry): string {
  if (entry.actorType === 'DRIVER') return 'Driver (app)';
  if (entry.actorType === 'SYSTEM') return 'System';
  return entry.actorName ?? 'A user';
}

export function DriverActivityTab({ driverId }: { driverId: string }) {
  const { can } = usePermission();
  const timezone = useCarrierTimezone();
  const allowed = can('auditLog');
  const params = { objectType: 'Driver', objectId: driverId, limit: ACTIVITY_LIMIT };
  const query = useQuery({
    queryKey: qk.audit(params),
    queryFn: ({ signal }) =>
      client.get<{ items: AuditEntry[]; nextCursor: string | null }>(endpoints.auditLog.list, { params, signal }),
    ...typedCachePolicy<{ items: AuditEntry[]; nextCursor: string | null }>('slowList'),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <Card>
        <p className="text-body text-text-muted">
          Activity comes from the audit log, which your role cannot view. Ask an administrator for access.
        </p>
      </Card>
    );
  }
  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load activity"
        description="The audit log did not respond. Try again in a moment."
        onRetry={() => void query.refetch()}
      />
    );
  }
  const items = query.data.items;
  return (
    <Card>
      {items.length === 0 ? (
        <p className="text-body text-text-muted">No changes or sign-ins recorded for this driver yet.</p>
      ) : (
        <ol aria-label="Driver activity" className="flex flex-col">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-b-0">
              <span className="min-w-0">
                <span className="block text-body-strong text-text">{driverActivityLabel(entry.action)}</span>
                <span className="block text-caption text-text-muted">{actorOf(entry)}</span>
              </span>
              <span className="tabular shrink-0 text-caption text-text-muted">
                {formatCarrierDateTime(entry.createdAt, timezone)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-caption text-text-muted">
        DVIRs, log edits and certifications are on{' '}
        <Link to={`/hos-logs?driverId=${driverId}`} className="text-primary">
          HOS Logs
        </Link>
        {query.data.nextCursor ? ` · showing the latest ${ACTIVITY_LIMIT}` : ''}.
      </p>
    </Card>
  );
}
