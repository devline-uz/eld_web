// owner: web-reports-transfer — ⭐ 11.14 Send logs to a safety official (FMCSA §395.34 data transfer).
// Design: web/roles and screens/sheets, modals, drawers, menus/Settings — permission matrix across roles.jpg
// Perm `reportsTransfer` FULL · POST /transfers { driverId, method, rangeStart, rangeEnd, outputFileComment, recipient? }
//
// FMCSA constraints are enforced here exactly, never widened: an inspector address must end in
// `fmcsa.dot.gov`, `outputFileComment` is 1–60 characters, the range is at most 8 RODS days.
// The rules and their strings come from shared/forms; this schema only fixes two defects of
// `transferSchema` (web/bugs.md WB-029): it required `recipient` for eRODS too, and spelled the
// method `WEB_SERVICE` where the backend enum is `WEB_SERVICES`.
//
// Test mode is never hidden: the banner shows unless the carrier is positively PRODUCTION, the
// success toast is the warning variant when the file was built in TEST mode, and the modal stays
// open on the result so `Download a copy` can hand the file to the officer (web/decisions.md WD-044).
// The file name is never built client-side — it is the backend's `fileName` (§4.8.2.2).
import { useEffect, useRef } from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, Download, Send } from 'lucide-react';
import { ApiError, ERROR_MESSAGES } from '@/shared/api/errors';
import { useLogRange } from '@/shared/api/hosLogs';
import {
  TRANSFER_FINAL_STATUSES,
  downloadTransferFile,
  useCreateTransfer,
  useReportDrivers,
  usePendingUnassignedCount,
  useTransfer,
  type CreateTransferResponse,
  type ErodsMode,
  type TransferMethod,
} from '@/shared/api/reports';
import { Can } from '@/shared/auth/Can';
import { daySpan } from '@/shared/forms/fields';
import { LIMITS, VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { formatInTz } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { TOAST_COPY } from '@/shared/ui/copy';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { DriverPicker } from '@/shared/ui/DriverPicker';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import {
  TRANSFER_RESULT_BADGE,
  dateOfDayKey,
  dayKeyOf,
  refusalText,
  saveFile,
  shiftDayKey,
  todayKey,
} from '../reportMeta';
import { TEST_BANNER_TEXT, sendLogsSchema, type SendLogsValues } from '../sendLogs';
import { ActionAlert } from './ActionAlert';

export interface SendLogsInitial {
  driverId?: string;
  from?: string;
  to?: string;
  method?: TransferMethod;
  recipient?: string;
  outputFileComment?: string;
}

export interface SendLogsModalProps {
  open: boolean;
  onClose: () => void;
  initial?: SendLogsInitial;
  /** `undefined` = not readable for this role (B-45) → treated as TEST, never hidden. */
  erodsMode: ErodsMode | undefined;
  eldIdentifier?: string;
  /** Carrier zone, only to resolve "today" for the default range end. */
  timezone: string;
}

const METHODS: { value: TransferMethod; title: string; description: string }[] = [
  { value: 'WEB_SERVICES', title: 'Web services (eRODS)', description: 'Uploads directly to the FMCSA endpoint. Preferred at roadside.' },
  { value: 'EMAIL', title: 'Email to a safety official', description: 'Encrypted file sent to an fmcsa.dot.gov address only.' },
];

const FIELD_OF: Record<string, keyof SendLogsValues> = {
  driverId: 'driverId',
  recipient: 'recipient',
  outputFileComment: 'outputFileComment',
  rangeStart: 'from',
  rangeEnd: 'to',
};

export function SendLogsModal({ open, onClose, initial, erodsMode, eldIdentifier, timezone }: SendLogsModalProps) {
  const { toast } = useToast();
  const create = useCreateTransfer();
  const result: CreateTransferResponse | undefined = create.data;
  const live = useTransfer(result?.transfer.id);
  const toasted = useRef<string | null>(null);
  // WB-146 — `isSubmitting`/`isPending` only turn true on the next render, so two clicks in the
  // same tick both reach the handler. The ref makes the submit non-reentrant.
  const inFlight = useRef(false);

  const to = initial?.to ?? todayKey(timezone);
  const form = useForm<SendLogsValues>({
    resolver: zodResolver(sendLogsSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      driverId: initial?.driverId ?? '',
      method: initial?.method ?? 'WEB_SERVICES',
      recipient: initial?.recipient ?? '',
      outputFileComment: initial?.outputFileComment ?? '',
      from: initial?.from ?? shiftDayKey(to, -(LIMITS.transferRangeDays - 1)),
      to,
    },
  });
  const { register, handleSubmit, setValue, formState, setError, control } = form;
  const values = useWatch({ control }) as SendLogsValues;
  const busy = formState.isSubmitting || create.isPending;
  const sent = Boolean(result);
  const span = daySpan(values.from, values.to);
  const rangeOk = Number.isFinite(span) && span >= 1 && span <= LIMITS.transferRangeDays;

  const drivers = useReportDrivers();
  const driverOptions = (drivers.data?.items ?? []).map((d) => ({
    id: d.id,
    name: `${d.firstName} ${d.lastName}`,
    context: d.homeTerminalName ?? '',
  }));
  const selectedDriver = driverOptions.find((o) => o.id === values.driverId);

  // Pre-send picture from real data; the server's own warnings replace it once the file exists.
  const range = useLogRange(rangeOk ? values.driverId || undefined : undefined, values.from, values.to);
  const unassigned = usePendingUnassignedCount(values.from, values.to, rangeOk);
  const uncertified = range.data ? range.data.days.filter((d) => !d.certified).length : null;
  const pendingSegments = unassigned.data?.total ?? null;

  const status = live.data?.status ?? result?.transfer.status;
  const builtInTest = result ? result.transfer.erodsMode === 'TEST' : erodsMode !== 'PRODUCTION';

  useEffect(() => {
    if (!result || toasted.current === result.transfer.id) return;
    if (result.transfer.erodsMode === 'TEST' || status === 'TEST_ONLY') {
      toasted.current = result.transfer.id;
      toast({ kind: 'warning', ...TOAST_COPY.transferTestMode });
      return;
    }
    if (status && TRANSFER_FINAL_STATUSES.includes(status)) {
      toasted.current = result.transfer.id;
      if (status === 'SENT' || status === 'ACCEPTED') toast({ kind: 'success', ...TOAST_COPY.transferSent });
      else
        toast({
          kind: 'error',
          title: TOAST_COPY.transferFailed.title,
          description: live.data?.responseCode === '503' ? TOAST_COPY.transferFailed.description : (live.data?.responseBody ?? undefined),
        });
    }
  }, [result, status, live.data, toast]);

  const submitForm = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({
        driverId: v.driverId,
        method: v.method,
        rangeStart: v.from,
        rangeEnd: v.to,
        outputFileComment: v.outputFileComment.trim(),
        ...(v.method === 'EMAIL' ? { recipient: (v.recipient ?? '').trim() } : {}),
      });
    } catch (error) {
      if (!(error instanceof ApiError)) return;
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const target = FIELD_OF[field];
        if (target) setError(target, { message });
      }
      if (error.code === 'INVALID_TRANSFER_RECIPIENT') setError('recipient', { message: error.userMessage });
      if (error.code === 'RANGE_TOO_LARGE') setError('to', { message: M.transferRange });
    }
  });

  /** The non-reentrant entry point — the ref is only ever touched from an event handler. */
  const submit = (event?: BaseSyntheticEvent) => {
    if (inFlight.current || create.isPending) return;
    inFlight.current = true;
    void submitForm(event).finally(() => {
      inFlight.current = false;
    });
  };

  const close = () => {
    create.reset();
    onClose();
  };

  const subtitle = `FMCSA §395.34 data transfer · ${Number.isFinite(span) ? span : EMPTY.dash} days ending ${formatInTz(`${values.to}T00:00:00Z`, 'UTC', 'MMM dd, yyyy')}`;

  const issues: { code: string; text: string }[] = result
    ? result.warnings.map((w) => ({ code: w.code, text: ERROR_MESSAGES[w.code] ?? w.message }))
    : [
        ...(pendingSegments ? [{ code: 'UNRESOLVED_UNIDENTIFIED', text: ERROR_MESSAGES.UNRESOLVED_UNIDENTIFIED as string }] : []),
        ...(uncertified ? [{ code: 'UNCERTIFIED_LOGS', text: ERROR_MESSAGES.UNCERTIFIED_LOGS as string }] : []),
      ];
  const precheckKnown = result || (uncertified !== null && pendingSegments !== null);

  const events = result?.counts.events;
  // Daily logs are the RODS days the range holds, not its calendar days (WB-101).
  const dailyLogs = range.data?.days.length;
  const records = `${dailyLogs ?? EMPTY.dash} daily logs · ${events ?? EMPTY.dash} events · ${pendingSegments ?? EMPTY.dash} unassigned`;
  const certificate = `ELD registration #${eldIdentifier ?? EMPTY.dash}${builtInTest ? ' · TEST (pending)' : ''}`;

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title="Send logs to a safety official"
      subtitle={subtitle}
      size="lg"
      isDirty={formState.isDirty && !sent}
      footer={
        <>
          {/* WB-145 — 11.30 Discard changes on Cancel, handled by the Modal itself. */}
          <ModalCancelButton disabled={busy}>{sent ? 'Close' : 'Cancel'}</ModalCancelButton>
          <Button
            variant="secondary"
            size="lg"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            disabled={!result}
            onClick={() => {
              if (!result) return;
              downloadTransferFile(result.transfer.id)
                .then((blob) => saveFile(blob, result.transfer.fileName))
                .catch((error: unknown) => toast({ kind: 'error', title: refusalText(error) }));
            }}
          >
            Download a copy
          </Button>
          {!sent && (
            <Can perm="reportsTransfer" level="FULL">
              <Button
                variant="primary"
                size="lg"
                iconLeft={<Send size={16} strokeWidth={1.75} />}
                loading={busy}
                disabled={busy}
                onClick={() => void submit()}
              >
                Send transfer
              </Button>
            </Can>
          )}
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {builtInTest && (
          <div role="status" className="flex gap-3 rounded-md border border-warning bg-warning-soft px-4 py-3 text-warning">
            <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-body-strong">eRODS · TEST mode</p>
              <p className="text-body">{TEST_BANNER_TEXT}</p>
            </div>
          </div>
        )}

        <ActionAlert message={create.isError ? refusalText(create.error) : null} />

        <fieldset disabled={busy || sent} className="contents">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-body-strong text-text" id="send-driver-label">
                Driver <span className="text-danger">*</span>
              </span>
              <DriverPicker
                value={selectedDriver}
                options={driverOptions}
                placeholder="Select a driver"
                onSelect={(option) => setValue('driverId', option.id, { shouldDirty: true, shouldValidate: true })}
              />
              <FieldError id="send-driver-error" message={formState.errors.driverId?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-body-strong text-text">
                Date range <span className="text-danger">*</span>
              </span>
              <DateRangePicker
                value={{ from: dateOfDayKey(values.from), to: dateOfDayKey(values.to) }}
                onChange={(next) => {
                  setValue('from', dayKeyOf(next.from), { shouldDirty: true });
                  setValue('to', dayKeyOf(next.to), { shouldDirty: true, shouldValidate: true });
                }}
              />
              <FieldError id="send-range-error" message={formState.errors.to?.message} />
            </div>
          </div>

          <div role="radiogroup" aria-label="Transfer method" className="flex flex-col gap-2">
            <span className="text-table-head font-semibold uppercase tracking-wide text-text-muted">Transfer method</span>
            {METHODS.map((m) => {
              const selected = values.method === m.value;
              return (
                <label
                  key={m.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                    selected ? 'border-primary bg-primary-soft' : 'border-border bg-bg-surface',
                  )}
                >
                  <input type="radio" value={m.value} {...register('method')} className="mt-1" />
                  <span>
                    <span className="block text-body-strong text-text">{m.title}</span>
                    <span className="block text-card-sub text-text-muted">{m.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {values.method === 'EMAIL' && (
            <label className="flex flex-col gap-1.5 text-body-strong text-text">
              <span>
                Inspector email address <span className="text-danger">*</span>
              </span>
              <input
                type="email"
                {...register('recipient')}
                placeholder="name@fmcsa.dot.gov"
                aria-invalid={Boolean(formState.errors.recipient) || undefined}
                aria-describedby="send-recipient-error"
                className="h-btn-lg rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
              />
              <FieldError id="send-recipient-error" message={formState.errors.recipient?.message} />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-body-strong text-text">
            <span>
              Output file comment <span className="text-danger">*</span>
            </span>
            <input
              type="text"
              {...register('outputFileComment')}
              placeholder="ROADSIDE INSPECTION 2025-09-10"
              aria-invalid={Boolean(formState.errors.outputFileComment) || undefined}
              aria-describedby="send-comment-hint"
              className="h-btn-lg rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
            />
            <span id="send-comment-hint" className="flex justify-between text-card-sub font-normal">
              <span className={formState.errors.outputFileComment ? 'text-danger' : 'text-text-muted'}>
                {formState.errors.outputFileComment?.message ?? 'Provided by the safety official. Maximum 60 characters.'}
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  (values.outputFileComment ?? '').length > LIMITS.outputFileCommentMax ? 'text-danger' : 'text-text-muted',
                )}
              >
                {`${(values.outputFileComment ?? '').length}/${LIMITS.outputFileCommentMax}`}
              </span>
            </span>
          </label>
        </fieldset>

        <dl className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle p-4 text-card-sub">
          <dt className="text-table-head font-semibold uppercase tracking-wide text-text-muted">File preview</dt>
          <PreviewRow label="File name" value={result?.transfer.fileName ?? EMPTY.dash} />
          <PreviewRow label="Records" value={records} />
          <PreviewRow label="Includes" value="RODS, edits, annotations, DVIRs, ELD malfunctions" />
          <PreviewRow label="Certificate" value={certificate} tone={builtInTest ? 'warning' : undefined} />
          {result && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Result</span>
              {status && <Badge tone={TRANSFER_RESULT_BADGE[status].tone} dot>{TRANSFER_RESULT_BADGE[status].label}</Badge>}
            </div>
          )}
        </dl>

        {precheckKnown &&
          (issues.length === 0 ? (
            <div role="status" className="flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-body text-success">
              <CheckCircle2 size={18} strokeWidth={1.75} />
              Validation passed. No unassigned segments or uncertified logs in this range.
            </div>
          ) : (
            <ul role="status" aria-label="Validation warnings" className="flex flex-col gap-1 rounded-md bg-warning-soft px-4 py-3 text-body text-warning">
              {issues.map((issue) => (
                <li key={issue.code} className="flex items-start gap-2">
                  <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold">{issue.code}</span> · {issue.text}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </form>
    </Modal>
    </>
  );
}

function PreviewRow({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-text-muted">{label}</span>
      <span className={cn('text-right font-medium tabular-nums', tone === 'warning' ? 'text-warning' : 'text-text')}>{value}</span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className="text-card-sub font-normal text-danger">
      {message}
    </span>
  );
}
