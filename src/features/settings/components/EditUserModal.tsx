// owner: web-settings-admin — W-18 row menu `Edit user` / `Change role`.
// B-84 (shipped 2026-09-24) — `PATCH /users/:id` now also accepts `email`, `jobTitle`, `phone`
// and `homeTerminalName`. Changing `email` does not switch it immediately: the response carries
// `emailVerification.pendingEmail` and the address only changes once the link is confirmed
// (backend D-101) — the modal shows that as a notice rather than claiming an instant change.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { fields } from '@/shared/forms';
import { useUpdateUser, type RoleRow, type UserRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';

/** Same static home-terminal list `InviteUserModal` seeds — no Terminal table yet (D-090). */
const TERMINALS = [
  { name: 'Columbus, OH', label: 'Columbus, OH' },
  { name: 'Raleigh, NC', label: 'Raleigh, NC' },
] as const;

const editUserSchema = z.object({
  firstName: fields.requiredString(),
  lastName: fields.requiredString(),
  email: fields.email(),
  jobTitle: z.string().trim().max(100).optional(),
  phone: z.string().trim().optional(),
  homeTerminalName: z.string().trim().optional(),
});
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

export function EditUserModal({ user, roles, mode, activeAdminCount, onClose }: EditUserModalProps) {
  const { toast } = useToast();
  const updateUser = useUpdateUser();
  const [banner, setBanner] = useState<string | null>(null);
  const currentRoleId = user.role.id ?? roles.find((r) => r.key === user.role.key)?.id ?? '';
  const [roleId, setRoleId] = useState(currentRoleId);

  const {
    register,
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
      phone: user.phone ?? '',
      homeTerminalName: user.homeTerminalName ?? '',
    },
  });

  const submitting = updateUser.isPending;
  const dirty = (mode === 'profile' && isDirty) || roleId !== currentRoleId;
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // The same refusal as `Disable user`: demoting the last active administrator locks everyone out
  // of Settings. The server also answers 409 LAST_ADMIN — this only avoids a pointless round trip.
  const demotingLastAdmin =
    user.role.key === 'ADMIN' &&
    user.status === 'ACTIVE' &&
    activeAdminCount <= 1 &&
    roleId !== currentRoleId &&
    roles.find((r) => r.id === roleId)?.key !== 'ADMIN';

  function submit(values: EditUserValues) {
    if (submitting) return;
    if (demotingLastAdmin) return;
    setBanner(null);
    const dto: Parameters<typeof updateUser.mutate>[0]['dto'] = {};
    if (mode === 'profile') {
      dto.firstName = values.firstName;
      dto.lastName = values.lastName;
      dto.jobTitle = values.jobTitle || undefined;
      dto.phone = values.phone || undefined;
      dto.homeTerminalName = values.homeTerminalName || undefined;
      if (values.email !== user.email) dto.email = values.email;
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
          const name = mode === 'profile' ? `${values.firstName} ${values.lastName}` : `${user.firstName} ${user.lastName}`;
          const roleName = roles.find((r) => r.id === roleId)?.name ?? user.role.name;
          if (result.emailVerification?.pendingEmail) {
            setPendingEmail(result.emailVerification.pendingEmail);
            toast({
              kind: 'success',
              title: 'Verification email sent',
              description: `${name}'s email changes to ${result.emailVerification.pendingEmail} once the link is confirmed.`,
            });
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
          const message = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
          setBanner(message);
        },
      },
    );
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
            onClick={handleSubmit(submit)}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        {pendingEmail && (
          <p role="status" className="rounded-md bg-info-soft px-3 py-2 text-body text-info">
            A verification link was sent to {pendingEmail}. The address changes once the user confirms it — until then sign-in still uses {user.email}.
          </p>
        )}
        {mode === 'profile' && (
          <>
            <div className="grid grid-cols-2 gap-4">
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
              <input {...register('email')} disabled={submitting} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Job title">
                <input {...register('jobTitle')} disabled={submitting} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input {...register('phone')} disabled={submitting} className={inputClass} />
              </Field>
            </div>
            <Field label="Home terminal">
              <select {...register('homeTerminalName')} disabled={submitting} className={inputClass}>
                <option value="">All terminals</option>
                {TERMINALS.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field
          label="Role"
          required
          error={demotingLastAdmin ? 'This is the last active admin. Promote another user to Admin first.' : undefined}
        >
          <select
            value={roleId}
            aria-label="Role"
            onChange={(e) => setRoleId(e.target.value)}
            disabled={submitting}
            className={inputClass}
          >
            {roles.map((r) => (
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
