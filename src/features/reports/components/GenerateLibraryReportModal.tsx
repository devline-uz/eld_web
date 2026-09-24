// owner: web-reports-transfer — W-12 `Report library` → `Driver logs (RODS)` / `Idle & fuel report`.
//
// B-14 (shipped): both are real `ReportType`s now, PDF only (`REPORT_TYPE_FORMATS`), queued with
// `POST /reports/generate` (`reports` FULL). No overlay is drawn for them in §11, so this is the
// smallest form the DTOs need: a range (carrier-zone calendar days — the RODS sheets inside the PDF
// are split by each driver's home-terminal day server-side), a driver and, for idle & fuel, a unit.
// The queued job is handed back to the caller, which follows it to READY/FAILED (3 s policy).
// web/decisions.md WD-090.
import { useRef } from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGenerateReport, useReportDrivers, useReportVehicles, type ReportQueued } from '@/shared/api/reports';
import { dayRange, logRange } from '@/shared/forms/fields';
import { LIMITS } from '@/shared/forms/messages';
import { Button } from '@/shared/ui/Button';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { REPORT_LABEL, dateOfDayKey, dayKeyOf, refusalText, shiftDayKey, todayKey } from '../reportMeta';
import { ActionAlert } from './ActionAlert';

export type LibraryReportType = 'RODS' | 'IDLE_FUEL';

/** `MAX_REPORT_RANGE_DAYS` in backend reports.dto.ts — idle & fuel spans at most a year. */
const IDLE_FUEL_RANGE_DAYS = 366;

const rangeFor = (type: LibraryReportType) =>
  type === 'RODS'
    ? logRange() // `RodsReportParamsDto` is capped at the same 62 RODS days as `GET /logs/:driverId/range`.
    : dayRange(IDLE_FUEL_RANGE_DAYS, `Select a range of ${IDLE_FUEL_RANGE_DAYS} days or fewer.`);

const schemaFor = (type: LibraryReportType) =>
  z.intersection(rangeFor(type), z.object({ driverId: z.string(), vehicleId: z.string() }));
type LibraryValues = { from: string; to: string; driverId: string; vehicleId: string };

const DESCRIPTION: Record<LibraryReportType, string> = {
  RODS: 'Printable log sheets, one page per driver per day · PDF',
  IDLE_FUEL: 'Idle time, fuel burn and MPG from engine data · PDF',
};

export interface GenerateLibraryReportModalProps {
  type: LibraryReportType;
  onClose: () => void;
  onQueued: (queued: ReportQueued) => void;
  /** Carrier zone — "today" for the default range. */
  timezone: string;
}

export function GenerateLibraryReportModal({ type, onClose, onQueued, timezone }: GenerateLibraryReportModalProps) {
  const generate = useGenerateReport();
  const drivers = useReportDrivers();
  const vehicles = useReportVehicles();
  const inFlight = useRef(false);
  const to = todayKey(timezone);
  const form = useForm<LibraryValues>({
    resolver: zodResolver(schemaFor(type)),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    // `Printable 8-day log sheets` — the §395.8 look-back an officer asks for.
    defaultValues: { from: shiftDayKey(to, -(LIMITS.transferRangeDays - 1)), to, driverId: '', vehicleId: '' },
  });
  const { register, handleSubmit, setValue, formState, control } = form;
  const values = useWatch({ control }) as LibraryValues;
  const busy = formState.isSubmitting || generate.isPending;

  const submitForm = handleSubmit(async (v) => {
    const scope = {
      from: v.from,
      to: v.to,
      ...(v.driverId ? { driverId: v.driverId } : {}),
    };
    await generate
      .mutateAsync(
        type === 'RODS'
          ? { type: 'RODS', format: 'PDF', params: scope }
          : { type: 'IDLE_FUEL', format: 'PDF', params: { ...scope, ...(v.vehicleId ? { vehicleId: v.vehicleId } : {}) } },
      )
      .then((queued) => {
        onQueued(queued);
        onClose();
      })
      .catch(() => undefined);
  });

  /** WB-146 — non-reentrant: `isPending` only turns true on the next render. */
  const submit = (event?: BaseSyntheticEvent) => {
    if (inFlight.current || generate.isPending) return;
    inFlight.current = true;
    void submitForm(event).finally(() => {
      inFlight.current = false;
    });
  };

  const selectClass = 'h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal';
  const rangeError = formState.errors.to?.message;

  return (
    <Modal
      open
      onClose={onClose}
      title={REPORT_LABEL[type]}
      subtitle={DESCRIPTION[type]}
      size="sm"
      isDirty={formState.isDirty}
      footer={
        <>
          <ModalCancelButton disabled={busy} />
          <Button variant="primary" size="lg" loading={busy} disabled={busy} onClick={() => void submit()}>
            Generate report
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <ActionAlert message={generate.isError ? refusalText(generate.error) : null} />
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
          {rangeError && (
            <span id="library-range-error" role="alert" className="text-card-sub font-normal text-danger">
              {rangeError}
            </span>
          )}
        </div>
        <label className="flex flex-col gap-1.5 text-body-strong text-text">
          <span>Driver</span>
          <select {...register('driverId')} disabled={busy} className={selectClass}>
            <option value="">All drivers</option>
            {(drivers.data?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>{`${d.firstName} ${d.lastName}`}</option>
            ))}
          </select>
        </label>
        {type === 'IDLE_FUEL' && (
          <label className="flex flex-col gap-1.5 text-body-strong text-text">
            <span>Unit</span>
            <select {...register('vehicleId')} disabled={busy} className={selectClass}>
              <option value="">All units</option>
              {(vehicles.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>{`#${v.unitNumber}`}</option>
              ))}
            </select>
          </label>
        )}
      </form>
    </Modal>
  );
}
