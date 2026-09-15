// owner: web-settings-admin — 11.22 New support ticket (web/tz.md §11.22). `support`.
// ⚠️ Gap B-12 — `POST /support/tickets` requires `support:FULL`, but the design shows `+ New
// ticket` for every role including VIEWER (`support: READ`). The button stays in the DOM for
// every role; a VIEWER's submit surfaces the server's `403 FORBIDDEN` inline rather than
// pretending the ticket opened.
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateTicket } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { useState } from 'react';

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
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [forbiddenBanner, setForbiddenBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    mode: 'onBlur',
    defaultValues: { category: CATEGORIES[0], priority: 'NORMAL', subject: '', description: '' },
  });

  function onSubmit(values: TicketFormValues) {
    setForbiddenBanner(null);
    const notes = [
      values.description,
      includeDiagnostics ? '[Device diagnostics attached]' : null,
      includeEvents ? '[Last 24h of ELD events attached]' : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    createTicket.mutate(
      { subject: values.subject, body: notes, category: values.category, priority: values.priority },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Support ticket opened', description: 'Our team will reply by email.' });
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
      subtitle="Average first response 42 minutes"
      size="md"
      isDirty={isDirty}
      footer={
        <>
          <span className="mr-auto text-caption text-text-muted">Contact: {contactEmail}</span>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Submit ticket
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {forbiddenBanner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
            {forbiddenBanner}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" required error={errors.category?.message}>
            <select {...register('category')} disabled={isSubmitting} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" required error={errors.priority?.message}>
            <select {...register('priority')} disabled={isSubmitting} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subject" required error={errors.subject?.message}>
          <input {...register('subject')} disabled={isSubmitting} className={inputClass} />
        </Field>
        <Field label="Description" required error={errors.description?.message}>
          <textarea {...register('description')} rows={4} disabled={isSubmitting} className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text" />
        </Field>
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-body text-text">Attach screenshots, logs or photos</p>
          <p className="text-caption text-text-muted">PNG, JPG, PDF or LOG · up to 10 MB each</p>
        </div>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
          Include device diagnostics
        </label>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={includeEvents} onChange={(e) => setIncludeEvents(e.target.checked)} />
          Include the last 24 h of ELD events
        </label>
      </form>
    </Modal>
  );
}
