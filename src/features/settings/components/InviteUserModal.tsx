// owner: web-settings-admin — 11.18 Invite a user (web/tz.md §11.18). `users` FULL.
// Q-1: no password field — the invite lands by email and resolves through Google sign-in.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { inviteUserSchema } from '@/shared/forms/schemas';
import { useInviteUser, type RoleRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import type { z } from 'zod';

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

/** Only these keys have a rendered error slot — anything else in a 422 goes to the banner. */
const FORM_FIELDS = new Set<keyof InviteUserFormValues>(['email', 'firstName', 'lastName', 'roleKey']);

const INVITABLE_ROLES = ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] as const;

/** B-85 (shipped) — `POST /users` `terminalIds`. No Terminal table yet (backend D-090); home
 * terminal names, same static list `AddDriverModal` seeds (features/* cannot import features/*,
 * so this is its own copy). Empty selection = every terminal, per the field's own description. */
const TERMINALS = [
  { name: 'Columbus, OH', label: 'Columbus, OH' },
  { name: 'Raleigh, NC', label: 'Raleigh, NC' },
] as const;

const ROLE_COPY: Record<(typeof INVITABLE_ROLES)[number], { title: string; description: string }> = {
  FLEET_MANAGER: { title: 'Fleet manager', description: 'Full access to vehicles, drivers, HOS and maintenance' },
  DISPATCHER: { title: 'Dispatcher', description: 'Trips, messaging and read-only compliance data' },
  VIEWER: { title: 'Viewer', description: 'Read-only across the whole account' },
};

export function InviteUserModal({ roles, onClose }: { roles: RoleRow[]; onClose: () => void }) {
  const { toast } = useToast();
  const inviteMutation = useInviteUser();
  // WB — the modal used to show nothing at all when the invite was rejected without a mappable
  // field (rule 6: unmapped `details` and plain failures belong in a banner inside the modal).
  const [banner, setBanner] = useState<string | null>(null);
  const submitting = inviteMutation.isPending;

  const dispatcherRole = roles.find((r) => r.key === 'DISPATCHER');
  // Tracked locally rather than with react-hook-form's `watch()` — `watch()` cannot be safely
  // memoized (its subscription changes every render), which opts the whole tree out of React
  // Compiler memoization (same pattern as `CreateGeofenceModal`, web/decisions.md). `setValue`
  // keeps react-hook-form's own copy in sync for validation/submit.
  const [roleKey, setRoleKey] = useState(dispatcherRole?.id ?? '');
  const [terminalIds, setTerminalIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
    setError,
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      roleKey: dispatcherRole?.id ?? '',
    },
  });


  function onSubmit(values: InviteUserFormValues) {
    // `mutate()` returns immediately, so RHF's `isSubmitting` is false again before the request
    // lands — a second click would send a second invitation. Guard on the mutation itself.
    if (inviteMutation.isPending) return;
    setBanner(null);
    inviteMutation.mutate(
      {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        roleId: values.roleKey,
        terminalIds: terminalIds.length > 0 ? terminalIds : undefined,
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Invitation sent', description: `An invitation was sent to ${values.email}.` });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setError('email', { message: 'A user with this email already exists.' });
            return;
          }
          if (error instanceof ApiError) {
            const unmapped: string[] = [];
            let mapped = 0;
            for (const [field, msg] of Object.entries(error.fieldErrors)) {
              if (FORM_FIELDS.has(field as keyof InviteUserFormValues)) {
                setError(field as keyof InviteUserFormValues, { message: msg });
                mapped += 1;
              } else unmapped.push(msg);
            }
            if (unmapped.length > 0) setBanner(unmapped.join(' '));
            if (mapped > 0 || unmapped.length > 0) return;
          }
          const message = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
          setBanner(message);
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  // `terminalIds`/`message` (B-85) live outside react-hook-form, same pattern as `roleKey`.
  const dirty = isDirty || terminalIds.length > 0 || message.trim() !== '';

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite a user"
      subtitle="Back-office access only — drivers are added under Drivers"
      size="md"
      isDirty={dirty}
      footer={
        <>
          <span className="mr-auto text-caption text-text-muted">The invitation expires in 7 days.</span>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={handleSubmit(onSubmit)}>
            Send invitation
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" required error={errors.firstName?.message ?? errors.lastName?.message}>
            <input
              placeholder="Anna Weiss"
              disabled={submitting}
              className={inputClass}
              onChange={(e) => {
                const [firstName, ...rest] = e.target.value.split(' ');
                setValue('firstName', firstName ?? '', { shouldDirty: true });
                setValue('lastName', rest.join(' '), { shouldDirty: true });
              }}
            />
          </Field>
          <Field
            label="Work email"
            required
            error={errors.email?.message}
            hint="Must be the Google account the user signs in with."
          >
            <input {...register('email')} placeholder="anna.weiss@example.com" disabled={submitting} className={inputClass} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-label text-text" id="invite-role-label">
            Role <span className="text-danger">*</span>
          </p>
          <div
            role="radiogroup"
            aria-labelledby="invite-role-label"
            aria-invalid={errors.roleKey ? true : undefined}
            aria-describedby={errors.roleKey ? 'invite-role-error' : undefined}
            className="flex flex-col gap-2"
          >
            {INVITABLE_ROLES.map((key) => {
              const role = roles.find((r) => r.key === key);
              if (!role) return null;
              const selected = roleKey === role.id;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setRoleKey(role.id);
                    setValue('roleKey', role.id, { shouldDirty: true });
                  }}
                  className={
                    'rounded-md border p-3 text-left ' +
                    (selected ? 'border-primary bg-primary-soft' : 'border-border hover:bg-bg-subtle')
                  }
                >
                  <p className="text-body-strong text-text">{ROLE_COPY[key].title}</p>
                  <p className="text-caption text-text-muted">{ROLE_COPY[key].description}</p>
                </button>
              );
            })}
          </div>
          {errors.roleKey?.message && (
            <span id="invite-role-error" role="alert" className="mt-1 block text-caption text-danger">
              {errors.roleKey.message}
            </span>
          )}
        </div>

        {/* B-85 (shipped 2026-09-24) — `POST /users` now takes `terminalIds`/`message`. */}
        <Field
          label="Terminal access"
          hint="Stored on the user record only — it is not an access boundary yet; the user still sees every terminal's data. Leave every box unchecked to record no scope."
        >
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
            {TERMINALS.map((t) => (
              <label key={t.name} className="flex items-center gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={terminalIds.includes(t.name)}
                  disabled={submitting}
                  onChange={(e) =>
                    setTerminalIds((prev) =>
                      e.target.checked ? [...prev, t.name] : prev.filter((name) => name !== t.name),
                    )
                  }
                />
                {t.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Message (optional)">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            rows={3}
            maxLength={500}
            placeholder="A short note included in the invitation email."
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </Field>
      </form>
    </Modal>
  );
}
