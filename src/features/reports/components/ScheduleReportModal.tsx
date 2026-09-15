// owner: web-reports-transfer — `Schedule a report` / `Schedule` (W-12…W-14) → POST /reports/schedules.
//
// No §11 overlay is drawn for this and §13.3 has no schedule toast, so the modal closes without one
// rather than inventing wording (web/decisions.md WD-043). Q-2: delivery is email only; the DTO has
// no SMS channel at all.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateReportSchedule, type GeneratableReportType } from '@/shared/api/reports';
import { email } from '@/shared/forms/fields';
import { VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { Button } from '@/shared/ui/Button';
import { DiscardChangesDialog, Modal } from '@/shared/ui/Modal';
import { REPORT_LABEL, refusalText } from '../reportMeta';
import { ActionAlert } from './ActionAlert';

const SCHEDULE_FREQUENCIES = {
  DAILY: { label: 'Every day at 06:00', cron: '0 6 * * *' },
  WEEKLY: { label: 'Every Monday at 06:00', cron: '0 6 * * 1' },
  MONTHLY: { label: 'The 1st of every month at 06:00', cron: '0 6 1 * *' },
} as const;

const scheduleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  recipients: z
    .string()
    .trim()
    .min(1, M.required)
    .refine(
      (value) => value.split(',').map((s) => s.trim()).filter(Boolean).every((addr) => email().safeParse(addr).success),
      M.email,
    ),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

export interface ScheduleReportModalProps {
  open: boolean;
  onClose: () => void;
  reportType: GeneratableReportType;
  params: Record<string, unknown>;
  /** Carrier zone — the cron runs on the company clock (§8.3). */
  timezone: string;
}

export function ScheduleReportModal({ open, onClose, reportType, params, timezone }: ScheduleReportModalProps) {
  const create = useCreateReportSchedule();
  const form = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { frequency: 'WEEKLY', recipients: '' },
  });
  const { register, handleSubmit, formState, reset } = form;
  const busy = formState.isSubmitting || create.isPending;
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const close = () => {
    reset();
    create.reset();
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    await create
      .mutateAsync({
        reportType,
        format: reportType === 'FMCSA_PACK' ? 'PDF' : 'CSV',
        params,
        cron: SCHEDULE_FREQUENCIES[values.frequency].cron,
        timezone,
        recipients: values.recipients.split(',').map((s) => s.trim()).filter(Boolean),
        enabled: true,
      })
      .then(close)
      .catch(() => undefined);
  });

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title="Schedule a report"
      subtitle={`${REPORT_LABEL[reportType]} · delivered by email`}
      size="sm"
      isDirty={formState.isDirty && !create.isSuccess}
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => (formState.isDirty ? setConfirmDiscard(true) : close())}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={busy} disabled={busy} onClick={() => void submit()}>
            Schedule
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <ActionAlert message={create.isError ? refusalText(create.error) : null} />
        <label className="flex flex-col gap-1.5 text-body-strong text-text">
          <span>
            Frequency <span className="text-danger">*</span>
          </span>
          <select
            {...register('frequency')}
            disabled={busy}
            className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
          >
            {Object.entries(SCHEDULE_FREQUENCIES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-body-strong text-text">
          <span>
            Recipients <span className="text-danger">*</span>
          </span>
          <input
            {...register('recipients')}
            type="text"
            disabled={busy}
            placeholder="ops@universal-logistics.example"
            aria-invalid={Boolean(formState.errors.recipients) || undefined}
            aria-describedby="schedule-recipients-hint"
            className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
          />
          <span id="schedule-recipients-hint" className={formState.errors.recipients ? 'text-card-sub font-normal text-danger' : 'text-card-sub font-normal text-text-muted'}>
            {formState.errors.recipients?.message ?? 'Separate addresses with commas.'}
          </span>
        </label>
      </form>
    </Modal>
    <DiscardChangesDialog
      open={confirmDiscard}
      onKeepEditing={() => setConfirmDiscard(false)}
      onDiscard={() => {
        setConfirmDiscard(false);
        close();
      }}
    />
    </>
  );
}
