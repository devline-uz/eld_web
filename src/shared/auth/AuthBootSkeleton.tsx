// owner: web-auth-rbac — §6.8: while `refresh → GET /auth/me` runs on a cold load the whole
// page is a skeleton (brand block + bars), never a bare spinner.
import { Truck } from 'lucide-react';

export function AuthBootSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-card-gap bg-bg-app"
    >
      <span className="sr-only">Signing you in</span>
      <div className="flex items-center gap-3">
        <span className="flex size-avatar-lg items-center justify-center rounded-md bg-primary text-text-inverse">
          <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="text-brand text-text">OneBook ELD</span>
      </div>
      <div className="flex w-sign-in-card flex-col gap-2">
        <div className="h-2 animate-pulse rounded-md bg-bg-subtle" />
        <div className="h-2 w-2/3 animate-pulse rounded-md bg-bg-subtle" />
      </div>
    </div>
  );
}
