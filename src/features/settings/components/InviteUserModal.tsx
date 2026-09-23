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
import { SETTINGS_REASON } from '../lib/copy';
import type { z } from 'zod';

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

/** Only these keys have a rendered error slot — anything else in a 422 goes to the banner. */
const FORM_FIELDS = new Set<keyof InviteUserFormValues>(['email', 'firstName', 'lastName', 'roleKey']);

const INVITABLE_ROLES = ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] as const;

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
      { email: values.email, firstName: values.firstName, lastName: values.lastName, roleId: values.roleKey },
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

  // Every editable control is now inside react-hook-form (the two B-85 fields are read-only), so
  // `formState.isDirty` is the whole dirty state for the 11.30 confirm.
  const dirty = isDirty;

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

        {/* ⛔ GAP B-85 — `POST /users` takes
            email/firstName/lastName/roleId/jobTitle/phone only. Both controls used to be collected
            and silently dropped (WB-208); they are disabled
            with the reason visible rather than pretending to carry the value. */}
        <Field label="Terminal access" hint={SETTINGS_REASON.inviteTerminal}>
          <select value="All terminals" disabled className={inputClass}>
            <option>All terminals</option>
          </select>
        </Field>

        <Field label="Message (optional)" hint={SETTINGS_REASON.inviteMessage}>
          <textarea
            value=""
            readOnly
            disabled
            rows={3}
            className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-body text-text"
          />
        </Field>
      </form>
    </Modal>
  );
}
