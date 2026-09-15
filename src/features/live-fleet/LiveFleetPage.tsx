// owner: web-dashboard-fleet — W-02 Live Fleet (web/tz.md §10 W-02).
// Design: web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { qk } from '@/shared/api/queryKeys';
import { useLiveFleet, hasPosition, type LiveFleetUnit } from '@/shared/api/liveFleet';
import { usePermission } from '@/shared/auth/usePermission';
import { Can } from '@/shared/auth/Can';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
// Direct file imports, not the `@/shared/ui` barrel (web/decisions.md WD-021).
import { Button } from '@/shared/ui/Button';
import { DutyBadge } from '@/shared/ui/Badge';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { formatSpeed, formatOdometer } from '@/shared/format/numbers';
import { useRelativeTime } from '@/shared/format/useRelativeTime';
import { useCountdown, useCountdownFromSeconds, formatCountdown } from '@/shared/hooks/useCountdown';
import { CreateGeofenceModal } from './components/CreateGeofenceModal';

const FleetMap = lazy(() => import('@/shared/map/FleetMap'));

const LAYERS = ['Vehicles', 'Trips', 'Geofences', 'Traffic'] as const;
type Layer = (typeof LAYERS)[number];

type Segment = 'ALL' | 'DRIVING' | 'IDLE';

function refreshedLabel(dataUpdatedAt: number): string | null {
  if (!dataUpdatedAt) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000));
  if (seconds < 60) return `refreshed ${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  return `refreshed ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

/** `refreshed N seconds ago`, ticking every second (web/tz.md §10 W-02). `Date.now()` is only
 * ever read inside `useState`'s lazy initializer or the interval callback below — never directly
 * in the render body — so this stays outside React's render-purity check. */
function useRefreshedAgo(dataUpdatedAt: number): string | null {
  const [label, setLabel] = useState(() => refreshedLabel(dataUpdatedAt));

  useEffect(() => {
    const timer = setInterval(() => setLabel(refreshedLabel(dataUpdatedAt)), 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  return label;
}

function UnitListRow({
  unit,
  selected,
  onSelect,
}: {
  unit: LiveFleetUnit;
  selected: boolean;
  onSelect: () => void;
}) {
  const lastSeen = useRelativeTime(unit.lastSeenAt, 'short');
  const offline = unit.dutyStatus === 'ELD_OFFLINE';
  return (
    <li>
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={`flex w-full flex-col gap-0.5 border-l-2 px-4 py-3 text-left ${
          selected ? 'border-l-primary bg-primary-soft' : 'border-l-transparent hover:bg-bg-subtle'
        }`}
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-body-strong text-text">Unit {unit.unitNumber}</span>
            <DutyBadge status={unit.dutyStatus} />
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
      </button>
    </li>
  );
}

function DetailCard({
  unit,
  onClose,
  canMessage,
}: {
  unit: LiveFleetUnit;
  onClose: () => void;
  canMessage: boolean;
}) {
  const navigate = useNavigate();
  const driveLeft = useCountdownFromSeconds(unit.driveRemainingSec);
  const shiftEnds = useCountdown(unit.shiftEndsAt);

  return (
    <div className="absolute right-4 top-4 w-detail-card rounded-lg bg-bg-surface p-4 shadow-pop">
      <div className="flex items-start justify-between">
        <h3 className="text-card-title font-semibold text-text">Unit {unit.unitNumber}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="text-text-muted hover:text-text">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <p className="text-card-sub text-text-muted">
        {unit.driverName ?? 'Unassigned'}
        {unit.driverPhone ? ` · ${unit.driverPhone}` : ''}
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-body">
        <div className="flex justify-between">
          <dt className="text-text-muted">Duty status</dt>
          <dd>
            <DutyBadge status={unit.dutyStatus} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Speed / Odometer</dt>
          <dd className="tabular-nums font-semibold text-text">
            {formatSpeed(unit.speedMph)} · {formatOdometer(unit.odometerMi)} mi
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Location</dt>
          <dd className="max-w-40 text-right font-semibold text-text">{unit.locationLabel ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Drive time left</dt>
          <dd className={`tabular-nums font-semibold ${driveLeft === 0 ? 'text-danger' : 'text-text'}`}>
            {formatCountdown(driveLeft)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Shift ends in</dt>
          <dd className={`tabular-nums font-semibold ${shiftEnds < 1200 ? 'text-danger' : 'text-warning'}`}>
            {formatCountdown(shiftEnds)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">ELD</dt>
          <dd className={`font-semibold ${unit.bleState === 'CONNECTED' ? 'text-success' : 'text-danger'}`}>
            {unit.eldSerial ?? '—'} · {unit.bleState === 'CONNECTED' ? 'Connected' : 'Disconnected'}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          className={canMessage ? 'flex-1' : 'w-full'}
          onClick={() => navigate(`/hos-logs?driverId=${unit.driverId ?? ''}`)}
        >
          View logs
        </Button>
        {canMessage && (
          <Button variant="secondary" iconLeft={<MessageSquare size={16} strokeWidth={1.75} />} onClick={() => navigate('/messages')}>
            Message
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LiveFleetPage() {
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const fleet = useLiveFleet();
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('ALL');
  const [activeLayers, setActiveLayers] = useState<Set<Layer>>(() => new Set(['Vehicles']));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [geofenceOpen, setGeofenceOpen] = useState(false);

  useRoom('fleet', {
    'geofence.transition': (payload) => {
      setFlashId(payload.vehicleId);
      setTimeout(() => setFlashId((current) => (current === payload.vehicleId ? null : current)), 2000);
    },
  });
  useRoom(selectedId ? `vehicle:${selectedId}` : null, {
    'telemetry.point': () => void queryClient.invalidateQueries({ queryKey: qk.liveFleet() }),
  });

  const refreshedLabel = useRefreshedAgo(fleet.dataUpdatedAt);
  useDynamicSubtitle(fleet.isError ? null : `Real-time GPS · ${refreshedLabel ?? 'refreshing…'}`);

  const units = useMemo(() => fleet.data?.items ?? [], [fleet.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (segment === 'DRIVING' && u.dutyStatus !== 'DRIVING') return false;
      if (segment === 'IDLE' && u.dutyStatus !== 'IDLE') return false;
      if (!q) return true;
      return (
        u.unitNumber.toLowerCase().includes(q) ||
        (u.driverName ?? '').toLowerCase().includes(q)
      );
    });
  }, [units, query, segment]);

  const selected = units.find((u) => u.vehicleId === selectedId) ?? null;
  const drivingCount = units.filter((u) => u.dutyStatus === 'DRIVING').length;
  const idleCount = units.filter((u) => u.dutyStatus === 'IDLE').length;

  function toggleLayer(layer: Layer) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  return (
    <div className="flex h-full">
      <div className="flex w-unit-list shrink-0 flex-col border-r border-border bg-bg-surface">
        <div className="p-4">
          <label className="relative flex items-center">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search unit, driver, plate…"
              className="h-input w-full rounded-md border border-border bg-bg-app pl-8 pr-3 text-body text-text placeholder:text-text-muted"
            />
          </label>
          <div className="mt-3 flex gap-2">
            {(
              [
                ['ALL', `All ${units.length}`],
                ['DRIVING', `Driving ${drivingCount}`],
                ['IDLE', `Idle ${idleCount}`],
              ] as [Segment, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={segment === value}
                onClick={() => setSegment(value)}
                className={`h-8 rounded-md px-3 text-body ${
                  segment === value ? 'bg-bg-inverse text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {fleet.isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-bg-subtle" />
              ))}
            </div>
          ) : fleet.isError ? (
            <div className="p-4">
              <ErrorState title="Could not load the fleet" onRetry={() => void fleet.refetch()} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={EMPTY_STATE_COPY.liveFleet.title}
                description={EMPTY_STATE_COPY.liveFleet.description}
              />
            </div>
          ) : (
            <ul role="list" aria-label="Fleet units">
              {filtered.map((unit) => (
                <UnitListRow
                  key={unit.vehicleId}
                  unit={unit}
                  selected={unit.vehicleId === selectedId}
                  onSelect={() => setSelectedId(unit.vehicleId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="relative flex-1 bg-bg-subtle">
        <div className="absolute left-4 top-4 z-10 flex h-9 overflow-hidden rounded-md bg-bg-surface shadow-card">
          {LAYERS.map((layer) => (
            <button
              key={layer}
              type="button"
              aria-pressed={activeLayers.has(layer)}
              onClick={() => toggleLayer(layer)}
              className={`px-3 text-body ${
                activeLayers.has(layer) ? 'bg-bg-inverse text-text-inverse' : 'text-text-secondary hover:bg-bg-subtle'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>

        <Can perm="liveFleet" level="FULL">
          <div className="absolute right-4 top-4 z-10">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setGeofenceOpen(true)}>
              New geofence
            </Button>
          </div>
        </Can>

        {fleet.isError ? (
          <div className="flex h-full items-center justify-center">
            <ErrorState title="Map could not be loaded" onRetry={() => void fleet.refetch()} />
          </div>
        ) : (
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-bg-subtle" />}>
            <FleetMap
              units={filtered.filter(hasPosition).map((u) => ({
                id: u.vehicleId,
                lat: u.lat!,
                lon: u.lon!,
                dutyStatus: u.dutyStatus,
                headingDeg: u.headingDeg,
              }))}
              selectedId={selectedId}
              onSelectUnit={setSelectedId}
              flashUnitId={flashId}
              className="h-full w-full"
            />
          </Suspense>
        )}

        {selected && (
          <DetailCard unit={selected} onClose={() => setSelectedId(null)} canMessage={can('messaging', 'FULL')} />
        )}
      </div>

      <Can perm="liveFleet" level="FULL">
        <CreateGeofenceModal open={geofenceOpen} onClose={() => setGeofenceOpen(false)} />
      </Can>
    </div>
  );
}
