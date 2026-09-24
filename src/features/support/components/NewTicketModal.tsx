// owner: web-settings-admin — 11.22 New support ticket (web/tz.md §11.22). `support`.
// WB-250 — B-12 shipped: `POST /support/tickets` now only needs `support:READ`, so every role
// that can open this modal (route/nav gated on `support`) can submit. A server `403 FORBIDDEN`
// (e.g. a custom role changed mid-session) still surfaces inline rather than pretending the
// ticket opened.
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateTicket, type TicketAttachmentKind } from '@/shared/api/settingsAdmin';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { Field, inputClass } from './formKit';
import { useState } from 'react';
import { usePermission } from '@/shared/auth/usePermission';
import { SUPPORT_REASON, SUPPORT_TOAST } from '../lib/copy';

// Validation comes from the shared `ticketSchema`, which matches `CreateSupportTicketDto` (WB-026).
import { ticketSchema as ticketFormSchema, type TicketFormValues } from '@/shared/forms/schemas';

const CATEGORIES = ['ELD hardware', 'HOS & logs', 'Reports', 'Billing', 'Other'];
const PRIORITIES: { value: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'; label: string }[] = [
  { value: 'URGENT', label: 'Urgent — vehicle down' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

export function NewTicketModal({ contactEmail, onClose }: { contactEmail: string; onClose: () => void }) {
  const { toast } = useToast();
  const createTicket = useCreateTicket();
  const { can } = usePermission();
  const canSubmit = can('support', 'READ');
  const [forbiddenBanner, setForbiddenBanner] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [includeEvents, setIncludeEvents] = useState(false);
  const vehiclesQuery = useVehiclesPicker();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    mode: 'onBlur',
    defaultValues: { category: CATEGORIES[0], priority: 'NORMAL', subject: '', description: '' },
  });

  const busy = createTicket.isPending;

  function onSubmit(values: TicketFormValues) {
    // WB-146 — `mutate()` returns immediately, so RHF's `isSubmitting` is already false again by
    // the time the second click lands; guard on the mutation itself or a double click opens two.
    if (createTicket.isPending || !canSubmit) return;
    setForbiddenBanner(null);
    const attachments: Array<{ kind: TicketAttachmentKind }> = [];
    if (includeDiagnostics) attachments.push({ kind: 'DEVICE_DIAGNOSTICS' });
    if (includeEvents) attachments.push({ kind: 'ELD_EVENTS_24H' });
    createTicket.mutate(
      {
        subject: values.subject,
        body: values.description,
        category: values.category,
        priority: values.priority,
        vehicleId: vehicleId || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...SUPPORT_TOAST.ticketOpened });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 403) {
            setForbiddenBanner(error.userMessage);
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
      title="New support ticket"
      subtitle="Our team replies by email"
      size="md"
      isDirty={isDirty || includeDiagnostics || includeEvents || vehicleId !== ''}
      footer={
        <>
          <span className="mr-auto text-caption text-text-muted">Contact: {contactEmail}</span>
          <ModalCancelButton disabled={busy} />
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={!canSubmit}
            title={canSubmit ? undefined : SUPPORT_REASON.ticketForbidden}
            aria-describedby={canSubmit ? undefined : 'ticket-submit-forbidden'}
            onClick={handleSubmit(onSubmit)}
          >
            Submit ticket
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {!canSubmit && (
          <p id="ticket-submit-forbidden" className="rounded-md bg-bg-subtle px-3 py-2 text-caption text-text-secondary">
            {SUPPORT_REASON.ticketForbidden}
          </p>
        )}
        {forbiddenBanner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
            {forbiddenBanner}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" required error={errors.category?.message}>
            <select {...register('category')} disabled={busy} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" required error={errors.priority?.message}>
            <select {...register('priority')} disabled={busy} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subject" required error={errors.subject?.message}>
          <input {...register('subject')} disabled={busy} className={inputClass} />
        </Field>
        <Field label="Description" required error={errors.description?.message}>
          <textarea {...register('description')} rows={4} disabled={busy} className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text" />
        </Field>
        {/* Not a backend gap — the panel has no file upload; screenshots/logs/photos still cannot
            be attached (only the server-collected diagnostics kinds below can). */}
        <div
          aria-disabled="true"
          className="rounded-md border border-dashed border-border bg-bg-subtle p-4 text-center"
        >
          <p className="text-body text-text-muted">Attach screenshots, logs or photos</p>
          <p className="text-caption text-text-muted">{SUPPORT_REASON.attachments}</p>
        </div>
        {/* B-91 (shipped 2026-09-24) — `attachments: [{ kind }]`, assembled server-side from the
            named unit; nothing is uploaded from the browser. */}
        <Field label="Unit (for diagnostics)">
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={busy} className={inputClass}>
            <option value="">None</option>
            {(vehiclesQuery.data?.items ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.unitNumber}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-caption text-text-muted">Unit is needed only if either box below is checked.</p>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              disabled={busy}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
            />
            Include device diagnostics
          </label>
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={includeEvents}
              disabled={busy}
              onChange={(e) => setIncludeEvents(e.target.checked)}
            />
            Include the last 24 h of ELD events
          </label>
        </div>
      </form>
    </Modal>
  );
}
