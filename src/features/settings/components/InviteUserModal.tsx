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
import { useInviteUser, useRolesList, type RoleRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import type { z } from 'zod';

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

/** Only these keys have a rendered error slot — anything else in a 422 goes to the banner. */
const FORM_FIELDS = new Set<keyof InviteUserFormValues>([
  'email',
  'firstName',
  'lastName',
  'roleKey',
]);

/** Server-side field names that land on a differently named form field. */
const FIELD_ALIASES: Record<string, keyof InviteUserFormValues> = { roleId: 'roleKey' };

const NO_ROLES_MESSAGE =
  'No roles are configured. Create a role under Roles & permissions, then invite the user.';

/** Role keys are compared case- and whitespace-insensitively (`' dispatcher '` is `DISPATCHER`). */
function normalizeKey(role: RoleRow): string {
  return typeof role.key === 'string' ? role.key.trim().toUpperCase() : '';
}

/** WB — every role `GET /roles` returns is invitable (`POST /users` takes any role id), custom
 * roles included; ADMIN is offered too, but last. Otherwise the API order is kept. */
function sortInvitableRoles(roles: RoleRow[]): RoleRow[] {
  const isAdmin = (r: RoleRow) => normalizeKey(r) === 'ADMIN';
  return [...roles.filter((r) => !isAdmin(r)), ...roles.filter(isAdmin)];
}

/** B-85 (shipped) — `POST /users` `terminalIds`. No Terminal table yet (backend D-090), so the
 * names are typed, one per line (a name such as `Dayton, OH` carries its own comma). Nothing
 * typed = no scope recorded, per the field's own description. */
function parseTerminalNames(text: string): string[] {
  return [
    ...new Set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

/** Fallback copy for the built-in keys only — the API's `name`/`description` always win. */
const ROLE_COPY: Record<string, { title: string; description: string }> = {
  ADMIN: {
    title: 'Admin',
    description: 'Full access, including users, roles and company settings',
  },
  FLEET_MANAGER: {
    title: 'Fleet manager',
    description: 'Full access to vehicles, drivers, HOS and maintenance',
  },
  DISPATCHER: {
    title: 'Dispatcher',
    description: 'Trips, messaging and read-only compliance data',
  },
  VIEWER: { title: 'Viewer', description: 'Read-only across the whole account' },
};

function roleTitle(role: RoleRow): string {
  return role.name?.trim() || ROLE_COPY[normalizeKey(role)]?.title || role.key;
}

function roleDescription(role: RoleRow): string | undefined {
  return role.description?.trim() || ROLE_COPY[normalizeKey(role)]?.description;
}

export function InviteUserModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  // Same `qk.roles` cache entry as the Users page, so opening the modal does not refetch.
  const rolesQuery = useRolesList();
  const roles = rolesQuery.rows;
  const inviteMutation = useInviteUser();
  // WB — the modal used to show nothing at all when the invite was rejected without a mappable
  // field (rule 6: unmapped `details` and plain failures belong in a banner inside the modal).
  const [banner, setBanner] = useState<string | null>(null);
  const submitting = inviteMutation.isPending;

  const invitableRoles = sortInvitableRoles(roles);
  const rolesLoading = rolesQuery.isLoading;
  const rolesFailed = rolesQuery.isError && roles.length === 0;
  const noRoles = !rolesLoading && !rolesFailed && invitableRoles.length === 0;
  // Default: DISPATCHER if present, else the first non-ADMIN role, else nothing.
  const defaultRoleId =
    (
      invitableRoles.find((r) => normalizeKey(r) === 'DISPATCHER') ??
      invitableRoles.find((r) => normalizeKey(r) !== 'ADMIN')
    )?.id ?? '';
  // Tracked locally rather than with react-hook-form's `watch()` — `watch()` cannot be safely
  // memoized (its subscription changes every render), which opts the whole tree out of React
  // Compiler memoization (same pattern as `CreateGeofenceModal`, web/decisions.md). `setValue`
  // keeps react-hook-form's own copy in sync for validation/submit.
  // `null` = the user has not picked yet, so the default is derived from whatever
  // roles have loaded (they may arrive after mount) without ever overriding a real choice, and
  // the default alone never makes the form dirty.
  const [pickedRoleId, setPickedRoleId] = useState<string | null>(null);
  const roleKey = pickedRoleId ?? defaultRoleId;
  const [terminalsText, setTerminalsText] = useState('');
  const terminalIds = parseTerminalNames(terminalsText);
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
    setError,
    clearErrors,
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      roleKey: '',
    },
  });

  function submit() {
    // Sync the derived default into the form without touching dirty state.
    setValue('roleKey', roleKey);
    void handleSubmit(onSubmit, () => {
      // With no role to pick, "required" would be misleading — say why instead.
      if (noRoles) setError('roleKey', { message: NO_ROLES_MESSAGE });
    })();
  }

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
          toast({
            kind: 'success',
            title: 'Invitation sent',
            description: `An invitation was sent to ${values.email}.`,
          });
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
            for (const [rawField, msg] of Object.entries(error.fieldErrors)) {
              const field = FIELD_ALIASES[rawField] ?? rawField;
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
          <span className="mr-auto text-caption text-text-muted">
            The invitation expires in 7 days.
          </span>
          <ModalCancelButton disabled={submitting} />
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            onClick={submit}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Full name"
            required
            error={errors.firstName?.message ?? errors.lastName?.message}
          >
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
            <input
              {...register('email')}
              placeholder="anna.weiss@example.com"
              disabled={submitting}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-label text-text" id="invite-role-label">
            Role <span className="text-danger">*</span>
          </p>
          {rolesLoading ? (
            <div
              aria-busy="true"
              className="flex flex-col gap-2"
              data-testid="invite-role-skeleton"
            >
              <span className="sr-only">Loading roles</span>
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 rounded-md border border-border p-3"
                >
                  <div className="h-3 w-1/4 animate-pulse rounded bg-bg-subtle" />
                  <div className="h-2.5 w-3/5 animate-pulse rounded bg-bg-subtle" />
                </div>
              ))}
            </div>
          ) : rolesFailed ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-md bg-danger-soft px-3 py-2"
            >
              <span className="text-body text-danger">Could not load roles.</span>
              <Button variant="secondary" size="sm" onClick={() => void rolesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : noRoles ? (
            <p
              id="invite-role-error"
              role={errors.roleKey ? 'alert' : undefined}
              aria-labelledby="invite-role-label"
              className={
                'rounded-md border px-3 py-2 text-body ' +
                (errors.roleKey
                  ? 'border-danger bg-danger-soft text-danger'
                  : 'border-border bg-bg-subtle text-text-muted')
              }
            >
              {NO_ROLES_MESSAGE}
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby="invite-role-label"
              aria-invalid={errors.roleKey ? true : undefined}
              aria-describedby={errors.roleKey ? 'invite-role-error' : undefined}
              className="-mr-1 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1"
            >
              {invitableRoles.map((role) => {
                const description = roleDescription(role);
                const selected = roleKey === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting}
                    onClick={() => {
                      setPickedRoleId(role.id);
                      setValue('roleKey', role.id, { shouldDirty: true });
                      clearErrors('roleKey');
                    }}
                    className={
                      'shrink-0 rounded-md border p-3 text-left ' +
                      (selected
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-bg-subtle')
                    }
                  >
                    <p className="break-words text-body-strong text-text">{roleTitle(role)}</p>
                    {description && (
                      <p className="break-words text-caption text-text-muted">{description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {errors.roleKey?.message && !noRoles && (
            <span
              id="invite-role-error"
              role="alert"
              className="mt-1 block text-caption text-danger"
            >
              {errors.roleKey.message}
            </span>
          )}
        </div>

        {/* B-85 (shipped 2026-09-24) — `POST /users` now takes `terminalIds`/`message`. */}
        <Field
          label="Terminal access"
          hint="Stored on the user record only — it is not an access boundary yet; the user still sees every terminal's data. Leave it empty to record no scope."
        >
          <textarea
            value={terminalsText}
            onChange={(e) => setTerminalsText(e.target.value)}
            disabled={submitting}
            rows={2}
            placeholder="One terminal per line"
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
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
