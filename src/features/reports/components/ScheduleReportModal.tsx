// owner: web-reports-transfer — `Schedule a report` / `Schedule` (W-12…W-14) → POST /reports/schedules.
//
// No §11 overlay is drawn for this and §13.3 has no schedule toast, so the modal closes without one
// rather than inventing wording (web/decisions.md WD-043). Q-2: delivery is email only; the DTO has
// no SMS channel at all.
//
// B-48 (shipped): `Period` sends `params.window` — the scheduler resolves it to a concrete period on
// every run, in the schedule's (carrier) zone — or pins the page's own range when `This selection`
// is chosen. `Format` offers exactly `REPORT_TYPE_FORMATS[type]` (PDF for IFTA / Activity / DVIR).
import { useRef } from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  REPORT_TYPE_FORMATS,
  useCreateReportSchedule,
  type GeneratableReportType,
  type ReportFormat,
  type ReportWindow,
} from '@/shared/api/reports';
import { email } from '@/shared/forms/fields';
import { VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { Button } from '@/shared/ui/Button';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { REPORT_LABEL, periodOf, refusalText } from '../reportMeta';
import { ActionAlert } from './ActionAlert';

const SCHEDULE_FREQUENCIES = {
  DAILY: { label: 'Every day at 06:00', cron: '0 6 * * *' },
  WEEKLY: { label: 'Every Monday at 06:00', cron: '0 6 * * 1' },
  MONTHLY: { label: 'The 1st of every month at 06:00', cron: '0 6 1 * *' },
} as const;

const WINDOW_LABEL: Record<ReportWindow, string> = {
  PREVIOUS_WEEK: 'Previous week (Mon – Sun)',
  PREVIOUS_MONTH: 'Previous calendar month',
  PREVIOUS_QUARTER: 'Previous quarter',
};
/** IFTA is filed by quarter — a week or month window would only resolve to "that quarter". */
const windowsFor = (type: GeneratableReportType): ReportWindow[] =>
  type === 'IFTA' ? ['PREVIOUS_QUARTER'] : ['PREVIOUS_WEEK', 'PREVIOUS_MONTH', 'PREVIOUS_QUARTER'];

/** The page's fixed range keys, dropped when a rolling window replaces them. */
const FIXED_PERIOD_KEYS = ['from', 'to', 'quarter'];

const scheduleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  period: z.enum(['FIXED', 'PREVIOUS_WEEK', 'PREVIOUS_MONTH', 'PREVIOUS_QUARTER']),
  format: z.enum(['CSV', 'PDF', 'XLSX']),
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
    defaultValues: {
      frequency: 'WEEKLY',
      // A repeating schedule wants a repeating period; `This selection` stays one click away.
      period: windowsFor(reportType)[0],
      format: REPORT_TYPE_FORMATS[reportType][0],
      recipients: '',
    },
  });
  const { register, handleSubmit, formState, reset } = form;
  const busy = formState.isSubmitting || create.isPending;
  // WB-146 — `isSubmitting`/`isPending` only turn true on the next render, so two clicks in the
  // same tick both reach the handler. The ref makes the submit non-reentrant.
  const inFlight = useRef(false);

  const close = () => {
    reset();
    create.reset();
    onClose();
  };

  const submitForm = handleSubmit(async (values) => {
    await create
      .mutateAsync({
        reportType,
        format: values.format as ReportFormat,
        params:
          values.period === 'FIXED'
            ? params
            : {
                ...Object.fromEntries(Object.entries(params).filter(([key]) => !FIXED_PERIOD_KEYS.includes(key))),
                window: values.period,
              },
        cron: SCHEDULE_FREQUENCIES[values.frequency].cron,
        timezone,
        recipients: values.recipients.split(',').map((s) => s.trim()).filter(Boolean),
        enabled: true,
      })
      .then(close)
      .catch(() => undefined);
  });

  /** The non-reentrant entry point — the ref is only ever touched from an event handler. */
  const submit = (event?: BaseSyntheticEvent) => {
    if (inFlight.current || create.isPending) return;
    inFlight.current = true;
    void submitForm(event).finally(() => {
      inFlight.current = false;
    });
  };

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
          {/* WB-145 — 11.30 Discard changes on Cancel, handled by the Modal itself. */}
          <ModalCancelButton disabled={busy} />
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
            Period <span className="text-danger">*</span>
          </span>
          <select
            {...register('period')}
            disabled={busy}
            aria-describedby="schedule-period-hint"
            className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
          >
            {windowsFor(reportType).map((w) => (
              <option key={w} value={w}>
                {WINDOW_LABEL[w]}
              </option>
            ))}
            <option value="FIXED">{`This selection · ${periodOf({ params })}`}</option>
          </select>
          <span id="schedule-period-hint" className="text-card-sub font-normal text-text-muted">
            A rolling period is worked out again on every run, in the company time zone.
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-body-strong text-text">
          <span>
            Format <span className="text-danger">*</span>
          </span>
          <select
            {...register('format')}
            disabled={busy}
            className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
          >
            {REPORT_TYPE_FORMATS[reportType].map((f) => (
              <option key={f} value={f}>
                {f}
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
    </>
  );
}
