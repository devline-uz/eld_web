// owner: web-auth-rbac — W-26 `Security & sign-in` card (web/tz.md §10 W-26, Q-1).
// No password grid: sign-in is Google-only in production. `Sign-in method` states how the user
// actually signs in; nothing else is rendered here (web/decisions.md WD-067).
import type { UseQueryResult } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import type { MyProfile } from '../api';
import { GoogleMark } from './GoogleMark';

function SignInMethod({ profile }: { profile: MyProfile }) {
  const devPassword =
    import.meta.env.VITE_AUTH_MODE === 'dev' && profile.authProvider !== 'GOOGLE' && !profile.googleUid;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-text-secondary">Sign-in method</p>
      <div className="rounded-md border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-avatar shrink-0 items-center justify-center rounded-md bg-bg-subtle">
            {devPassword ? (
              <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" className="text-text-muted" />
            ) : (
              <GoogleMark />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-strong text-text">
              {devPassword ? 'Email and password' : 'Google account'}
            </p>
            <p className="truncate text-caption text-text-muted">{profile.email}</p>
          </div>
          {devPassword ? null : (
            <Badge tone="success" dot>
              Connected
            </Badge>
          )}
        </div>
        <p className="mt-3 text-caption text-text-muted">
          {devPassword
            ? 'Development mode — password sign-in is disabled in production.'
            : 'Your password and account recovery are managed by Google.'}
        </p>
      </div>
    </div>
  );
}

export function SecurityCard({ query }: { query: UseQueryResult<MyProfile, Error> }) {
  return (
    <section
      id="security"
      tabIndex={-1}
      aria-labelledby="account-security-title"
      className="scroll-mt-page focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card padded={false}>
        <div className="border-b border-border px-card py-4">
          <SectionHeader
            title={<span id="account-security-title">Security &amp; sign-in</span>}
          />
        </div>
        <div className="flex flex-col gap-4 p-card">
          {query.isPending ? (
            <LoadingState rows={1} />
          ) : query.isError ? (
            <ErrorState
              title="Could not load your security settings"
              description="Try again in a moment."
              onRetry={() => void query.refetch()}
            />
          ) : (
            <SignInMethod profile={query.data} />
          )}
        </div>
      </Card>
    </section>
  );
}
