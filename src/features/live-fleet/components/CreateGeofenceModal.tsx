// owner: web-dashboard-fleet — overlay 11.1 · Create a geofence (web/tz.md §11.1).
// `liveFleet` FULL only; the trigger button is absent from the DOM otherwise (§12.2).
import { lazy, Suspense, useEffect, useRef, useState, type BaseSyntheticEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { MapPin } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { FilterCheckbox } from '@/shared/ui/FilterDrawer';
// Direct file imports, not the `@/shared/ui` barrel (web/decisions.md WD-021).
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useCreateGeofence, type GeofencePayload } from '@/shared/api/geofences';
import { geofenceSchema, type GeofenceFormValues } from '@/shared/forms/schemas';
import { ApiError } from '@/shared/api/errors';
import { reverseGeocode } from '@/shared/map/geocode';
import { rectangleCorners, type LatLon } from '@/shared/map/overlays';
import type { GeofenceDrawMode, GeofenceMapFailure } from '@/shared/map/GeofencePickerMap';

// Lazy, like FleetMap on the fleet screens — `maplibre-gl` + its CSS only load once the modal opens.
const GeofencePickerMap = lazy(() => import('@/shared/map/GeofencePickerMap'));

const SHAPE_SEGMENTS = ['Circle', 'Rectangle', 'Polygon', 'Address'] as const;
type ShapeSegment = (typeof SHAPE_SEGMENTS)[number];
/** What each segment sends. Rectangle and Polygon are both a `POLYGON` on the wire (B-93 shipped
 * — `Address` now sends `type: 'ADDRESS'` and the server geocodes `address` into a circle). */
const SEGMENT_TYPE: Record<ShapeSegment, 'CIRCLE' | 'POLYGON' | 'ADDRESS'> = {
  Circle: 'CIRCLE',
  Rectangle: 'POLYGON',
  Polygon: 'POLYGON',
  Address: 'ADDRESS',
};

/** How a click on the map builds each segment's shape. */
const SEGMENT_MODE: Record<ShapeSegment, GeofenceDrawMode> = {
  Circle: 'point',
  Rectangle: 'rectangle',
  Polygon: 'polygon',
  Address: 'point',
};

const MAP_HINT: Record<ShapeSegment, string> = {
  Circle: 'Click the map to place the centre, then drag the pin to adjust. Set the radius below.',
  Rectangle: 'Click two opposite corners on the map. Drag a corner to adjust; a third click starts over.',
  Polygon: 'Click the map to add each corner (at least 3). Drag a corner to adjust.',
  Address: 'Type the address below, or click the map to fill it in from the picked point.',
};

const SHAPE_NEEDS_POINTS: Record<Exclude<ShapeSegment, 'Address'>, string> = {
  Circle: 'Click the map to place the centre of the circle.',
  Rectangle: 'Click two opposite corners of the rectangle on the map.',
  Polygon: 'Click at least three corners of the polygon on the map.',
};

/** Why the map is missing — each case needs a different fix, so the fallback names it. */
const MAP_FAILURE_COPY: Record<GeofenceMapFailure, string> = {
  'no-style': 'Map is not configured (VITE_MAP_STYLE_URL is empty).',
  'no-webgl': 'Map cannot be shown: this browser has WebGL turned off.',
  'style-failed':
    'Map failed to load — check the map API key and that this site’s address is an allowed origin for it.',
};

const SHAPE_NEEDS_MAP =
  'Drawing a circle, rectangle or polygon needs the map, which is not available here. Choose Address to place this geofence by street address.';

export function CreateGeofenceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const createGeofence = useCreateGeofence();

  // These fields drive their own visual state (segmented control / checkboxes) instead of
  // `watch()` — react-hook-form's `watch()` cannot be safely memoized (its subscription changes
  // every render), so any component reading it opts the whole tree out of React Compiler
  // memoization. `setValue` below keeps react-hook-form's own copy in sync for validation/submit.
  // Stage 3 — the pressed state tracks the segment, not the wire type: Rectangle and Polygon both
  // send `POLYGON`, so deriving `active` from the type left Polygon never pressed.
  const [segment, setSegment] = useState<ShapeSegment>('Rectangle');
  const [countAsYardMove, setCountAsYardMove] = useState(false);
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [dwellEnabled, setDwellEnabled] = useState(false);
  const [dwellMinutesValue, setDwellMinutesValue] = useState(45);
  const [afterHoursOnly, setAfterHoursOnly] = useState(false);
  /** Points placed on the map for the current segment (see `SEGMENT_MODE`). */
  const [points, setPoints] = useState<LatLon[]>([]);
  /** Mirrors of `radiusMi` / `colour` for the map preview — same no-`watch()` rule as above. */
  const [radiusPreview, setRadiusPreview] = useState<number | undefined>(undefined);
  const [colourPreview, setColourPreview] = useState('BLUE');
  /** No style configured, no WebGL, or the style failed to load — Address still works. */
  const [mapFailure, setMapFailure] = useState<GeofenceMapFailure | null>(
    import.meta.env.VITE_MAP_STYLE_URL ? null : 'no-style',
  );
  const mapAvailable = mapFailure === null;
  const geocodeAbort = useRef<AbortController | null>(null);
  useEffect(() => () => geocodeAbort.current?.abort(), []);
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

  function onPointsChange(next: LatLon[]) {
    setPoints(next);
    setServerError(null);
    const centre = SEGMENT_MODE[segment] === 'point' ? next[0] : undefined;
    if (!centre) return;
    // Fill the Address field from the picked point (shown for every shape, sent for Address).
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;
    reverseGeocode(centre.lat, centre.lon, controller.signal)
      .then((address) => {
        if (address && !controller.signal.aborted) {
          setValue('address', address, { shouldDirty: true, shouldValidate: true });
        }
      })
      .catch(() => undefined);
  }

  function onSegmentChange(seg: ShapeSegment) {
    // A centre carries over between Circle and Address; a corner set never fits another shape.
    const keep = SEGMENT_MODE[seg] === 'point' && SEGMENT_MODE[segment] === 'point';
    if (!keep) setPoints([]);
    setSegment(seg);
    setServerError(null);
    setValue('type', SEGMENT_TYPE[seg], { shouldDirty: true });
  }

  // WB — a 422 used to be swallowed whole: the toast was suppressed for it but `details` was
  // never fed into `setError`, so an invalid geofence failed in complete silence. Mapped fields
  // go to the inputs, anything unmapped (incl. `GEOCODER_NOT_CONFIGURED` / `GEOCODE_FAILED`,
  // which target no field) goes to the in-modal banner (§6.1 rule 6).
  function onSaveError(error: unknown) {
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
  }

  // Stage 3 — a fire-and-forget mutate() clears RHF's `isSubmitting` before the request resolves
  // and Save could be clicked again mid-flight. `isPending` covers the request. The ref also
  // covers two clicks landing before the re-render that disables the button.
  const isPending = createGeofence.isPending;
  const inFlight = useRef(false);
  function onSave(event?: BaseSyntheticEvent) {
    return handleSubmit((values) => {
      if (inFlight.current) return;
      // QA-B — the preview never draws a shape, so a Circle/Rectangle/Polygon has no
      // `centerLat/centerLon`/`polygon` and `POST /geofences` always answered a 422 whose issue
      // targets no field ("Check the highlighted fields…" with nothing highlighted). Say why
      // up front instead of sending a request that cannot succeed.
      let geometry: Pick<GeofencePayload, 'centerLat' | 'centerLon' | 'polygon'> = {};
      if (segment !== 'Address') {
        if (!mapAvailable) {
          setServerError(SHAPE_NEEDS_MAP);
          return;
        }
        const centre = points[0];
        if (segment === 'Circle' && centre) {
          if (values.radiusMi == null) {
            setError('radiusMi', { message: 'Enter a radius for the circle.' });
            return;
          }
          geometry = { centerLat: centre.lat, centerLon: centre.lon };
        } else if (segment === 'Rectangle' && points.length >= 2) {
          geometry = { polygon: rectangleCorners(points[0]!, points[1]!) };
        } else if (segment === 'Polygon' && points.length >= 3) {
          geometry = { polygon: points };
        } else {
          setServerError(SHAPE_NEEDS_POINTS[segment]);
          return;
        }
      }
      setServerError(null);
      inFlight.current = true;
      const payload: GeofencePayload = {
        name: values.name,
        type: values.type,
        ...geometry,
        category: values.category,
        // `address` only carries meaning for the ADDRESS shape — the server geocodes it.
        address: values.type === 'ADDRESS' ? values.address : undefined,
        radiusMi: values.radiusMi,
        alertOnEnter: values.alertOnEnter,
        alertOnExit: values.alertOnExit,
        dwellMinutes: values.dwellMinutes,
        afterHoursOnly: values.afterHoursOnly,
        colour: values.colour,
        countAsYardMove: values.countAsYardMove,
      };
      createGeofence.mutate(payload, {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.geofenceCreated(values.name) });
          onClose();
        },
        onError: onSaveError,
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
      isDirty={isDirty || points.length > 0}
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
              {...register('colour', { onChange: (event) => setColourPreview(String(event.target.value)) })}
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
              const active = segment === seg;
              return (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={active}
                  disabled={isPending}
                  onClick={() => onSegmentChange(seg)}
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
          {mapAvailable ? (
            <>
              <div className="relative h-geofence-preview overflow-hidden rounded-md border border-border">
                <Suspense fallback={<div className="h-full w-full animate-pulse bg-bg-subtle" />}>
                  <GeofencePickerMap
                    mode={SEGMENT_MODE[segment]}
                    points={points}
                    onPointsChange={onPointsChange}
                    colour={colourPreview}
                    radiusMi={segment === 'Circle' || segment === 'Address' ? radiusPreview : undefined}
                    disabled={isPending}
                    onUnavailable={setMapFailure}
                  />
                </Suspense>
              </div>
              <div className="flex items-center gap-2 text-caption text-text-muted">
                <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className="flex-1">
                  {MAP_HINT[segment]}
                  {points[0] && SEGMENT_MODE[segment] === 'point' && (
                    <> · {points[0].lat.toFixed(5)}, {points[0].lon.toFixed(5)}</>
                  )}
                </span>
                {points.length > 0 && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setPoints(segment === 'Polygon' ? points.slice(0, -1) : [])}
                    className="text-caption text-primary hover:underline"
                  >
                    {segment === 'Polygon' ? 'Undo last point' : 'Clear'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-geofence-preview items-center justify-center rounded-md border border-dashed border-border bg-bg-subtle text-center">
              <div className="flex flex-col items-center gap-1 text-text-muted">
                <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
                <p className="text-card-sub">{MAP_FAILURE_COPY[mapFailure ?? 'no-style']}</p>
                <p className="text-caption">Choose Address to place this geofence by street address.</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Address{segment === 'Address' && <span className="text-danger"> *</span>}
            </span>
            <input
              {...register('address')}
              placeholder="4517 Washington Ave., Columbus, OH 43004"
              disabled={isPending}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? 'geofence-address-error' : undefined}
              className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
            />
            {errors.address && (
              <span id="geofence-address-error" className="text-caption text-danger">
                {errors.address.message}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Radius / size</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                {...register('radiusMi', {
                  // `valueAsNumber` turns an empty field into `NaN`, which fails `z.number()`
                  // even though the field is optional (WB-012) — coerce blank to `undefined`.
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  onChange: (event) => {
                    const n = Number(event.target.value);
                    setRadiusPreview(event.target.value !== '' && n > 0 ? n : undefined);
                  },
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
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={dwellEnabled}
              disabled={isPending}
              onChange={(event) => {
                const checked = event.target.checked;
                setDwellEnabled(checked);
                setValue('dwellMinutes', checked ? dwellMinutesValue : undefined, { shouldDirty: true });
              }}
              aria-label="Dwell longer than"
            />
            Dwell longer than
            <input
              type="number"
              min={1}
              value={dwellMinutesValue}
              disabled={isPending || !dwellEnabled}
              onChange={(event) => {
                const n = Number(event.target.value);
                setDwellMinutesValue(n);
                if (dwellEnabled) setValue('dwellMinutes', n, { shouldDirty: true });
              }}
              className="h-8 w-14 rounded-md border border-border bg-bg-surface px-2 text-caption text-text disabled:bg-bg-subtle disabled:text-text-muted"
              aria-label="Dwell minutes"
            />
            min
          </label>
          <FilterCheckbox
            label="After-hours entry"
            checked={afterHoursOnly}
            onChange={(v) => {
              setAfterHoursOnly(v);
              setValue('afterHoursOnly', v, { shouldDirty: true });
            }}
          />
        </div>
      </form>
    </Modal>
  );
}
