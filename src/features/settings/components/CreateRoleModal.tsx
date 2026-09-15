// owner: web-settings-admin — 11.19 Create a role (web/tz.md §11.19). `roles` FULL.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { roleSchema } from '@/shared/forms/schemas';
import { useCreateRole, type RoleRow } from '@/shared/api/settingsAdmin';
import type { PermissionKey, PermissionLevel } from '@/shared/auth/permissions';
import { NO_PERMISSIONS } from '@/shared/auth/permissions';
import { Field, inputClass } from './formKit';

const SEGMENT_ROWS: { label: string; keys: PermissionKey[]; defaultLevel: PermissionLevel }[] = [
  { label: 'Vehicles', keys: ['vehicles', 'liveFleet'], defaultLevel: 'READ' },
  { label: 'Drivers', keys: ['drivers'], defaultLevel: 'READ' },
  { label: 'HOS logs & edits', keys: ['hos', 'hosEdit'], defaultLevel: 'READ' },
  { label: 'DVIR & maintenance', keys: ['dvir', 'maintenance', 'safety'], defaultLevel: 'READ' },
  { label: 'Reports & exports', keys: ['reports'], defaultLevel: 'FULL' },
  { label: 'Users & roles', keys: ['users', 'roles'], defaultLevel: 'NONE' },
];

const LEVELS: PermissionLevel[] = ['NONE', 'READ', 'FULL'];

export function CreateRoleModal({ templates, onClose }: { templates: RoleRow[]; onClose: () => void }) {
  const { toast } = useToast();
  const createRole = useCreateRole();
  const [copyFrom, setCopyFrom] = useState<string>('');
  const [segmentLevels, setSegmentLevels] = useState<Record<string, PermissionLevel>>(
    Object.fromEntries(SEGMENT_ROWS.map((r) => [r.label, r.defaultLevel])),
  );
  const [canExportFmcsa, setCanExportFmcsa] = useState(true);
  const [canSendTransfers, setCanSendTransfers] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(roleSchema.pick({ name: true, description: true })),
    mode: 'onBlur',
    defaultValues: { name: '', description: '' },
  });

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
    const template = templates.find((r) => r.id === copyFrom);
    const base: Record<PermissionKey, PermissionLevel> = template
      ? { ...template.permissions }
      : ({ ...NO_PERMISSIONS } as Record<PermissionKey, PermissionLevel>);

    for (const row of SEGMENT_ROWS) {
      for (const key of row.keys) base[key] = segmentLevels[row.label] ?? 'NONE';
    }
    base.reportsTransfer = canExportFmcsa ? 'FULL' : 'NONE';
    // "Can send data transfers" rides the same reportsTransfer key (§11.19 note — no distinct
    // backend key for it yet); the export checkbox therefore governs both.
    if (canSendTransfers) base.reportsTransfer = 'FULL';
    base.hosCertifyOnBehalf = base.hosCertifyOnBehalf ?? 'NONE';
    base.carrierSettings = base.carrierSettings ?? 'NONE';

    const key = values.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    createRole.mutate(
      { key: key || 'CUSTOM_ROLE', name: values.name, description: values.description, permissions: base },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Role created' });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setError('name', { message: 'A role with this name already exists.' });
            return;
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
      title="Create a role"
      subtitle="Start from a template and adjust the permissions"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Create role
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Compliance auditor" disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Copy permissions from">
            <select value={copyFrom} onChange={(e) => applyTemplate(e.target.value)} disabled={isSubmitting} className={inputClass}>
              <option value="">— Start from scratch —</option>
              {templates
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
            disabled={isSubmitting}
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
          <input type="checkbox" checked={canExportFmcsa} onChange={(e) => setCanExportFmcsa(e.target.checked)} disabled={isSubmitting} />
          Can export FMCSA / DOT pack
        </label>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={canSendTransfers} onChange={(e) => setCanSendTransfers(e.target.checked)} disabled={isSubmitting} />
          Can send data transfers
        </label>
      </form>
    </Modal>
  );
}
