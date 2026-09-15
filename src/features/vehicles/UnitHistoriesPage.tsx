// owner: web-vehicles-drivers — W-05 Unit histories / route replay (web/tz.md §10 W-05).
// Design: web/roles and screens/admin panel/Route replay, drive : stop : idle segments.jpg
//
// ⛔ GAP B-4 — `GET /vehicles/:id/histories?date=` does not exist on the real backend. Per
// web/tz.md this screen "does not ship for real without it" (a client-side telemetry fan-out
// would pull ~60,000 points into the browser, explicitly rejected by the spec). Built and
// reviewable against the documented shape from MSW; not production-live.
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronRight as Crumb, Download, Play, Route, Clock, Timer, Fuel } from 'lucide-react';
import { useVehicle, useVehicleHistories, type RouteSegment } from '@/shared/api/vehicles';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { KpiCard } from '@/shared/ui/KpiCard';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { formatDistance, formatSpeed, formatFuelWasted } from '@/shared/format/numbers';
import { formatDuration } from '@/shared/format/duration';
import { formatLocal } from '@/shared/format/datetime';

type SegmentFilter = 'ALL' | 'DRIVE' | 'STOP' | 'IDLE';

const SEGMENT_TONE: Record<RouteSegment['type'], 'success' | 'danger' | 'warning'> = {
  DRIVE: 'success',
  STOP: 'danger',
  IDLE: 'warning',
};

export default function UnitHistoriesPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL');
  const [playing, setPlaying] = useState(false);

  const vehicleQuery = useVehicle(id);
  const historiesQuery = useVehicleHistories(id, date);

  function setDate(next: string) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('date', next);
    setParams(nextParams, { replace: true });
  }

  function shiftDay(delta: number) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  const segments = historiesQuery.data?.segments ?? [];
  const filteredSegments = segmentFilter === 'ALL' ? segments : segments.filter((s) => s.type === segmentFilter);
  const counts = {
    all: segments.length,
    drive: segments.filter((s) => s.type === 'DRIVE').length,
    stop: segments.filter((s) => s.type === 'STOP').length,
    idle: segments.filter((s) => s.type === 'IDLE').length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-caption text-text-muted">
        <Link to="/vehicles" className="hover:text-text">
          Vehicles
        </Link>
        <Crumb size={12} strokeWidth={1.75} />
        <Link to={`/vehicles/${id}`} className="hover:text-text">
          Unit {vehicleQuery.data?.unitNumber ?? id}
        </Link>
        <Crumb size={12} strokeWidth={1.75} />
        <span>
          Histories · {formatLocal(`${date}T00:00:00`, 'longDate')} · Eastern
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-body-strong text-text">
            🚚 Unit {vehicleQuery.data?.unitNumber ?? id} · {[vehicleQuery.data?.make, vehicleQuery.data?.model].filter(Boolean).join(' ')}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" iconOnly aria-label="Previous day" onClick={() => shiftDay(-1)}>
              <ChevronLeft size={16} strokeWidth={1.75} />
            </Button>
            <span className="tabular-nums text-body text-text">{formatLocal(`${date}T00:00:00`, 'longDate')}</span>
            <Button variant="ghost" iconOnly aria-label="Next day" onClick={() => shiftDay(1)}>
              <ChevronRight size={16} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 overflow-hidden rounded-md border border-border">
            {(
              [
                ['ALL', `All ${counts.all}`],
                ['DRIVE', `Drive ${counts.drive}`],
                ['STOP', `Stop ${counts.stop}`],
                ['IDLE', `Idle ${counts.idle}`],
              ] as [SegmentFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={segmentFilter === value}
                onClick={() => setSegmentFilter(value)}
                className={
                  segmentFilter === value
                    ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                    : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />}>
            Export
          </Button>
        </div>
      </div>

      {historiesQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : historiesQuery.isError || !historiesQuery.data ? (
        <ErrorState onRetry={() => historiesQuery.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              icon={Route}
              label="Distance travelled"
              value={`${formatDistance(historiesQuery.data.distanceMi)} mi`}
              hint={`${historiesQuery.data.driveSegments} drive segments`}
            />
            <KpiCard
              icon={Clock}
              label="Drive time"
              value={formatDuration(historiesQuery.data.driveTimeSec)}
              hint={`avg ${formatSpeed(historiesQuery.data.avgSpeedMph)}`}
            />
            <KpiCard
              icon={Timer}
              label="Stops"
              value={String(historiesQuery.data.stopCount)}
              hint={`total ${formatDuration(historiesQuery.data.stopTimeSec)}`}
            />
            <KpiCard
              icon={Fuel}
              iconTone="warning"
              label="Idle time"
              value={formatDuration(historiesQuery.data.idleTimeSec)}
              chip={{ text: `${formatFuelWasted(historiesQuery.data.idleFuelWastedGal)} wasted`, tone: 'warning' }}
            />
          </div>

          <Card>
            <SectionHeader
              title="Route replay"
              subtitle={`${formatLocal(historiesQuery.data.firstMovementAt, 'monthDay')} · ${formatLocal(historiesQuery.data.firstMovementAt, 'time')} → ${formatLocal(historiesQuery.data.lastMovementAt, 'time')} · ${formatDistance(historiesQuery.data.distanceMi)} mi`}
              action={
                <Button variant="secondary" size="sm" iconLeft={<Play size={14} strokeWidth={1.75} />} onClick={() => setPlaying((p) => !p)}>
                  {playing ? 'Pause' : 'Play'}
                </Button>
              }
            />
            <div className="mt-3 flex h-route-preview flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-subtle text-center">
              <p className="text-card-sub text-text-muted">
                Map preview unavailable in this environment — {segments.length} segments recorded.
              </p>
              <div className="flex items-center gap-3 text-caption text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-success" /> Start
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-danger" /> Stop
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-danger" /> End
                </span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-[1fr_348px] gap-4">
            <Card padded={false}>
              <div className="p-card pb-0">
                <SectionHeader title="Movement segments" subtitle={`${segments.length} segments today · drive, stop and idle`} />
              </div>
              <table className="mt-2 w-full text-body">
                <thead>
                  <tr className="border-t border-border text-table-head text-text-muted">
                    <th className="p-3 text-left font-semibold">TYPE</th>
                    <th className="p-3 text-left font-semibold">START</th>
                    <th className="p-3 text-left font-semibold">END</th>
                    <th className="p-3 text-left font-semibold">DURATION</th>
                    <th className="p-3 text-left font-semibold">LOCATION</th>
                    <th className="p-3 text-right font-semibold">DISTANCE</th>
                    <th className="p-3 text-right font-semibold">ODOMETER</th>
                    <th className="p-3 text-left font-semibold">DRIVER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSegments.map((s) => (
                    <tr key={`${s.marker}-${s.startAt}`} className="border-t border-border hover:bg-bg-subtle">
                      <td className="p-3">
                        <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-bg-subtle text-caption font-semibold">
                          {s.marker}
                        </span>
                        <Badge tone={SEGMENT_TONE[s.type]}>{s.type.charAt(0) + s.type.slice(1).toLowerCase()}</Badge>
                      </td>
                      <td className="p-3 tabular-nums">{formatLocal(s.startAt, 'time')}</td>
                      <td className="p-3 tabular-nums">{formatLocal(s.endAt, 'time')}</td>
                      <td className="p-3 tabular-nums">{formatDuration(s.durationSec)}</td>
                      <td className="p-3 text-text-secondary">{s.location}</td>
                      <td className="p-3 text-right tabular-nums">{s.distanceMi != null ? `${formatDistance(s.distanceMi)} mi` : '—'}</td>
                      <td className="p-3 text-right tabular-nums">{formatDistance(s.odometerMi)} mi</td>
                      <td className="p-3">{s.driverName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card>
              <SectionHeader title="Day summary" subtitle="From the ELD event stream" />
              <dl className="mt-2 flex flex-col gap-2 text-body">
                <div className="flex justify-between">
                  <dt className="text-text-muted">First movement</dt>
                  <dd className="tabular-nums text-text">{formatLocal(historiesQuery.data.firstMovementAt, 'timeSeconds')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Last movement</dt>
                  <dd className="tabular-nums text-text">{formatLocal(historiesQuery.data.lastMovementAt, 'timeSeconds')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Engine on time</dt>
                  <dd className="tabular-nums text-text">{formatDuration(historiesQuery.data.engineOnSec)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Engine off time</dt>
                  <dd className="tabular-nums text-text">{formatDuration(historiesQuery.data.engineOffSec)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Longest drive</dt>
                  <dd className="text-right text-text">
                    {historiesQuery.data.longestDrive.label} — {formatDuration(historiesQuery.data.longestDrive.durationSec)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Longest stop</dt>
                  <dd className="text-right text-text">
                    {historiesQuery.data.longestStop.label} — {formatDuration(historiesQuery.data.longestStop.durationSec)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Max speed</dt>
                  <dd className="tabular-nums text-text">
                    {formatSpeed(historiesQuery.data.maxSpeedMph)} at {formatLocal(historiesQuery.data.maxSpeedAt, 'time')}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
