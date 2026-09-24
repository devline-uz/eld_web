// owner: web-settings-admin — 11.19 Create a role (web/tz.md §11.19). `roles` FULL.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { roleSchema } from '@/shared/forms/schemas';
import { useCreateRole, useUpdateRole, type RoleRow } from '@/shared/api/settingsAdmin';
import type { PermissionKey, PermissionLevel } from '@/shared/auth/permissions';
import { NO_PERMISSIONS } from '@/shared/auth/permissions';
import { Field, inputClass } from './formKit';
import { ROLE_COPY } from '../lib/copy';

const SEGMENT_ROWS: { label: string; keys: PermissionKey[]; defaultLevel: PermissionLevel }[] = [
  { label: 'Vehicles', keys: ['vehicles', 'liveFleet'], defaultLevel: 'READ' },
  { label: 'Drivers', keys: ['drivers'], defaultLevel: 'READ' },
  { label: 'HOS logs & edits', keys: ['hos', 'hosEdit'], defaultLevel: 'READ' },
  { label: 'DVIR & maintenance', keys: ['dvir', 'maintenance', 'safety'], defaultLevel: 'READ' },
  { label: 'Reports & exports', keys: ['reports'], defaultLevel: 'FULL' },
  { label: 'Users & roles', keys: ['users', 'roles'], defaultLevel: 'NONE' },
];

const LEVELS: PermissionLevel[] = ['NONE', 'READ', 'FULL'];

const DEFAULT_SEGMENT_LEVELS: Record<string, PermissionLevel> = Object.fromEntries(
  SEGMENT_ROWS.map((r) => [r.label, r.defaultLevel]),
);

/** The six grid rows read back off an existing role's permission map. */
function levelsOf(role: RoleRow): Record<string, PermissionLevel> {
  return Object.fromEntries(SEGMENT_ROWS.map((row) => [row.label, role.permissions[row.keys[0]!] ?? 'NONE']));
}

export function CreateRoleModal({
  templates,
  role,
  onClose,
}: {
  templates: RoleRow[];
  /** Present ⇒ the modal edits that role through `PATCH /roles/:id` instead of creating one. */
  role?: RoleRow;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const editing = role !== undefined;
  const seededLevels = role ? levelsOf(role) : DEFAULT_SEGMENT_LEVELS;
  const seededExport = role ? role.permissions.reportsTransfer === 'FULL' : true;
  const seededDataTransfer = role ? role.permissions.dataTransfer === 'FULL' : true;
  const [copyFrom, setCopyFrom] = useState<string>('');
  const [segmentLevels, setSegmentLevels] = useState<Record<string, PermissionLevel>>(seededLevels);
  const [canExportFmcsa, setCanExportFmcsa] = useState(seededExport);
  const [canSendDataTransfer, setCanSendDataTransfer] = useState(seededDataTransfer);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
  } = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(roleSchema.pick({ name: true, description: true })),
    mode: 'onBlur',
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  });

  const submitting = createRole.isPending || updateRole.isPending;
  // The permission grid and the two checkboxes live outside react-hook-form; without them a real
  // edit closed with no 11.30 confirm.
  const dirty =
    isDirty ||
    copyFrom !== '' ||
    canExportFmcsa !== seededExport ||
    canSendDataTransfer !== seededDataTransfer ||
    SEGMENT_ROWS.some((row) => segmentLevels[row.label] !== seededLevels[row.label]);

  function applyTemplate(roleId: string) {
    setCopyFrom(roleId);
    const template = templates.find((r) => r.id === roleId);
    if (!template) return;
    setSegmentLevels({
      Vehicles: template.permissions.vehicles,
      Drivers: template.permissions.drivers,
      'HOS logs & edits': template.permissions.hos,
      'DVIR & maintenance': template.permissions.dvir,
      'Reports & exports': template.permissions.reports,
      'Users & roles': template.permissions.users,
    });
  }

  function onSubmit(values: { name: string; description?: string }) {
    // `mutate()` resolves RHF's `submitting` before the request lands — a double click created
    // two roles. Guard on the mutation.
    if (submitting) return;
    const template = templates.find((r) => r.id === copyFrom);
    const base: Record<PermissionKey, PermissionLevel> = template
      ? { ...template.permissions }
      : role
        ? { ...role.permissions }
        : ({ ...NO_PERMISSIONS } as Record<PermissionKey, PermissionLevel>);

    for (const row of SEGMENT_ROWS) {
      for (const key of row.keys) base[key] = segmentLevels[row.label] ?? 'NONE';
    }
    // B-95 (shipped 2026-09-24) — `dataTransfer` is its own 23rd key; the pack export and the
    // inspector transfer are two independent checkboxes again.
    base.reportsTransfer = canExportFmcsa ? 'FULL' : 'NONE';
    base.dataTransfer = canSendDataTransfer ? 'FULL' : 'NONE';
    base.hosCertifyOnBehalf = base.hosCertifyOnBehalf ?? 'NONE';
    base.carrierSettings = base.carrierSettings ?? 'NONE';

    const key = values.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const handlers = {
      onSuccess: () => {
        toast({ kind: 'success' as const, title: editing ? 'Role updated' : 'Role created' });
        onClose();
      },
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          setError('name', { message: 'A role with this name already exists.' });
          return;
        }
        toast({ kind: 'error' as const, title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    };

    if (editing) {
      updateRole.mutate(
        { id: role.id, dto: { name: values.name, description: values.description, permissions: base } },
        handlers,
      );
      return;
    }

    createRole.mutate(
      { key: key || 'CUSTOM_ROLE', name: values.name, description: values.description, permissions: base },
      handlers,
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${role.name}` : 'Create a role'}
      subtitle={editing ? 'Changes apply immediately to every user with this role' : 'Start from a template and adjust the permissions'}
      size="lg"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={handleSubmit(onSubmit)}>
            {editing ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Compliance auditor" disabled={submitting} className={inputClass} />
          </Field>
          <Field label="Copy permissions from">
            <select value={copyFrom} onChange={(e) => applyTemplate(e.target.value)} disabled={submitting} className={inputClass}>
              <option value="">{editing ? '— Keep the current permissions —' : '— Start from scratch —'}</option>
              {templates
                .filter((t) => t.id !== role?.id)
                .filter((t) => !t.isSystem || t.key !== 'ADMIN')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            {...register('description')}
            rows={2}
            placeholder="Read-only access to logs, DVIRs and reports for internal audits."
            disabled={submitting}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </Field>

        <div>
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Permissions</p>
          <div className="flex flex-col gap-2">
            {SEGMENT_ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-body text-text">{row.label}</span>
                <div className="flex h-8 overflow-hidden rounded-md border border-border">
                  {LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSegmentLevels((prev) => ({ ...prev, [row.label]: level }))}
                      className={
                        'px-2.5 text-caption capitalize ' +
                        (segmentLevels[row.label] === level
                          ? 'bg-bg-inverse text-text-inverse'
                          : 'bg-bg-surface text-text-secondary hover:bg-bg-subtle')
                      }
                    >
                      {level === 'NONE' ? 'None' : level === 'READ' ? 'Read' : 'Full'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={canExportFmcsa} onChange={(e) => setCanExportFmcsa(e.target.checked)} disabled={submitting} />
          {ROLE_COPY.fmcsaPackCheckbox}
        </label>
        <label className="flex items-center gap-2 text-body text-text">
          <input
            type="checkbox"
            checked={canSendDataTransfer}
            onChange={(e) => setCanSendDataTransfer(e.target.checked)}
            disabled={submitting}
          />
          {ROLE_COPY.dataTransferCheckbox}
        </label>
      </form>
    </Modal>
  );
}
