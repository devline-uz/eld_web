// owner: web-auth-rbac — the collapsed `Developer sign-in` block (web/tz.md §6.6, Q-1).
//
// ⚠️ This module is only ever referenced behind `import.meta.env.VITE_AUTH_MODE === 'dev'`.
// Vite inlines that literal, so a production build drops the whole branch and this file never
// reaches `dist/` — E2E scenario 3 greps `dist/` for the string `Developer sign-in`.
import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

/** §6.7 — the four canonical demo accounts, one per role. */
const DEMO_ACCOUNTS = [
  { label: 'admin', email: 'sarah.chen@universal-logistics.example' },
  { label: 'fleet manager', email: 'mike.torres@universal-logistics.example' },
  { label: 'dispatcher', email: 'carlos.ramirez@universal-logistics.example' },
  { label: 'viewer', email: 'diane.foster@universal-logistics.example' },
] as const;
const DEMO_PASSWORD = 'Onebook2026';

export function DeveloperSignIn({
  onSubmit,
  busy,
}: {
  onSubmit: (email: string, password: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption text-text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-caption text-text-secondary">
        Development mode — password sign-in is disabled in production.
      </p>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="developer-sign-in-panel"
        className="mt-3 flex w-full items-center justify-between rounded-md px-1 py-2 text-label text-text-secondary hover:bg-bg-subtle"
      >
        <span>Developer sign-in</span>
        {open ? (
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div id="developer-sign-in-panel" className="mt-2 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text-secondary">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label text-text-secondary">Password</span>
            <span className="relative flex items-center">
              <input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-input w-full rounded-md border border-border bg-bg-surface px-3 pr-10 text-body text-text"
              />
              <button
                type="button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((value) => !value)}
                className="absolute right-2 flex size-btn-sm items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle"
              >
                {visible ? (
                  <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            loading={busy}
            onClick={() => onSubmit(email, password)}
          >
            Sign in
          </Button>

          <p className="text-caption text-text-muted">
            Demo accounts:{' '}
            {DEMO_ACCOUNTS.map((account, index) => (
              <span key={account.email}>
                {index > 0 ? ' · ' : null}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                >
                  {account.label}
                </button>
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
