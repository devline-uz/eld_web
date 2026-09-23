// owner: web-settings-admin — W-18 row menu `Edit user` / `Change role`.
// `PATCH /users/:id` accepts `firstName`, `lastName`, `roleId` and `status` and nothing else, so
// this modal only offers those. Work email, job title, phone and terminal access are not on the
// update DTO (⛔ GAP B-84) and are deliberately absent rather than
// collected and dropped; the reason is on screen.
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
import { SETTINGS_REASON, SETTINGS_TOAST } from '../lib/copy';

const editUserSchema = z.object({
  firstName: fields.requiredString(),
  lastName: fields.requiredString(),
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
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const submitting = updateUser.isPending;
  const dirty = (mode === 'profile' && isDirty) || roleId !== currentRoleId;

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
    }
    if (roleId && roleId !== currentRoleId) dto.roleId = roleId;
    if (Object.keys(dto).length === 0) {
      onClose();
      return;
    }
    updateUser.mutate(
      { id: user.id, dto },
      {
        onSuccess: () => {
          const name = mode === 'profile' ? `${values.firstName} ${values.lastName}` : `${user.firstName} ${user.lastName}`;
          const roleName = roles.find((r) => r.id === roleId)?.name ?? user.role.name;
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
        {mode === 'profile' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required error={errors.firstName?.message}>
              <input {...register('firstName')} disabled={submitting} className={inputClass} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <input {...register('lastName')} disabled={submitting} className={inputClass} />
            </Field>
          </div>
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
        <p className="text-caption text-text-muted">
          {SETTINGS_REASON.editUserFixedFields}
        </p>
      </form>
    </Modal>
  );
}
