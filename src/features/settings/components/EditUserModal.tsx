// owner: web-settings-admin — W-18 row menu `Edit user` / `Change role`.
// B-84 (shipped 2026-09-24) — `PATCH /users/:id` now also accepts `email`, `jobTitle`, `phone`
// and `homeTerminalName`. Changing `email` does not switch it immediately: the response carries
// `emailVerification.pendingEmail` and the address only changes once the link is confirmed
// (backend D-101). The change needs the acting user's own password (or a fresh Google sign-in for a
// Google-only account), the same re-auth UX as EditDriverModal; a pending change is shown as a
// banner with Resend / Cancel change, mirroring the driver profile.
import { useAuth } from '@/shared/auth/AuthProvider';
import { signInWithGoogle } from '@/shared/auth/firebase';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { isPrivilegedRole, isSuperAdmin } from '@/shared/auth/permissions';
import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { fields } from '@/shared/forms';
import { internationalPhoneRule, phoneForDisplay, toE164 } from '@/shared/forms/phoneNumber';
import { PhoneNumberInput } from '@/shared/forms/PhoneNumberInput';
import {
  useCancelUserEmailChange,
  useResendUserEmailChange,
  useUpdateUser,
  type RoleRow,
  type UserRow,
} from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';
import { placeServerFieldErrors, serverErrorBanner } from '../lib/serverFieldErrors';

/** `UpdateUserDto` limits — past them the server answered a 422 the form never pointed at. */
const NAME_MAX = 80;
const TERMINAL_MAX = 120;
const editUserSchema = z.object({
  firstName: fields.requiredString().max(NAME_MAX, `First name must be ${NAME_MAX} characters or fewer.`),
  lastName: fields.requiredString().max(NAME_MAX, `Last name must be ${NAME_MAX} characters or fewer.`),
  email: fields.email(),
  jobTitle: z.string().trim().max(100, 'Job title must be 100 characters or fewer.').optional(),
  phone: internationalPhoneRule(),
  /** Typed — no Terminal table to pick from yet (backend D-090). Empty = all terminals. */
  homeTerminalName: z
    .string()
    .trim()
    .max(TERMINAL_MAX, `Home terminal must be ${TERMINAL_MAX} characters or fewer.`)
    .optional(),
});

/** Compared the way the backend does (trim + lower-case): a case-only edit is not a change. */
const emailKey = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Server issue path → the profile field that shows it. */
const PROFILE_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  jobTitle: 'jobTitle',
  phone: 'phone',
  homeTerminalName: 'homeTerminalName',
} as const;
const FIELD_LABELS = { roleId: 'Role', status: 'Status' };
type EditUserValues = z.infer<typeof editUserSchema>;

export interface EditUserModalProps {
  user: UserRow;
  roles: RoleRow[];
  /** `role` renders only the role picker — the `Change role` entry in the row menu. */
  mode: 'profile' | 'role';
  /** Number of ACTIVE ADMIN accounts, for the last-admin guard (mirrors the disable guard). */
  activeAdminCount: number;
  onClose: () => void;
}

export function EditUserModal({
  user,
  roles,
  mode,
  activeAdminCount,
  onClose,
}: EditUserModalProps) {
  const { toast } = useToast();
  const updateUser = useUpdateUser();
  const [banner, setBanner] = useState<string | null>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (banner) bannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [banner]);
  const currentRoleId = user.role.id ?? roles.find((r) => r.key === user.role.key)?.id ?? '';
  const { user: me } = useAuth();
  const superAdmin = isSuperAdmin(me);
  // Non-super-admins never pick ADMIN / SUPER_ADMIN (the user's current role stays listed so the select is valid).
  const pickableRoles = superAdmin ? roles : roles.filter((r) => r.id === currentRoleId || !isPrivilegedRole(r.key));
  const [roleId, setRoleId] = useState(currentRoleId);

  const {
    register,
    control,
    setError,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      jobTitle: user.jobTitle ?? '',
      phone: phoneForDisplay(user.phone),
      homeTerminalName: user.homeTerminalName ?? '',
    },
  });

  // B-84 re-auth — the acting user's own password; kept only in this modal's state.
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // A Google-only account has no password: the backend asks for a fresh Google sign-in instead.
  const [googleReauth, setGoogleReauth] = useState(false);
  const watchedEmail = useWatch({ control, name: 'email' });
  const emailChanged = mode === 'profile' && emailKey(watchedEmail) !== emailKey(user.email);

  const resendEmailChange = useResendUserEmailChange();
  const cancelEmailChange = useCancelUserEmailChange();
  // `user` is the row snapshot the modal opened with; a cancel here hides the banner at once.
  const [pendingCleared, setPendingCleared] = useState(false);
  const pendingEmail = pendingCleared ? null : (user.pendingEmail ?? null);
  const pendingBusy = resendEmailChange.isPending || cancelEmailChange.isPending;

  const submitting = updateUser.isPending;
  const dirty = (mode === 'profile' && isDirty) || roleId !== currentRoleId || currentPassword !== '';

  function runResendEmailChange() {
    if (pendingBusy) return;
    resendEmailChange.mutate(user.id, {
      onSuccess: (result) =>
        toast(
          result.emailDelivered === false
            ? { kind: 'warning', ...SETTINGS_TOAST.emailChangeResendFailed(result.pendingEmail) }
            : { kind: 'success', ...SETTINGS_TOAST.emailChangeResent(result.pendingEmail) },
        ),
      onError: (error) => toast({ kind: 'error', title: formErrorMessage(error) }),
    });
  }

  function runCancelEmailChange() {
    if (pendingBusy) return;
    cancelEmailChange.mutate(user.id, {
      onSuccess: () => {
        setPendingCleared(true);
        toast({ kind: 'success', ...SETTINGS_TOAST.emailChangeCancelled });
      },
      onError: (error) => toast({ kind: 'error', title: formErrorMessage(error) }),
    });
  }

  // The same refusal as `Disable user`: demoting the last active administrator locks everyone out
  // of Settings. The server also answers 409 LAST_ADMIN — this only avoids a pointless round trip.
  const demotingLastAdmin =
    user.role.key === 'ADMIN' &&
    user.status === 'ACTIVE' &&
    activeAdminCount <= 1 &&
    roleId !== currentRoleId &&
    roles.find((r) => r.id === roleId)?.key !== 'ADMIN';

  function submit(values: EditUserValues, reauthIdToken?: string) {
    if (submitting) return;
    if (demotingLastAdmin) return;
    const changingEmail = mode === 'profile' && emailKey(values.email) !== emailKey(user.email);
    if (changingEmail && !reauthIdToken && !currentPassword) {
      setPasswordError(googleReauth ? 'Confirm with Google to change the email.' : 'Enter your password to change the email.');
      return;
    }
    setPasswordError(null);
    setBanner(null);
    const dto: Parameters<typeof updateUser.mutate>[0]['dto'] = {};
    if (mode === 'profile') {
      dto.firstName = values.firstName;
      dto.lastName = values.lastName;
      dto.jobTitle = values.jobTitle || undefined;
      dto.phone = toE164(values.phone); // '' / '+' → omitted, as before
      dto.homeTerminalName = values.homeTerminalName || undefined;
      // Only a real change is sent (compared like the backend), and only then the re-auth proof.
      if (changingEmail) {
        dto.email = values.email.trim();
        if (reauthIdToken) dto.reauthIdToken = reauthIdToken;
        else dto.currentPassword = currentPassword;
      }
    }
    if (roleId && roleId !== currentRoleId) dto.roleId = roleId;
    if (Object.keys(dto).length === 0) {
      onClose();
      return;
    }
    updateUser.mutate(
      { id: user.id, dto },
      {
        onSuccess: (result) => {
          const name =
            mode === 'profile'
              ? `${values.firstName} ${values.lastName}`
              : `${user.firstName} ${user.lastName}`;
          const roleName = roles.find((r) => r.id === roleId)?.name ?? user.role.name;
          if (result.emailVerification?.pendingEmail) {
            // `emailDelivered: false` — saved, but the mail server did not take the link (no SMTP);
            // the pending banner's Resend retries it.
            const delivered = result.emailVerification.emailDelivered !== false;
            toast({
              kind: delivered ? 'success' : 'warning',
              ...SETTINGS_TOAST.emailChangeRequested(name, result.emailVerification.pendingEmail, delivered),
            });
            onClose();
            return;
          }
          toast({
            kind: 'success',
            ...(mode === 'role' || dto.firstName === undefined
              ? SETTINGS_TOAST.roleChanged(name, roleName)
              : SETTINGS_TOAST.userUpdated(name)),
          });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && (error.code === 'REAUTH_FAILED' || error.code === 'REAUTH_REQUIRED')) {
            const wantsGoogle = typeof error.details.reauthIdToken === 'string';
            setGoogleReauth(wantsGoogle);
            const detail = error.details.currentPassword ?? error.details.reauthIdToken;
            setPasswordError(typeof detail === 'string' ? detail : error.message);
            return;
          }
          if (
            mode === 'profile' &&
            error instanceof ApiError &&
            (error.code === 'EMAIL_CHANGE_ON_HOLD' || error.code === 'EMAIL_TAKEN' || error.status === 409) &&
            typeof error.details.email === 'string'
          ) {
            setError('email', { message: error.details.email });
            return;
          }
          // 422 VALIDATION_FAILED → each issue on its field (profile mode renders them); whatever
          // has no field here (`roleId`, or anything in role mode) is spelled out in the banner.
          const placed =
            mode === 'profile'
              ? placeServerFieldErrors(error, PROFILE_FIELDS, (field, message) => setError(field, { message }))
              : [];
          setBanner(serverErrorBanner(error, placed, FIELD_LABELS));
        },
      },
    );
  }

  async function confirmWithGoogle(values: EditUserValues) {
    try {
      const outcome = await signInWithGoogle();
      if (outcome.kind === 'idToken') submit(values, outcome.idToken);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Google sign-in failed.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'role' ? 'Change role' : 'Edit user'}
      subtitle={`${user.firstName} ${user.lastName} · ${user.email}`}
      size="sm"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting || demotingLastAdmin}
            onClick={handleSubmit((values) => submit(values))}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => submit(values))}>
        {banner && (
          <p ref={bannerRef} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        {mode === 'profile' && pendingEmail && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-body text-text"
          >
            <span className="break-all">
              Pending: {pendingEmail} — awaiting confirmation. Until then sign-in still uses {user.email}.
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={resendEmailChange.isPending}
                disabled={pendingBusy || submitting}
                onClick={runResendEmailChange}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={cancelEmailChange.isPending}
                disabled={pendingBusy || submitting}
                onClick={runCancelEmailChange}
              >
                Cancel change
              </Button>
            </span>
          </div>
        )}
        {mode === 'profile' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName?.message}>
                <input {...register('firstName')} disabled={submitting} className={inputClass} />
              </Field>
              <Field label="Last name" required error={errors.lastName?.message}>
                <input {...register('lastName')} disabled={submitting} className={inputClass} />
              </Field>
            </div>
            <Field
              label="Work email"
              required
              error={errors.email?.message}
              hint="Changing this re-verifies the new address by email before it takes effect."
            >
              <input {...register('email')} type="email" disabled={submitting} className={inputClass} />
            </Field>
            {emailChanged && (
              <div className="flex flex-col gap-1">
                {pendingEmail && (
                  <p className="text-caption text-text-muted">
                    A change to {pendingEmail} is already awaiting confirmation; saving replaces it.
                  </p>
                )}
                {googleReauth ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-label text-text">Confirm it&apos;s you</span>
                    <Button
                      variant="secondary"
                      disabled={submitting}
                      onClick={handleSubmit((values) => void confirmWithGoogle(values))}
                    >
                      Confirm with Google and save
                    </Button>
                    {passwordError && <span className="text-caption text-danger">{passwordError}</span>}
                  </div>
                ) : (
                  <Field label="Your password" required error={passwordError ?? undefined}>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      disabled={submitting}
                      aria-invalid={passwordError ? true : undefined}
                      className={inputClass}
                    />
                  </Field>
                )}
                <p className="text-caption text-text-muted">
                  Changing an email needs your own password. The new address only takes effect after its
                  owner confirms the link we email to it; the current address is told about the change and
                  can cancel it.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Job title" error={errors.jobTitle?.message}>
                <input {...register('jobTitle')} disabled={submitting} className={inputClass} />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneNumberInput
                      name={field.name}
                      inputRef={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={submitting}
                      aria-invalid={errors.phone ? true : undefined}
                      className={inputClass}
                    />
                  )}
                />
              </Field>
            </div>
            <Field
              label="Home terminal"
              hint="Leave empty for all terminals."
              error={errors.homeTerminalName?.message}
            >
              <input
                {...register('homeTerminalName')}
                disabled={submitting}
                className={inputClass}
              />
            </Field>
          </>
        )}
        <Field
          label="Role"
          required
          error={
            demotingLastAdmin
              ? 'This is the last active admin. Promote another user to Admin first.'
              : undefined
          }
        >
          <select
            value={roleId}
            aria-label="Role"
            onChange={(e) => setRoleId(e.target.value)}
            disabled={submitting}
            className={inputClass}
          >
            {pickableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
