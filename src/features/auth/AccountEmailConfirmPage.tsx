// B-84 — public landings of the two links mailed for a web user's email change:
//   /account/email/confirm?token=…  (mailed to the NEW address) → POST /auth/email/verify
//   /account/email/cancel?token=…   (mailed to the OLD address) → POST /auth/email/cancel
// Works signed out (the token is self-authenticating). Like the driver link pages, it acts only on
// an explicit click — mail scanners that open links must not confirm or cancel anything. A
// confirmed change (or a revert) revokes every session of the account on the server, so a panel
// session open in this browser is ended here too. The token is never logged or stored.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ApiError } from '@/shared/api/errors';
import { useCancelEmailChangeLink, useConfirmEmailChange } from '@/shared/api/settingsAdmin';
import { useAuth } from '@/shared/auth/AuthProvider';

export type AccountEmailLinkMode = 'confirm' | 'cancel';

const COPY = {
  confirm: {
    title: 'Confirm your new email',
    body: 'The email on your OneBook ELD account is being changed to this address. Confirm it to finish the change. Until you do, your current address stays on the account. Confirming signs you out everywhere.',
    action: 'Confirm email',
  },
  cancel: {
    title: 'Cancel the email change',
    body: "If you didn't ask for the email on your OneBook ELD account to be changed, cancel it here. If the change was already confirmed, your previous email is restored and every session is signed out.",
    action: "This wasn't me — cancel the change",
  },
} as const;

function errorText(error: unknown, mode: AccountEmailLinkMode): string {
  if (error instanceof ApiError) {
    if (error.code === 'TOKEN_EXPIRED') {
      return mode === 'confirm'
        ? 'This link has expired. Ask your administrator to change the email again to get a new link.'
        : 'This link has expired. Contact your administrator.';
    }
    if (error.status === 409) return 'Another user already has this email address. Contact your administrator.';
    if (error.code === 'RATE_LIMITED' || error.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (error.status === 401) {
      return mode === 'confirm'
        ? 'This link is not valid. Open it again from the latest email, or ask your administrator for a new one.'
        : 'This link can no longer cancel the change. Contact your administrator.';
    }
  }
  return 'Something went wrong. Try again in a moment.';
}

export default function AccountEmailConfirmPage({ mode = 'confirm' }: { mode?: AccountEmailLinkMode }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { isAuthenticated, signOut } = useAuth();
  const confirm = useConfirmEmailChange();
  const cancel = useCancelEmailChangeLink();
  const mutation = mode === 'confirm' ? confirm : cancel;
  const copy = COPY[mode];
  // Kept in local state: ending the panel session clears the query client.
  const [done, setDone] = useState<string | null>(null);

  const endPanelSession = () => {
    if (isAuthenticated) signOut();
  };

  const onAction = () => {
    if (mode === 'confirm') {
      confirm.mutate(token, {
        onSuccess: ({ email, alreadyVerified }) => {
          if (alreadyVerified) {
            setDone(email ? `${email} was already confirmed. Nothing else to do.` : 'This email was already confirmed.');
            return;
          }
          setDone(
            email
              ? `Your email is now ${email}. You were signed out everywhere — sign in again with the new address.`
              : 'Your new email is confirmed. Sign in again with the new address.',
          );
          endPanelSession();
        },
      });
      return;
    }
    cancel.mutate(token, {
      onSuccess: ({ result }) => {
        if (result === 'REVERTED') {
          setDone('The change was undone and your previous email is back. Every session was signed out — sign in again, and tell your administrator.');
          endPanelSession();
          return;
        }
        setDone('The email change was cancelled. Your email stays the same.');
      },
    });
  };

  return (
    <section className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-bg-surface p-6 shadow-sm">
      <h1 className="text-page-title text-text">{copy.title}</h1>
      {!token ? (
        <p role="alert" className="text-body text-danger">
          This link is incomplete. Open it again from the email.
        </p>
      ) : done ? (
        <>
          <p role="status" className="text-body text-text">
            {done}
          </p>
          <Link to={isAuthenticated ? '/account' : '/sign-in'} className="text-body text-primary">
            {isAuthenticated ? 'Go to My profile' : 'Go to sign in'}
          </Link>
        </>
      ) : (
        <>
          <p className="text-body text-text-muted">{copy.body}</p>
          {mutation.isError && (
            <p role="alert" className="text-body text-danger">
              {errorText(mutation.error, mode)}
            </p>
          )}
          <Button variant="primary" size="lg" loading={mutation.isPending} disabled={mutation.isPending} onClick={onAction}>
            {copy.action}
          </Button>
        </>
      )}
    </section>
  );
}
