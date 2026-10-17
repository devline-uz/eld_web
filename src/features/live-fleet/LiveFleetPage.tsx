// owner: web-dashboard-fleet — W-02 Live Fleet (web/tz.md §10 W-02).
// Design: web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crosshair, MessageSquare, Plus, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { qk } from '@/shared/api/queryKeys';
import {
  useLiveFleet,
  useLiveFleetUnit,
  hasPosition,
  mapMarkerStatus,
  serverNowMs,
  type LiveFleetDetailOnlyField,
  type LiveFleetListUnit,
  type LiveFleetResponse,
  type LiveFleetUnit,
} from '@/shared/api/liveFleet';
import { useGeofences } from '@/shared/api/geofences';
import { useVehicleTelemetry } from '@/shared/api/vehicles';
import { trailFromTelemetry } from '@/shared/map/trail';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { useActiveTripRows } from '@/shared/api/trips';
import {
  MAP_LAYERS,
  geofencesToGeoJSON,
  trafficTilesUrl,
  tripsToGeoJSON,
  type MapLayer,
} from '@/shared/map/overlays';
import { usePermission } from '@/shared/auth/usePermission';
import { Can } from '@/shared/auth/Can';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { useThrottledInvalidate, useThrottledPatch } from '@/shared/realtime/useThrottledPatch';
import { useVirtualRows } from '@/shared/ui/virtualRows';
// Direct file imports, not the `@/shared/ui` barrel (web/decisions.md WD-021).
import { Button } from '@/shared/ui/Button';
import { LiveUnitBadge, LiveUnitNote } from '@/shared/ui/LiveUnitStatus';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { EmptyState, ErrorState, RefreshErrorNotice } from '@/shared/ui/states';
import { formatSpeed, formatOdometer } from '@/shared/format/numbers';
import { useRelativeTime } from '@/shared/format/useRelativeTime';
import { useCountdown, useCountdownFromSeconds, formatCountdown } from '@/shared/hooks/useCountdown';
import { CreateGeofenceModal } from './components/CreateGeofenceModal';
import { messagesHref } from '@/shared/lib/messagesHref';
import { VIEW_LOGS_NO_DRIVER } from './lib/copy';
import { matchesUnitSearch } from './lib/unitSearch';
import { useVehicleMap } from '@/shared/api/lookups';
import { searchEmptyState } from '@/shared/ui/copy';
import { refreshedLabel } from './lib/refreshedLabel';
import {
  applyUnitPatches,
  appliedFrameAt,
  fleetHasUnit,
  isStaleFrame,
  telemetryUnitPatch,
  type TelemetryPointPayload,
  type UnitPatch,
} from './lib/telemetryPatch';

/** How many recent telemetry fixes make up the selected unit's trail. */
const TRAIL_POINTS = 40;

const FleetMap = lazy(() => import('@/shared/map/FleetMap'));

type Layer = MapLayer;

/** UI-017 — user-facing; the env-var setup note lives in `.env.example`, not in a tooltip. */
const TRAFFIC_UNCONFIGURED_TITLE = 'Traffic layer not available';

type Segment = 'ALL' | 'DRIVING' | 'IDLE';

/** `?segment=` — anything but a known segment is `All`. */
function parseSegment(value: string | null): Segment {
  return value === 'DRIVING' || value === 'IDLE' ? value : 'ALL';
}

/** Estimated height of one unit row (three text lines + `py-3`), refined by measurement once the
 * list is windowed (above `VIRTUALIZE_ABOVE` rows, §16.2). */
const UNIT_ROW_ESTIMATE = 76;

/** `refreshed N seconds ago`, ticking every second (web/tz.md §10 W-02). `Date.now()` is only
 * ever read inside `useState`'s lazy initializer or the interval callback below — never directly
 * in the render body — so this stays outside React's render-purity check. */
function useRefreshedAgo(dataUpdatedAt: number, isFetching: boolean): string | null {
  const [label, setLabel] = useState(() => refreshedLabel(dataUpdatedAt, isFetching));

  useEffect(() => {
    const timer = setInterval(() => setLabel(refreshedLabel(dataUpdatedAt, isFetching)), 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt, isFetching]);

  return label;
}

/** The top-bar subtitle. The 1 s tick lives here, so only this text re-renders every second — not
 * the whole Live Fleet page, list and map (WB-257). */
export function RefreshedSubtitle({ dataUpdatedAt, isFetching = false }: { dataUpdatedAt: number; isFetching?: boolean }) {
  const label = useRefreshedAgo(dataUpdatedAt, isFetching);
  return <>{`Real-time GPS · ${label ?? 'refreshing…'}`}</>;
}

/** Memoized: a keystroke, a segment click or a selection change re-renders only the rows whose
 * `unit` object or `selected` flag changed (`onSelect` is one stable callback for every row). */
export const UnitListRow = memo(function UnitListRow({
  unit,
  selected,
  onSelect,
}: {
  unit: LiveFleetListUnit;
  selected: boolean;
  onSelect: (vehicleId: string) => void;
}) {
  // LIVE-007 — an older "last seen" is the carrier's date, not the browser's.
  const carrierTz = useCarrierTimezone();
  const lastSeen = useRelativeTime(unit.lastSeenAt, 'short', carrierTz);
  // UI-003 — a stale unit's speed is not live either.
  const offline = unit.dutyStatus === 'ELD_OFFLINE' || unit.isStale;
  return (
    <button
      type="button"
      data-unit-id={unit.vehicleId}
      data-stale={unit.isStale || undefined}
      aria-current={selected || undefined}
      onClick={() => onSelect(unit.vehicleId)}
      className={`flex w-full flex-col gap-0.5 border-l-2 px-4 py-3 text-left ${
        selected ? 'border-l-primary bg-primary-soft' : 'border-l-transparent hover:bg-bg-subtle'
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-body-strong text-text">Unit {unit.unitNumber}</span>
          <LiveUnitBadge unit={unit} />
        </span>
        <span className="tabular-nums text-body-strong text-text">
          {offline ? '—' : formatSpeed(unit.speedMph)}
        </span>
      </span>
      <span className="flex items-center justify-between text-body text-text-secondary">
        <span>{unit.driverName ?? 'Unassigned'}</span>
        <span className="tabular-nums text-caption text-text-muted">{lastSeen}</span>
      </span>
      <span className="truncate text-caption text-text-muted">{unit.locationLabel ?? '—'}</span>
      <LiveUnitNote unit={unit} />
    </button>
  );
});

/** The keyboard-operable left column (§10 W-02, the map's keyboard equivalent). Above
 * `VIRTUALIZE_ABOVE` units only a window of rows is in the DOM (WB-257); every rendered `<li>`
 * then carries `aria-setsize`/`aria-posinset`, so assistive tech still hears "812 of 1000".
 * Tab walks the rows (focusing a row scrolls it, which renders the next ones); ArrowUp/Down,
 * Home/End move focus across the whole list, windowed or not. */
function UnitList({
  units,
  selectedId,
  onSelect,
}: {
  units: LiveFleetListUnit[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
}) {
  const { enabled, scrollRef, rows, padTop, padBottom, measureRow } = useVirtualRows({
    count: units.length,
    estimateRowHeight: UNIT_ROW_ESTIMATE,
  });

  /** Brings row `index` into view — directly when rendered, else by jumping the scroll container
   * to its estimated offset so the window renders it, then fine-tuning on the next frame. */
  const revealRow = useCallback(
    (index: number, focus: boolean) => {
      const container = scrollRef.current;
      const id = units[index]?.vehicleId;
      if (!container || !id) return;
      const find = () =>
        Array.from(container.querySelectorAll<HTMLButtonElement>('[data-unit-id]')).find((el) => el.dataset.unitId === id) ??
        null;
      const land = (el: HTMLButtonElement | null) => {
        if (!el) return;
        el.scrollIntoView?.({ block: 'nearest' });
        if (focus) el.focus();
      };
      const row = find();
      if (row || !enabled) {
        land(row);
        return;
      }
      container.scrollTop = Math.max(0, index * UNIT_ROW_ESTIMATE - container.clientHeight / 2);
      requestAnimationFrame(() => land(find()));
    },
    [enabled, scrollRef, units],
  );

  // A unit selected from elsewhere (map click, `?unit=` deep link) scrolls into view in the list.
  // Keyed on the selection (and on the list first having rows), never on every data refresh.
  const revealSelected = useEffectEvent(() => {
    const index = units.findIndex((u) => u.vehicleId === selectedId);
    if (index >= 0) revealRow(index, false);
  });
  const hasRows = units.length > 0;
  useEffect(() => {
    if (selectedId && hasRows) revealSelected();
  }, [selectedId, hasRows]);

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-unit-id]')?.dataset.unitId;
    const from = units.findIndex((u) => u.vehicleId === current);
    if (from < 0) return;
    const last = units.length - 1;
    const to =
      event.key === 'ArrowDown' ? Math.min(last, from + 1)
      : event.key === 'ArrowUp' ? Math.max(0, from - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (to === null) return;
    event.preventDefault();
    revealRow(to, true);
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <ul role="list" aria-label="Fleet units" onKeyDown={onKeyDown}>
        {padTop > 0 && <li aria-hidden="true" style={{ height: padTop }} />}
        {rows.map(({ index }) => {
          const unit = units[index]!;
          return (
            <li
              key={unit.vehicleId}
              data-index={index}
              ref={measureRow}
              aria-setsize={enabled ? units.length : undefined}
              aria-posinset={enabled ? index + 1 : undefined}
            >
              <UnitListRow unit={unit} selected={unit.vehicleId === selectedId} onSelect={onSelect} />
            </li>
          );
        })}
        {padBottom > 0 && <li aria-hidden="true" style={{ height: padBottom }} />}
      </ul>
    </div>
  );
}

/** The card's unit: the full `GET /live/fleet/:vehicleId` row once it has loaded, else the slim
 * list row (its detail-only fields then read `—` until the detail lands). */
type DetailCardUnit = LiveFleetListUnit & Partial<Pick<LiveFleetUnit, LiveFleetDetailOnlyField>>;

function DetailCard({
  unit,
  onClose,
  canMessage,
}: {
  unit: DetailCardUnit;
  onClose: () => void;
  canMessage: boolean;
}) {
  const navigate = useNavigate();
  const driveLeft = useCountdownFromSeconds(unit.driveRemainingSec ?? null);
  const shiftEnds = useCountdown(unit.shiftEndsAt ?? null);
  // F3-24 — like the list row (UI-003): a stale or ELD-offline snapshot has no live speed, and its
  // HOS countdowns would keep ticking from a frozen clock.
  const offline = unit.dutyStatus === 'ELD_OFFLINE' || unit.isStale;
  // The HOS clocks come only with the detail row; until it lands they read `—`, never `00:00:00`.
  const noClocks = offline || unit.driveRemainingSec === undefined;

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 max-h-[85%] overflow-y-auto rounded-lg bg-bg-surface p-4 shadow-pop sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-none sm:w-detail-card sm:overflow-visible">
      <div className="flex items-start justify-between">
        <h3 className="text-card-title font-semibold text-text">Unit {unit.unitNumber}</h3>
        {/* Stage 3 — was a bare ~16×16 glyph; now the 32×32 target the Modal close uses. */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-2 -mt-2 flex size-btn-sm shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <p className="text-card-sub text-text-muted">
        {unit.driverName ?? 'Unassigned'}
        {unit.driverPhone ? ` · ${unit.driverPhone}` : ''}
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-body">
        <div className="flex justify-between">
          <dt className="text-text-muted">Duty status</dt>
          <dd className="flex flex-col items-end gap-0.5">
            <LiveUnitBadge unit={unit} />
            <LiveUnitNote unit={unit} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Speed / Odometer</dt>
          <dd className="tabular-nums font-semibold text-text">
            {offline ? '—' : formatSpeed(unit.speedMph)} · {formatOdometer(unit.odometerMi ?? null)} mi
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Location</dt>
          <dd className="max-w-40 text-right font-semibold text-text">{unit.locationLabel ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Drive time left</dt>
          {noClocks ? (
            <dd className="tabular-nums font-semibold text-text-muted">—</dd>
          ) : (
            <dd className={`tabular-nums font-semibold ${driveLeft === 0 ? 'text-danger' : 'text-text'}`}>
              {formatCountdown(driveLeft)}
            </dd>
          )}
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Shift ends in</dt>
          {noClocks ? (
            <dd className="tabular-nums font-semibold text-text-muted">—</dd>
          ) : (
            <dd className={`tabular-nums font-semibold ${shiftEnds < 1200 ? 'text-danger' : 'text-warning'}`}>
              {formatCountdown(shiftEnds)}
            </dd>
          )}
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">ELD</dt>
          {unit.connectivity === 'NO_DEVICE' ? (
            <dd className="font-semibold text-text-muted">No device</dd>
          ) : (
            <dd className={`font-semibold ${unit.bleState === 'CONNECTED' ? 'text-success' : 'text-danger'}`}>
              {unit.eldSerial ?? '—'} · {unit.bleState === 'CONNECTED' ? 'Connected' : 'Disconnected'}
            </dd>
          )}
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        {/* Stage 3 — a driverless unit used to open `/hos-logs?driverId=` (empty param). */}
        <Button
          variant="primary"
          className={canMessage ? 'flex-1' : 'w-full'}
          disabled={!unit.driverId}
          aria-describedby={unit.driverId ? undefined : 'view-logs-no-driver'}
          onClick={() => {
            if (unit.driverId) navigate(`/hos-logs?driverId=${encodeURIComponent(unit.driverId)}`);
          }}
        >
          View logs
        </Button>
        {canMessage && (
          <Button variant="secondary" iconLeft={<MessageSquare size={16} strokeWidth={1.75} />} onClick={() => navigate(messagesHref(unit.driverId))}>
            Message
          </Button>
        )}
      </div>
      {!unit.driverId && (
        <p id="view-logs-no-driver" className="mt-2 text-caption text-text-muted">
          {VIEW_LOGS_NO_DRIVER}
        </p>
      )}
    </div>
  );
}

export default function LiveFleetPage() {
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const fleet = useLiveFleet();
  // F3-03 — a failed 30 s poll keeps the last snapshot (and the mounted map) on screen; only a
  // failure with nothing loaded yet shows the error state.
  const fleetFailed = fleet.isError && !fleet.data;
  const [activeLayers, setActiveLayers] = useState<Set<Layer>>(() => new Set(['Vehicles']));
  // `?unit=<vehicleId>` (Vehicles → `Track on map`) opens the page with that unit selected; the
  // map flies to the selected unit and the list scrolls it into view. F3-25 — the URL is the
  // source of truth for the selection, the search (`q`) and the segment, so a reload or a shared
  // link reopens the same view; every change replaces the history entry.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('unit');
  const query = searchParams.get('q') ?? '';
  const segment = parseSegment(searchParams.get('segment'));
  // `setSearchParams` changes identity with every URL change; the ref keeps `selectUnit` stable
  // for `memo(UnitListRow)`.
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);
  const updateParams = useCallback((key: 'unit' | 'q' | 'segment', value: string | null) => {
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, []);
  const setQuery = (value: string) => updateParams('q', value);
  const setSegment = (value: Segment) => updateParams('segment', value === 'ALL' ? null : value);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Follow mode: the camera rides the selected unit until the dispatcher drags the map; selecting a
  // unit (re)enables it, the `Follow` button turns it back on.
  const [follow, setFollow] = useState(true);
  const [geofenceOpen, setGeofenceOpen] = useState(false);

  // §7.2 — `telemetry.point` is throttled to 200 ms and patched into the cached fleet, one unit at
  // a time; a frame that cannot be mapped (today's `{ vehicleId, count }` has no fix) costs one
  // throttled invalidate instead of a full-fleet refetch per frame (WB-258).
  const pendingPatchesRef = useRef(new Map<string, UnitPatch>());
  const applyPending = useCallback((current: LiveFleetResponse | undefined, pending: Map<string, UnitPatch>) => {
    const next = applyUnitPatches(current, pending);
    pending.clear();
    return next;
  }, []);
  const patchFleet = useThrottledPatch<LiveFleetResponse | undefined, Map<string, UnitPatch>>(qk.liveFleet(), applyPending);
  const invalidateFleet = useThrottledInvalidate(qk.liveFleet());
  // The selected unit's card (`GET /live/fleet/:vehicleId`) is patched by the same frames, so its
  // position/speed/heading/last-seen stay live between its own 30 s polls.
  const pendingDetailRef = useRef<{ vehicleId: string | null; patch: UnitPatch }>({ vehicleId: null, patch: {} });
  const applyDetailPatch = useCallback(
    (current: LiveFleetUnit | undefined, pending: { vehicleId: string | null; patch: UnitPatch }) => {
      const { vehicleId, patch } = pending;
      pending.vehicleId = null;
      pending.patch = {};
      return current && current.vehicleId === vehicleId ? { ...current, ...patch } : current;
    },
    [],
  );
  const patchDetail = useThrottledPatch<LiveFleetUnit | undefined, { vehicleId: string | null; patch: UnitPatch }>(
    qk.liveFleetUnit(selectedId ?? ''),
    applyDetailPatch,
  );
  // CODE-023 — newest frame time applied per unit, so a replayed (older) fix never moves a marker back.
  const lastFrameAtRef = useRef(new Map<string, number>());
  const onTelemetry = (payload: TelemetryPointPayload) => {
    const patch = telemetryUnitPatch(payload);
    const fleet = queryClient.getQueryData<LiveFleetResponse>(qk.liveFleet());
    if (!patch || !fleetHasUnit(fleet, payload.vehicleId)) {
      invalidateFleet();
      return;
    }
    const unit = fleet?.items.find((u) => u.vehicleId === payload.vehicleId);
    if (isStaleFrame(patch.lastSeenAt, unit?.lastSeenAt, lastFrameAtRef.current.get(payload.vehicleId))) return;
    // FE-06 — clamp to the server's "now": one future-dated frame (a device clock running fast)
    // must not mark every later, correctly-timed frame as stale.
    if (patch.lastSeenAt) lastFrameAtRef.current.set(payload.vehicleId, appliedFrameAt(patch.lastSeenAt, serverNowMs()));
    const pending = pendingPatchesRef.current;
    pending.set(payload.vehicleId, { ...pending.get(payload.vehicleId), ...patch });
    patchFleet(pending);
    if (payload.vehicleId === selectedId) {
      const detail = pendingDetailRef.current;
      detail.patch = detail.vehicleId === payload.vehicleId ? { ...detail.patch, ...patch } : patch;
      detail.vehicleId = payload.vehicleId;
      patchDetail(detail);
    }
  };
  // D-149 — the backend sends every unit's `telemetry.point` (with its latest fix) to `fleet` as
  // well, so one subscription moves every marker; no per-vehicle room is needed here.
  useRoom('fleet', {
    'geofence.transition': (payload) => {
      setFlashId(payload.vehicleId);
      setTimeout(() => setFlashId((current) => (current === payload.vehicleId ? null : current)), 2000);
    },
    'telemetry.point': onTelemetry,
  });

  // The subtitle node changes only with the data; its own 1 s tick re-renders just the text.
  const subtitle = useMemo(
    () => (fleetFailed ? null : (
            // Keyed so a new snapshot or fetch state re-initializes the label at once, not 1 s later.
            <RefreshedSubtitle
              key={`${fleet.dataUpdatedAt}:${fleet.isFetching}`}
              dataUpdatedAt={fleet.dataUpdatedAt}
              isFetching={fleet.isFetching}
            />
          )),
    [fleetFailed, fleet.dataUpdatedAt, fleet.isFetching],
  );
  useDynamicSubtitle(subtitle);

  const units = useMemo(() => fleet.data?.items ?? [], [fleet.data]);

  // Overlay data is fetched only while its chip is on — a dispatcher who never opens Trips or
  // Geofences never pays for those requests.
  const trafficAvailable = Boolean(trafficTilesUrl());
  const geofencesQuery = useGeofences({ enabled: activeLayers.has('Geofences') });
  const tripsQuery = useActiveTripRows({ enabled: activeLayers.has('Trips') });
  const geofenceGeoJSON = useMemo(() => geofencesToGeoJSON(geofencesQuery.data?.items ?? []), [geofencesQuery.data]);
  const tripGeoJSON = useMemo(() => {
    const positions = new Map(units.filter(hasPosition).map((u): [string, [number, number]] => [u.vehicleId, [u.lon, u.lat]]));
    return tripsToGeoJSON(tripsQuery.rows, positions);
  }, [tripsQuery.rows, units]);

  // Plates are not on `GET /live/fleet`; the session-cached vehicle lookup supplies them, fetched
  // only once someone actually searches (QA FE-006).
  const searching = query.trim().length > 0;
  const { map: vehicleById } = useVehicleMap(searching);
  // Search first, then the segment — the chip counts describe the search result, so `Driving 3`
  // is never shown over a list that only has one match (QA FE-006).
  const searchMatches = useMemo(
    () =>
      searching
        ? units.filter((u) => matchesUnitSearch(u, query, vehicleById.get(u.vehicleId)?.licensePlate))
        : units,
    [units, query, searching, vehicleById],
  );
  const filtered = useMemo(
    () =>
      searchMatches.filter((u) => {
        if (segment === 'DRIVING') return u.dutyStatus === 'DRIVING';
        if (segment === 'IDLE') return u.dutyStatus === 'IDLE';
        return true;
      }),
    [searchMatches, segment],
  );

  // Memoized so FleetMap gets the same array until the filtered units change (WB-256).
  const mapUnits = useMemo(
    () =>
      filtered.filter(hasPosition).map((u) => ({
        id: u.vehicleId,
        lat: u.lat,
        lon: u.lon,
        // FE-05 — grey marker = ELD offline by `connectivity`, as the dashboard KPI counts it.
        dutyStatus: mapMarkerStatus(u),
        headingDeg: u.headingDeg,
        speedMph: u.speedMph,
        stale: u.isStale,
        lastSeenAt: u.lastSeenAt,
      })),
    [filtered],
  );
  // One callback for every row, so `memo(UnitListRow)` can skip unchanged rows.
  const selectUnit = useCallback(
    (vehicleId: string) => {
      updateParams('unit', vehicleId);
      setFollow(true);
    },
    [updateParams, setFollow],
  );
  const selectFromMap = selectUnit;

  const selected = units.find((u) => u.vehicleId === selectedId) ?? null;
  // The card's full row — fetched (and polled) only while a unit is selected; until it lands, or if
  // it fails, the card shows the list row with the detail-only fields as `—`.
  const detailQuery = useLiveFleetUnit(selectedId);
  const detailUnit: DetailCardUnit | null =
    selected && detailQuery.data?.vehicleId === selected.vehicleId ? detailQuery.data : selected;
  // Breadcrumb trail: the selected unit's last telemetry fixes (`GET /vehicles/:id/telemetry`, 30 s poll
  // while the tab is visible). A role without `vehicles` READ simply gets no trail.
  const trailQuery = useVehicleTelemetry(selectedId ?? undefined, { limit: TRAIL_POINTS });
  const trail = useMemo(() => trailFromTelemetry(trailQuery.data?.items), [trailQuery.data]);
  const { drivingCount, idleCount } = useMemo(
    () => ({
      drivingCount: searchMatches.filter((u) => u.dutyStatus === 'DRIVING').length,
      idleCount: searchMatches.filter((u) => u.dutyStatus === 'IDLE').length,
    }),
    [searchMatches],
  );

  function toggleLayer(layer: Layer) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  return (
    // The route stays `fullBleed` (app/router.tsx), so below 1280px this page keeps running
    // edge-to-edge exactly as before. At `xl:` only, it becomes the W-16 Messages content
    // container (features/messages/MessagesPage.tsx): `xl:m-page` stands in for the page padding
    // the full-bleed `<main>` drops, which leaves `100vh - topbar - 2 * page` — precisely
    // `--spacing-content-h`. `xl:overflow-hidden` clips the left column's square corners inside
    // the new radius; both panes already scroll on their own.
    <div className="flex h-full flex-col lg:flex-row xl:m-page xl:h-content-h xl:overflow-hidden xl:rounded-lg xl:border xl:border-border xl:bg-bg-surface">
      <div className="flex h-[70vh] w-full shrink-0 flex-col border-t border-border bg-bg-surface lg:h-auto lg:w-unit-list lg:border-t-0 lg:border-r">
        <div className="p-4">
          <label className="relative flex items-center">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 text-text-muted" />
            <input
              type="search"
              aria-label="Search units"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search unit, driver, plate…"
              className="h-input w-full rounded-md border border-border bg-bg-app pl-8 pr-3 text-body text-text placeholder:text-text-muted"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {(
              [
                ['ALL', `All ${searchMatches.length}`],
                ['DRIVING', `Driving ${drivingCount}`],
                ['IDLE', `Idle ${idleCount}`],
              ] as [Segment, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={segment === value}
                onClick={() => setSegment(value)}
                className={`h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-body ${
                  segment === value ? 'bg-bg-inverse text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {fleet.isError && fleet.data && <RefreshErrorNotice onRetry={() => void fleet.refetch()} />}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fleet.isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-bg-subtle" />
              ))}
            </div>
          ) : fleetFailed ? (
            <div className="p-4">
              <ErrorState title="Could not load the fleet" onRetry={() => void fleet.refetch()} />
            </div>
          ) : filtered.length === 0 && units.length > 0 ? (
            // Units are reporting — the search/segment just matches none of them (QA FE-006).
            <div className="p-4">
              {searching ? (
                <EmptyState
                  {...searchEmptyState(query.trim())}
                  description="Check the spelling or try a unit number, driver or plate."
                  actions={[{ label: 'Clear search', onClick: () => setQuery('') }]}
                />
              ) : (
                <EmptyState
                  title={segment === 'IDLE' ? 'No idle units right now' : 'No units driving right now'}
                  actions={[{ label: 'Show all units', onClick: () => setSegment('ALL') }]}
                />
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={EMPTY_STATE_COPY.liveFleet.title}
                description={EMPTY_STATE_COPY.liveFleet.description}
              />
            </div>
          ) : (
            <UnitList units={filtered} selectedId={selectedId} onSelect={selectUnit} />
          )}
        </div>
      </div>

      <div className="relative order-first h-[60vh] shrink-0 bg-bg-subtle lg:order-none lg:h-auto lg:flex-1 lg:shrink">
        <div className="absolute left-2 top-2 z-10 flex h-9 max-w-[calc(100%-1rem)] overflow-x-auto rounded-md bg-bg-surface shadow-card sm:left-4 sm:top-4 sm:max-w-none sm:overflow-hidden">
          {MAP_LAYERS.map((layer) => {
            // No traffic tile source configured → the chip says so instead of silently doing nothing.
            const unavailable = layer === 'Traffic' && !trafficAvailable;
            const on = activeLayers.has(layer) && !unavailable;
            return (
              <button
                key={layer}
                type="button"
                aria-pressed={on}
                disabled={unavailable}
                title={unavailable ? TRAFFIC_UNCONFIGURED_TITLE : undefined}
                onClick={() => toggleLayer(layer)}
                className={`shrink-0 whitespace-nowrap px-3 text-body ${
                  on
                    ? 'bg-bg-inverse text-text-inverse'
                    : unavailable
                      ? 'cursor-not-allowed text-text-muted'
                      : 'text-text-secondary hover:bg-bg-subtle'
                }`}
              >
                {layer}
              </button>
            );
          })}
        </div>

        <Can perm="liveFleet" level="FULL">
          <div className="absolute right-2 top-14 z-10 sm:right-4 sm:top-4">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setGeofenceOpen(true)}>
              New geofence
            </Button>
          </div>
        </Can>

        {selected && hasPosition(selected) && (
          <div className="absolute right-2 top-[6.5rem] z-10 sm:right-4 sm:top-16">
            <Button
              variant="secondary"
              aria-pressed={follow}
              iconLeft={<Crosshair size={16} strokeWidth={1.75} />}
              onClick={() => setFollow((v) => !v)}
            >
              {follow ? 'Following' : 'Follow'}
            </Button>
          </div>
        )}

        {fleetFailed ? (
          <div className="flex h-full items-center justify-center">
            <ErrorState title="Map could not be loaded" onRetry={() => void fleet.refetch()} />
          </div>
        ) : (
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-bg-subtle" />}>
            <FleetMap
              units={mapUnits}
              selectedId={selectedId}
              onSelectUnit={selectFromMap}
              follow={follow}
              onFollowChange={setFollow}
              trail={selected ? trail : undefined}
              flashUnitId={flashId}
              layers={activeLayers}
              geofences={geofenceGeoJSON}
              trips={tripGeoJSON}
              now={serverNowMs}
              className="h-full w-full"
            />
          </Suspense>
        )}

        {selected && (
          <DetailCard
            unit={detailUnit ?? selected}
            onClose={() => updateParams('unit', null)}
            canMessage={can('messaging', 'FULL')}
          />
        )}
      </div>

      <Can perm="liveFleet" level="FULL">
        <CreateGeofenceModal open={geofenceOpen} onClose={() => setGeofenceOpen(false)} />
      </Can>
    </div>
  );
}
