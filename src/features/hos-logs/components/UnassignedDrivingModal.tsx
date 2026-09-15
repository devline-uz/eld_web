// owner: web-hos-logs — ⭐ 11.13 Unassigned driving (web/tz.md §11.13). `hosEdit` FULL.
//
// ⭐ The rule that is easy to get wrong: after an assignment `recordOrigin` STAYS 1. The panel
// never calls an assigned segment "driver entered" — `ORIGIN` keeps reading `ELD · automatic` and
// only an `Assigned by …` annotation is added (§7.4 / §23). Nothing here deletes a record.
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { ApiError } from '@/shared/api/errors';
import { LIMITS, VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { formatHosHours, formatDistance } from '@/shared/format';
import {
  useResolveUnidentified,
  type UnidentifiedAction,
  type UnidentifiedSegment,
} from '@/shared/api/hosLogs';

/** `Annotate as yard move` / `personal conveyance` / `Leave unassigned` + every driver. */
export const ANNOTATE_YARD = '__yard-move';
export const ANNOTATE_PC = '__personal-conveyance';
export const LEAVE_UNASSIGNED = '__leave-unassigned';

export interface UnassignedDriverOption {
  id: string;
  name: string;
}

export interface UnassignedDrivingModalProps {
  segments: UnidentifiedSegment[];
  drivers: UnassignedDriverOption[];
  unitLabel: (vehicleId: string) => string;
  timezone: string;
  onClose: () => void;
}

export function UnassignedDrivingModal({
  segments,
  drivers,
  unitLabel,
  timezone,
  onClose,
}: UnassignedDrivingModalProps) {
  const { toast } = useToast();
  const mutation = useResolveUnidentified();
  const [selected, setSelected] = useState<string[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [annotation, setAnnotation] = useState('');
  const [askDriver, setAskDriver] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [annotationError, setAnnotationError] = useState<string | null>(null);

  const totalSec = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.durationSec, 0),
    [segments],
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function submit() {
    setBanner(null);
    setAnnotationError(null);
    if (annotation.trim().length < LIMITS.annotationMin) {
      setAnnotationError(VALIDATION_MESSAGES.annotation);
      return;
    }
    const actions: UnidentifiedAction[] = [];
    for (const id of selected) {
      const value = choice[id] ?? LEAVE_UNASSIGNED;
      if (value === LEAVE_UNASSIGNED) continue;
      if (value === ANNOTATE_YARD || value === ANNOTATE_PC) {
        actions.push({ kind: 'annotate', id, annotation: annotation.trim() });
      } else {
        actions.push({ kind: 'assign', id, driverId: value, annotation: annotation.trim() });
      }
    }
    if (actions.length === 0) {
      setBanner('Choose a driver or an annotation for at least one selected segment.');
      return;
    }
    mutation.mutate(actions, {
      onSuccess: () => {
        toast({ kind: 'success', ...TOAST_COPY.segmentsAssigned(actions.length) });
        onClose();
      },
      onError: (error) =>
        setBanner(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Unassigned driving"
      subtitle={`${segments.length} segment${segments.length === 1 ? '' : 's'} recorded with no driver logged in · ${formatHosHours(totalSec)} total`}
      isDirty={annotation.length > 0}
      footer={
        <div className="flex w-full items-center justify-between">
          <label className="flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={askDriver} onChange={(e) => setAskDriver(e.target.checked)} />
            Ask each driver to confirm in the app
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={selected.length === 0}
              loading={mutation.isPending}
              onClick={submit}
            >
              {`Assign ${selected.length} segment${selected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-body text-text-secondary">
        <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
        <p>
          Unassigned segments must be assigned to a driver or annotated before a DOT audit. Segments
          under 3 minutes may be annotated as yard movement.
        </p>
      </div>

      {banner && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-body text-danger">
          {banner}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {segments.map((segment) => {
          const isSelected = selected.includes(segment.id);
          return (
            <div
              key={segment.id}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3',
                isSelected ? 'border-primary' : 'border-border',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(segment.id)}
                aria-label={`Select ${unitLabel(segment.vehicleId)} segment`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-body text-text">
                  <span className="font-semibold">{unitLabel(segment.vehicleId)}</span>
                  <span className="text-text-secondary">
                    {formatInTimeZone(new Date(segment.startAt), timezone, 'MMM dd')}
                  </span>
                  <span className="tabular text-text-secondary">
                    {formatInTimeZone(new Date(segment.startAt), timezone, 'HH:mm')} –{' '}
                    {formatInTimeZone(new Date(segment.endAt), timezone, 'HH:mm')}
                  </span>
                  <span className="tabular rounded-full bg-bg-subtle px-2 text-caption text-text-secondary">
                    {formatHosHours(segment.durationSec)}
                  </span>
                </p>
                <p className="text-caption text-text-muted">
                  {`${formatDistance(segment.distanceMi)} · ${segment.startLocation ?? ''}${
                    segment.endLocation && segment.endLocation !== segment.startLocation
                      ? ` → ${segment.endLocation}`
                      : ''
                  }`}
                </p>
              </div>
              <select
                value={choice[segment.id] ?? LEAVE_UNASSIGNED}
                onChange={(e) => setChoice((prev) => ({ ...prev, [segment.id]: e.target.value }))}
                aria-label={`Resolution for ${unitLabel(segment.vehicleId)}`}
                className="h-input w-60 shrink-0 rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              >
                <option value={LEAVE_UNASSIGNED}>Leave unassigned</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
                <option value={ANNOTATE_YARD}>Annotate as yard move</option>
                <option value={ANNOTATE_PC}>Annotate as personal conveyance</option>
              </select>
            </div>
          );
        })}
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-label text-text">
          Annotation applied to the selected segments <span className="text-danger">*</span>
        </span>
        <textarea
          value={annotation}
          maxLength={LIMITS.annotationMax}
          onChange={(e) => setAnnotation(e.target.value)}
          aria-invalid={Boolean(annotationError)}
          className="min-h-20 rounded-md border border-border bg-bg-surface p-3 text-body text-text"
        />
        {annotationError && <span className="text-caption text-danger">{annotationError}</span>}
      </label>
    </Modal>
  );
}
