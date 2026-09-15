// owner: web-settings-admin — 11.18 Invite a user (web/tz.md §11.18). `users` FULL.
// Q-1: no password field — the invite lands by email and resolves through Google sign-in.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { inviteUserSchema } from '@/shared/forms/schemas';
import { useInviteUser, type RoleRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import type { z } from 'zod';

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

const INVITABLE_ROLES = ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] as const;

const ROLE_COPY: Record<(typeof INVITABLE_ROLES)[number], { title: string; description: string }> = {
  FLEET_MANAGER: { title: 'Fleet manager', description: 'Full access to vehicles, drivers, HOS and maintenance' },
  DISPATCHER: { title: 'Dispatcher', description: 'Trips, messaging and read-only compliance data' },
  VIEWER: { title: 'Viewer', description: 'Read-only across the whole account' },
};

export function InviteUserModal({ roles, onClose }: { roles: RoleRow[]; onClose: () => void }) {
  const { toast } = useToast();
  const [terminalAccess, setTerminalAccess] = useState('All terminals');
  const [message, setMessage] = useState('');
  const inviteMutation = useInviteUser();

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
    formState: { errors, isSubmitting, isDirty },
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
            const fieldErrors = error.fieldErrors;
            for (const [field, msg] of Object.entries(fieldErrors)) {
              setError(field as keyof InviteUserFormValues, { message: msg });
            }
            if (Object.keys(fieldErrors).length > 0) return;
          }
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite a user"
      subtitle="Back-office access only — drivers are added under Drivers"
      size="md"
      isDirty={isDirty}
      footer={
        <>
          <span className="mr-auto text-caption text-text-muted">The invitation expires in 7 days.</span>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Send invitation
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" required error={errors.firstName?.message ?? errors.lastName?.message}>
            <input
              placeholder="Anna Weiss"
              disabled={isSubmitting}
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
            <input {...register('email')} placeholder="anna.weiss@example.com" disabled={isSubmitting} className={inputClass} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-label text-text">
            Role <span className="text-danger">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {INVITABLE_ROLES.map((key) => {
              const role = roles.find((r) => r.key === key);
              if (!role) return null;
              const selected = roleKey === role.id;
              return (
                <button
                  key={key}
                  type="button"
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
        </div>

        <Field label="Terminal access">
          <select value={terminalAccess} onChange={(e) => setTerminalAccess(e.target.value)} disabled={isSubmitting} className={inputClass}>
            <option>All terminals</option>
            <option>Barrie, ON</option>
            <option>Columbus, OH</option>
          </select>
        </Field>

        <Field label="Message (optional)">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </Field>
      </form>
    </Modal>
  );
}
