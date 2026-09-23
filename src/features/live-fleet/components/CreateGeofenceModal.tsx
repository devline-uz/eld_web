// owner: web-dashboard-fleet — overlay 11.1 · Create a geofence (web/tz.md §11.1).
// `liveFleet` FULL only; the trigger button is absent from the DOM otherwise (§12.2).
import { useRef, useState, type BaseSyntheticEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { FilterCheckbox } from '@/shared/ui/FilterDrawer';
// Direct file imports, not the `@/shared/ui` barrel (web/decisions.md WD-021).
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { geofenceSchema, type GeofenceFormValues } from '@/shared/forms/schemas';
import { ApiError } from '@/shared/api/errors';

import { GEOFENCE_ADDRESS_SHAPE_REASON } from '../lib/copy';

const SHAPE_SEGMENTS = ['Circle', 'Rectangle', 'Polygon', 'Address'] as const;
type ShapeSegment = (typeof SHAPE_SEGMENTS)[number];
/** What each segment sends. Rectangle and Polygon are both a `POLYGON` on the wire; `Address`
 * has no shape on the API at all (B-93), so it is disabled. */
const SEGMENT_TYPE: Record<Exclude<ShapeSegment, 'Address'>, 'CIRCLE' | 'POLYGON'> = {
  Circle: 'CIRCLE',
  Rectangle: 'POLYGON',
  Polygon: 'POLYGON',
};

export function CreateGeofenceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // These four fields drive their own visual state (segmented control / checkboxes) instead of
  // `watch()` — react-hook-form's `watch()` cannot be safely memoized (its subscription changes
  // every render), so any component reading it opts the whole tree out of React Compiler
  // memoization. `setValue` below keeps react-hook-form's own copy in sync for validation/submit.
  // Stage 3 — the pressed state tracks the segment, not the wire type: Rectangle and Polygon both
  // send `POLYGON`, so deriving `active` from the type left Polygon never pressed.
  const [segment, setSegment] = useState<Exclude<ShapeSegment, 'Address'>>('Rectangle');
  const [countAsYardMove, setCountAsYardMove] = useState(false);
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  /** Anything the server refused that could not be mapped onto a field (§6.1 rule 6). */
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<GeofenceFormValues>({
    resolver: zodResolver(geofenceSchema),
    mode: 'onBlur',
    defaultValues: {
      category: 'TERMINAL',
      colour: 'BLUE',
      type: 'POLYGON',
      appliesTo: 'All vehicle groups',
      alertOnEnter: true,
      alertOnExit: true,
      afterHoursOnly: false,
      countAsYardMove: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: GeofenceFormValues) => {
      // ⛔ B-15 — dwellMinutes/afterHoursOnly are not on the backend Geofence model yet
      // (web/backend-gaps.md); collected above, dropped here instead of sent as unknown fields.
      const { dwellMinutes: _dwellMinutes, afterHoursOnly: _afterHoursOnly, ...payload } = values;
      return client.post(endpoints.geofences.create, payload);
    },
    onSuccess: (_data, values) => {
      void queryClient.invalidateQueries({ queryKey: qk.geofences() });
      toast({ kind: 'success', ...TOAST_COPY.geofenceCreated(values.name) });
      onClose();
    },
    onError: (error) => {
      // WB — a 422 used to be swallowed whole: the toast was suppressed for it but `details` was
      // never fed into `setError`, so an invalid geofence failed in complete silence. Mapped
      // fields go to the inputs, anything unmapped goes to the in-modal banner (§6.1 rule 6).
      setServerError(null);
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        const known = Object.keys(fieldErrors).filter((field) => field in geofenceSchema.shape);
        for (const field of known) {
          setError(field as keyof GeofenceFormValues, { message: fieldErrors[field] as string });
        }
        if (error.status === 422) {
          if (known.length === Object.keys(fieldErrors).length && known.length > 0) return;
          setServerError(error.userMessage);
          return;
        }
      }
      toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
    },
  });

  // Stage 3 — `mutation.mutate` is fire-and-forget, so RHF's `isSubmitting` cleared before the
  // request resolved and Save could be clicked again mid-flight. `isPending` covers the request.
  // The ref also covers two clicks landing before the re-render that disables the button.
  const isPending = mutation.isPending;
  const inFlight = useRef(false);
  function onSave(event?: BaseSyntheticEvent) {
    return handleSubmit((values) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(values, {
        onSettled: () => {
          inFlight.current = false;
        },
      });
    })(event);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a geofence"
      subtitle="Trigger arrival, departure and dwell-time events"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <FilterCheckbox
            label="Count time inside as on-duty yard move"
            checked={countAsYardMove}
            onChange={(v) => {
              setCountAsYardMove(v);
              setValue('countAsYardMove', v, { shouldDirty: true });
            }}
          />
          <div className="ml-auto flex gap-2">
            <ModalCancelButton disabled={isPending} />
            <Button variant="primary" size="lg" loading={isPending} onClick={() => void onSave()}>
              Save geofence
            </Button>
          </div>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => void onSave(event)}>
        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Geofence name <span className="text-danger">*</span>
            </span>
            <input
              {...register('name')}
              placeholder="Columbus terminal"
              disabled={isPending}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'geofence-name-error' : undefined}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            />
            {errors.name && (
              <span id="geofence-name-error" className="text-caption text-danger">
                {errors.name.message}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Type</span>
            <select
              {...register('category')}
              disabled={isPending}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            >
              <option value="TERMINAL">Terminal / yard</option>
              <option value="SHIPPER">Shipper</option>
              <option value="CUSTOMER">Customer</option>
              <option value="REST_AREA">Rest area</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Colour</span>
            <select
              {...register('colour')}
              disabled={isPending}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            >
              <option value="BLUE">Blue</option>
              <option value="GREEN">Green</option>
              <option value="AMBER">Amber</option>
              <option value="RED">Red</option>
              <option value="VIOLET">Violet</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-label="Shape"
            className="flex h-9 w-fit overflow-hidden rounded-md border border-border"
          >
            {SHAPE_SEGMENTS.map((seg) => {
              if (seg === 'Address') {
                return (
                  <button
                    key={seg}
                    type="button"
                    disabled
                    aria-pressed={false}
                    aria-describedby="geofence-address-shape-reason"
                    className="cursor-not-allowed bg-bg-surface px-3 text-body text-text-muted"
                  >
                    {seg}
                  </button>
                );
              }
              const active = segment === seg;
              return (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={active}
                  disabled={isPending}
                  onClick={() => {
                    setSegment(seg);
                    setValue('type', SEGMENT_TYPE[seg], { shouldDirty: true });
                  }}
                  className={
                    active
                      ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                      : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
                  }
                >
                  {seg}
                </button>
              );
            })}
          </div>
          <p id="geofence-address-shape-reason" className="text-caption text-text-muted">
            {GEOFENCE_ADDRESS_SHAPE_REASON}
          </p>
          <div className="flex h-geofence-preview items-center justify-center rounded-md border border-dashed border-border bg-bg-subtle text-center">
            <div className="flex flex-col items-center gap-1 text-text-muted">
              <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
              <p className="text-card-sub">
                Map preview unavailable in this environment — drag corners here once tiles are configured.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Address</span>
            <input
              {...register('address')}
              placeholder="4517 Washington Ave., Columbus, OH 43004"
              disabled={isPending}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Radius / size</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                {...register('radiusMeters', {
                  // `valueAsNumber` turns an empty field into `NaN`, which fails `z.number()`
                  // even though the field is optional (WB-012) — coerce blank to `undefined`.
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
                placeholder="0.8"
                disabled={isPending}
                className="h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              />
              <span className="text-body text-text-muted">mi</span>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Applies to</span>
            <select
              {...register('appliesTo')}
              disabled={isPending}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            >
              <option>All vehicle groups</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FilterCheckbox
            label="Arrival event"
            checked={alertOnEnter}
            onChange={(v) => {
              setAlertOnEnter(v);
              setValue('alertOnEnter', v, { shouldDirty: true });
            }}
          />
          <FilterCheckbox
            label="Departure event"
            checked={alertOnExit}
            onChange={(v) => {
              setAlertOnExit(v);
              setValue('alertOnExit', v, { shouldDirty: true });
            }}
          />
          {/* ⛔ B-15 — Geofence has no dwellMinutes/afterHoursOnly column yet; rendered anyway so
              the fields are not silently dropped (web/tz.md §11.1, web/backend-gaps.md). */}
          <label className="flex items-center gap-2 text-body text-text-muted" title="Backend gap B-15 — not saved yet">
            <input
              type="checkbox"
              disabled
              checked
              readOnly
              aria-label="Dwell longer than — not yet supported by the backend"
            />
            Dwell longer than
            <input
              type="number"
              defaultValue={45}
              disabled
              className="h-8 w-14 rounded-md border border-border bg-bg-subtle px-2 text-caption text-text-muted"
              aria-label="Dwell minutes — not yet supported by the backend"
            />
            min
          </label>
          <label className="flex items-center gap-2 text-body text-text-muted" title="Backend gap B-15 — not saved yet">
            <input type="checkbox" disabled aria-label="After-hours entry — not yet supported by the backend" />
            After-hours entry
          </label>
        </div>
      </form>
    </Modal>
  );
}
