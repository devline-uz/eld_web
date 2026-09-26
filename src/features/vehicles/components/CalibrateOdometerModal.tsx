// owner: web-vehicles-drivers — 11.5 Calibrate odometer (web/tz.md §11.5). Audited write —
// server refusals surface verbatim. `vehicles` FULL only.
import { useId, useMemo, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useCalibrateOdometer, totalVehicleMiles, type VehicleRow } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';
import { formatOdometer } from '@/shared/format/numbers';
import { calibrateOdometerSchema } from '@/shared/forms/schemas';
import { nonNegativeIntInputProps, sanitizeNonNegativeInt } from '@/shared/forms/nonNegativeIntInput';

/** The dashboard reading is validated by the same zod rule as every odometer (`.min(0)` etc.). */
const odometerField = calibrateOdometerSchema.shape.odometer;

export function CalibrateOdometerModal({ vehicle, onClose }: { vehicle: VehicleRow; onClose: () => void }) {
  const { toast } = useToast();
  const [dashOdometer, setDashOdometer] = useState<string>('');
  const [confirmedLargeDelta, setConfirmedLargeDelta] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCalibrateOdometer(vehicle.id);

  const errorId = useId();
  const dashValue = Number(dashOdometer);
  const parsed = dashOdometer.trim() === '' ? null : odometerField.safeParse(dashValue);
  const valid = parsed?.success === true;
  const fieldError = parsed && !parsed.success ? parsed.error.issues[0]?.message : undefined;
  const newOffset = valid && vehicle.deviceOdometerMi != null ? dashValue - vehicle.deviceOdometerMi : null;

  // WB — the >5,000 mi guard used to fail OPEN: with no ELD reading (`deviceOdometerMi == null`,
  // or a row whose odometer is missing) the delta came out `NaN`, `NaN > 5000` is `false`, and the
  // extra confirmation silently never appeared. It now fails CLOSED: `delta` is `null` whenever it
  // cannot be computed from a known reading, and an uncomputable delta demands the confirmation
  // just like a large one.
  const delta = useMemo(() => {
    if (!valid) return null;
    if (vehicle.deviceOdometerMi == null) return null;
    const reference = totalVehicleMiles(vehicle);
    if (!Number.isFinite(reference)) return null;
    const computed = Math.abs(dashValue - reference);
    return Number.isFinite(computed) ? computed : null;
  }, [valid, dashValue, vehicle]);
  const deltaUnknown = valid && delta === null;
  const needsExtraConfirm = valid && (delta === null || delta > 5000);

  return (
    <Modal
      open
      onClose={onClose}
      title="Calibrate odometer"
      subtitle={`Unit ${vehicle.unitNumber} · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`}
      size="sm"
      // A typed dashboard reading is a real edit — closing confirms first, from Cancel as from Esc.
      isDirty={dashOdometer.trim() !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={!valid || (needsExtraConfirm && !confirmedLargeDelta)}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { odometerMi: dashValue },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: 'Odometer calibrated', description: 'Written to the audit log.' });
                    onClose();
                  },
                  onError: (error) => {
                    // Surface the server refusal verbatim — never retry around it.
                    setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
                  },
                },
              )
            }
          >
            Save calibration
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 text-body">
          <div className="flex justify-between">
            <dt className="text-text-muted">ELD reading</dt>
            <dd className="tabular-nums text-text">
              {vehicle.deviceOdometerMi != null ? `${formatOdometer(vehicle.deviceOdometerMi)} mi` : '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Current offset</dt>
            <dd className="tabular-nums text-text">
              {vehicle.odometerOffsetMi >= 0 ? '+' : ''}
              {formatOdometer(vehicle.odometerOffsetMi)} mi
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Calculated odometer</dt>
            {/* A bad offset must never preview a negative odometer. */}
            <dd className="tabular-nums text-text">{formatOdometer(Math.max(0, totalVehicleMiles(vehicle)))} mi</dd>
          </div>
        </dl>
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Dashboard odometer <span className="text-danger">*</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              {...nonNegativeIntInputProps}
              value={dashOdometer}
              onChange={(e) => {
                // Last line of defence: whatever path a value arrives by, it is clamped to >= 0.
                setDashOdometer(sanitizeNonNegativeInt(e.target.value));
                setServerError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? errorId : undefined}
              className="h-input flex-1 rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            />
            <span className="text-body text-text-muted">mi</span>
          </div>
        </label>
        {fieldError && (
          <p id={errorId} role="alert" className="text-caption text-danger">
            {fieldError}
          </p>
        )}
        {newOffset != null && (
          <p className="tabular-nums text-body text-text-secondary">
            New offset: {newOffset >= 0 ? '+' : ''}
            {formatOdometer(newOffset)} mi
          </p>
        )}
        {needsExtraConfirm && (
          <label className="flex items-center gap-2 rounded-md bg-warning-soft p-3 text-body text-warning">
            <input
              type="checkbox"
              checked={confirmedLargeDelta}
              onChange={(e) => setConfirmedLargeDelta(e.target.checked)}
            />
            {deltaUnknown
              ? 'This unit has no ELD odometer reading, so the change cannot be checked against a known value — I confirm this value is correct.'
              : 'This is more than 5,000 mi from the current reading — I confirm this value is correct.'}
          </label>
        )}
        <p className="text-caption text-text-muted">
          The ELD reports a relative odometer. The offset keeps recorded distance aligned with the
          dash reading. This action is written to the audit log.
        </p>
        {serverError && <p className="text-body text-danger">{serverError}</p>}
      </div>
    </Modal>
  );
}
