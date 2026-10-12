// owner: web-auth-rbac — W-00 "Forgot password?" (customer request 2026-10-12), dev auth only.
//
// Two steps inside the sign-in card: (1) the email must belong to an active back-office account
// (`POST /auth/password/reset-code`, 404 → "No account found with this email"), which emails a
// 6-digit code; (2) the code proves the requester owns that mailbox, then the new password is set
// (`POST /auth/password/reset-code/confirm`). Success returns to the sign-in view with a toast.
//
// ⚠️ Like DeveloperSignIn, this module is only referenced behind `VITE_AUTH_MODE === 'dev'`, so a
// production build drops it (Q-1: production sign-in is Google only).
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { errorMessage } from '@/shared/api/errors';
import {
  confirmPasswordResetCode,
  requestPasswordResetCode,
} from '@/shared/auth/authApi';
import { fields, LIMITS, VALIDATION_MESSAGES } from '@/shared/forms';
import { Button } from '@/shared/ui/Button';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';

const NOT_FOUND_MESSAGE = 'No account found with this email.';
const PASSWORD_MAX = 128;

const emailSchema = z.object({ email: fields.email() });
type EmailValues = z.infer<typeof emailSchema>;

const resetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code from the email.'),
    newPassword: z
      .string()
      .min(LIMITS.passwordMin, VALIDATION_MESSAGES.password)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirmPassword: z.string().min(1, VALIDATION_MESSAGES.required),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
type ResetValues = z.infer<typeof resetSchema>;

/** The shape every rejected auth call has (ApiError / NetworkError), matched structurally. */
interface Failure {
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
  fieldErrors: Record<string, string>;
}

function asFailure(cause: unknown): Failure | null {
  if (!cause || typeof cause !== 'object') return null;
  const c = cause as Partial<Failure>;
  if (typeof c.status !== 'number' || typeof c.code !== 'string') return null;
  return {
    status: c.status,
    code: c.code,
    message: typeof c.message === 'string' ? c.message : '',
    details: c.details && typeof c.details === 'object' ? c.details : {},
    fieldErrors: c.fieldErrors && typeof c.fieldErrors === 'object' ? c.fieldErrors : {},
  };
}

function retryAfterOf(failure: Failure): number | null {
  const value = failure.details.retryAfterSec;
  return typeof value === 'number' && value > 0 ? Math.ceil(value) : null;
}

/** Banner copy for anything that is not a field error. */
function bannerMessage(cause: unknown): string {
  const failure = asFailure(cause);
  if (!failure) return 'Could not reach the server. Check your connection and try again.';
  if (failure.status === 429) {
    const wait = retryAfterOf(failure);
    return wait
      ? `Too many attempts. Try again in ${wait} seconds.`
      : 'Too many attempts. Try again in a minute.';
  }
  if (failure.status === 403 && failure.code === 'PASSWORD_LOGIN_DISABLED') {
    return 'Password sign-in is turned off on this server (production mode), so passwords cannot be reset here. Use Continue with Google.';
  }
  if (failure.status === 503) {
    return "We couldn't send the email right now. Try again later or contact your administrator.";
  }
  return errorMessage(failure.code);
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds left until `until` (epoch ms), ticking once a second. */
function useSecondsLeft(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const INPUT_CLASS =
  'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text disabled:opacity-60';

function Field({
  label,
  error,
  errorId,
  children,
}: {
  label: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-label text-text-secondary">{label}</span>
        {children}
      </label>
      {error ? (
        <span id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'danger' | 'info'; children: ReactNode }) {
  return tone === 'danger' ? (
    <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
      {children}
    </p>
  ) : (
    <p role="status" className="mt-4 rounded-md bg-primary-soft px-3 py-2 text-caption text-text-secondary">
      {children}
    </p>
  );
}

export function PasswordResetFlow({
  initialEmail = '',
  onBack,
  onDone,
}: {
  initialEmail?: string;
  onBack: () => void;
  /** Called after the password changed; receives the account email for the sign-in prefill. */
  onDone: (email: string) => void;
}) {
  const [sent, setSent] = useState<{ email: string; expiresInSec: number } | null>(null);
  const [resendAt, setResendAt] = useState(0);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-sm text-caption font-medium text-primary hover:underline"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Back to sign in
      </button>

      {sent ? (
        <CodeStep
          email={sent.email}
          expiresInSec={sent.expiresInSec}
          resendAt={resendAt}
          onResent={(next) => setResendAt(next)}
          onDone={onDone}
        />
      ) : (
        <EmailStep
          initialEmail={initialEmail}
          onSent={(result) => {
            setSent({ email: result.email, expiresInSec: result.expiresInSec });
            setResendAt(Date.now() + result.resendAfterSec * 1000);
          }}
        />
      )}
    </div>
  );
}

function EmailStep({
  initialEmail,
  onSent,
}: {
  initialEmail: string;
  onSent: (result: { email: string; expiresInSec: number; resendAfterSec: number }) => void;
}) {
  const [banner, setBanner] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: initialEmail },
  });

  const submittingRef = useRef(false);

  async function onValid({ email }: EmailValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBanner(null);
    try {
      onSent(await requestPasswordResetCode(email.trim()));
    } catch (cause) {
      const failure = asFailure(cause);
      if (failure?.status === 404) {
        setError('email', { message: NOT_FOUND_MESSAGE }, { shouldFocus: true });
        return;
      }
      if (failure?.status === 422 && failure.fieldErrors.email) {
        setError('email', { message: failure.fieldErrors.email }, { shouldFocus: true });
        return;
      }
      setBanner(bannerMessage(cause));
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <>
      <h1 className="mt-4 text-page-title text-text">Reset password</h1>
      <p className="mt-1 text-page-sub text-text-muted">
        Enter the email of your OneBook ELD account. We&apos;ll send you a 6-digit verification code.
      </p>
      {banner ? <Banner tone="danger">{banner}</Banner> : null}
      <form
        aria-label="Reset password"
        className="mt-5 flex flex-col gap-3"
        noValidate
        onSubmit={(event) => void handleSubmit(onValid)(event)}
      >
        <Field label="Email" error={errors.email?.message} errorId="reset-email-error">
          <input
            type="email"
            autoComplete="username"
            autoFocus
            disabled={isSubmitting}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'reset-email-error' : undefined}
            className={INPUT_CLASS}
            {...register('email')}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Sending code…' : 'Send code'}
        </Button>
      </form>
    </>
  );
}

function PasswordInput({
  visible,
  onToggle,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { visible: boolean; onToggle: () => void; ref?: Ref<HTMLInputElement> }) {
  return (
    <span className="relative flex items-center">
      <input {...props} type={visible ? 'text' : 'password'} className={`${INPUT_CLASS} pr-10`} />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={onToggle}
        className="absolute right-2 flex size-btn-sm items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle"
      >
        {visible ? (
          <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

function CodeStep({
  email,
  expiresInSec,
  resendAt,
  onResent,
  onDone,
}: {
  email: string;
  expiresInSec: number;
  resendAt: number;
  onResent: (resendAt: number) => void;
  onDone: (email: string) => void;
}) {
  const { toast } = useToast();
  const ids = useId();
  const [banner, setBanner] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const [resending, setResending] = useState(false);
  const secondsLeft = useSecondsLeft(resendAt);
  // Closes the gap between a first submit and RHF's `isSubmitting` re-render (double Enter).
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  async function onValid({ code, newPassword }: ResetValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBanner(null);
    try {
      await confirmPasswordResetCode({ email, code: code.trim(), newPassword });
      toast({ kind: 'success', ...TOAST_COPY.passwordUpdated });
      onDone(email);
    } catch (cause) {
      const failure = asFailure(cause);
      if (failure?.status === 422 && failure.code === 'RESET_CODE_INVALID') {
        const message =
          typeof failure.details.code === 'string' ? failure.details.code : errorMessage(failure.code);
        resetField('code', { keepError: false });
        setError('code', { message }, { shouldFocus: true });
      } else if (failure?.status === 422 && failure.code === 'RESET_CODE_EXPIRED') {
        const message =
          typeof failure.details.code === 'string' ? failure.details.code : errorMessage(failure.code);
        setError('code', { message }, { shouldFocus: true });
      } else if (failure?.status === 422 && Object.keys(failure.fieldErrors).length > 0) {
        let mapped = false;
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field === 'code' || field === 'newPassword') {
            setError(field, { message });
            mapped = true;
          }
        }
        if (!mapped) setBanner({ tone: 'danger', text: 'Check the highlighted fields and try again.' });
      } else {
        setBanner({ tone: 'danger', text: bannerMessage(cause) });
      }
    } finally {
      submittingRef.current = false;
    }
  }

  async function resend() {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setBanner(null);
    try {
      const result = await requestPasswordResetCode(email);
      onResent(Date.now() + result.resendAfterSec * 1000);
      resetField('code');
      setBanner({ tone: 'info', text: `A new code was sent to ${email}.` });
    } catch (cause) {
      const failure = asFailure(cause);
      const wait = failure?.status === 429 ? retryAfterOf(failure) : null;
      if (wait) onResent(Date.now() + wait * 1000);
      else setBanner({ tone: 'danger', text: bannerMessage(cause) });
    } finally {
      setResending(false);
    }
  }

  const busy = isSubmitting || resending;
  const codeError = `${ids}-code-error`;
  const passwordError = `${ids}-password-error`;
  const confirmError = `${ids}-confirm-error`;

  return (
    <>
      <h1 className="mt-4 text-page-title text-text">Check your email</h1>
      <p className="mt-1 text-page-sub text-text-muted">
        We sent a 6-digit code to <span className="font-medium text-text">{email}</span>. It expires in{' '}
        {Math.round(expiresInSec / 60)} minutes.
      </p>
      {banner ? <Banner tone={banner.tone}>{banner.text}</Banner> : null}
      <form
        aria-label="Set a new password"
        className="mt-5 flex flex-col gap-3"
        noValidate
        onSubmit={(event) => void handleSubmit(onValid)(event)}
      >
        <Field label="Verification code" error={errors.code?.message} errorId={codeError}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            disabled={isSubmitting}
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={errors.code ? codeError : undefined}
            className={`${INPUT_CLASS} tabular-nums tracking-widest`}
            {...register('code')}
          />
        </Field>
        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => void resend()}
            disabled={busy || secondsLeft > 0}
            className="rounded-sm text-caption font-medium text-primary hover:underline disabled:text-text-muted disabled:no-underline"
          >
            {secondsLeft > 0 ? (
              <>
                Resend code in <span className="tabular-nums">{formatCountdown(secondsLeft)}</span>
              </>
            ) : resending ? (
              'Sending…'
            ) : (
              'Resend code'
            )}
          </button>
        </div>
        <Field label="New password" error={errors.newPassword?.message} errorId={passwordError}>
          <PasswordInput
            visible={visible}
            onToggle={() => setVisible((v) => !v)}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby={errors.newPassword ? passwordError : undefined}
            {...register('newPassword')}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message} errorId={confirmError}>
          <PasswordInput
            visible={visible}
            onToggle={() => setVisible((v) => !v)}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby={errors.confirmPassword ? confirmError : undefined}
            {...register('confirmPassword')}
          />
        </Field>
        {errors.newPassword ? null : (
          <p className="-mt-2 text-caption text-text-muted">Use at least 8 characters.</p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting} disabled={resending}>
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </>
  );
}
