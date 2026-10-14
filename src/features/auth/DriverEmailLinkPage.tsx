// Driver email change — public landing pages of the two emailed links (no panel sign-in):
//   /driver-email/confirm?token=…  (mailed to the NEW address)  → POST /auth/driver/email/confirm
//   /driver-email/cancel?token=…   (mailed to the OLD address)  → POST /auth/driver/email/cancel
//   /driver-email/verify?token=…   (POST /drivers/:id/send-verification) → POST /auth/driver/email/verify
// The action runs on an explicit click, never on load: mail scanners that open links must not
// confirm or cancel anything. The token is never logged or stored.
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ApiError } from '@/shared/api/errors';
import {
  useCancelDriverEmailChangeLink,
  useConfirmDriverEmailChange,
  useVerifyDriverEmailLink,
} from '@/shared/api/drivers';

export type DriverEmailLinkMode = 'confirm' | 'cancel' | 'verify';

const COPY = {
  confirm: {
    title: 'Confirm your new email',
    body: 'Your carrier asked to change the email on your OneBook ELD driver account to this address. Confirm it to finish the change. You will need to sign in to the driver app again.',
    action: 'Confirm email',
  },
  cancel: {
    title: 'Cancel the email change',
    body: "If you didn't ask for your OneBook ELD driver email to be changed, cancel it here. If the change was already confirmed, your previous email is restored and the driver app is signed out.",
    action: "This wasn't me — cancel the change",
  },
  verify: {
    title: 'Verify your email',
    body: 'Your carrier asked you to verify the email on your OneBook ELD driver account. Verify it to confirm this address belongs to you.',
    action: 'Verify email',
  },
} as const;

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TOKEN_EXPIRED') return 'This link has expired. Ask your carrier to send a new one.';
    if (error.code === 'EMAIL_TAKEN') return 'Another driver already uses this email address. Contact your carrier.';
    if (error.code === 'RATE_LIMITED') return 'Too many attempts. Wait a minute and try again.';
    if (error.status === 401) return error.message || 'This link is no longer valid.';
  }
  return 'Something went wrong. Try again in a moment.';
}

export default function DriverEmailLinkPage({ mode }: { mode: DriverEmailLinkMode }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const confirm = useConfirmDriverEmailChange();
  const cancel = useCancelDriverEmailChangeLink();
  const verify = useVerifyDriverEmailLink();
  const mutation = mode === 'confirm' ? confirm : mode === 'cancel' ? cancel : verify;
  const copy = COPY[mode];

  let done: string | null = null;
  if (mode === 'confirm' && confirm.data) done = `Your email is now ${confirm.data.email}. Sign in to the driver app again.`;
  if (mode === 'cancel' && cancel.data) {
    done =
      cancel.data.result === 'REVERTED'
        ? 'The change was undone and your previous email is back. Sign in to the driver app again, and tell your carrier.'
        : 'The email change was cancelled. Your email stays the same.';
  }
  if (mode === 'verify' && verify.data) {
    done = verify.data.alreadyVerified
      ? `${verify.data.email} was already verified. Nothing else to do.`
      : `${verify.data.email} is verified. You can close this page.`;
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-bg-surface p-6 shadow-sm">
      <h1 className="text-page-title text-text">{copy.title}</h1>
      {!token ? (
        <p role="alert" className="text-body text-danger">
          This link is incomplete. Open it again from the email.
        </p>
      ) : done ? (
        <p role="status" className="text-body text-text">
          {done}
        </p>
      ) : (
        <>
          <p className="text-body text-text-muted">{copy.body}</p>
          {mutation.isError && (
            <p role="alert" className="text-body text-danger">
              {errorText(mutation.error)}
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(token)}
          >
            {copy.action}
          </Button>
        </>
      )}
    </section>
  );
}
