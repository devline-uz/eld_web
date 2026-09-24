// owner: web-vehicles-drivers — W-05 Unit histories / route replay (web/tz.md §10 W-05).
// Design: web/roles and screens/admin panel/Route replay, drive : stop : idle segments.jpg
//
// B-4 shipped 2026-09-24 (web/backend-gaps.md handoff table) — `GET /vehicles/:id/histories?date=`
// is real and returns server-side segmented DRIVE/STOP/IDLE with a lat/lon per segment marker.
// Route replay renders that track as a lightweight SVG polyline (no MapLibre tiles needed for a
// single day's coarse marker path) and animates a dot along it at 1x/2x/4x with a scrub slider.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronRight as Crumb, Download, Pause, Play, Route, Clock, Timer, Fuel } from 'lucide-react';
import { useVehicle, useVehicleHistories, type RouteSegment } from '@/shared/api/vehicles';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { KpiCard } from '@/shared/ui/KpiCard';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { formatDistance, formatSpeed, formatFuelWasted } from '@/shared/format/numbers';
import { formatDuration } from '@/shared/format/duration';
import { formatLocal } from '@/shared/format/datetime';
import { toCsv } from '@/shared/lib/csv';

type SegmentFilter = 'ALL' | 'DRIVE' | 'STOP' | 'IDLE';

const SEGMENT_TONE: Record<RouteSegment['type'], 'success' | 'danger' | 'warning'> = {
  DRIVE: 'success',
  STOP: 'danger',
  IDLE: 'warning',
};

const REPLAY_SPEEDS = [1, 2, 4] as const;

export default function UnitHistoriesPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL');

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

  const segments = useMemo(() => historiesQuery.data?.segments ?? [], [historiesQuery.data]);
  const filteredSegments = segmentFilter === 'ALL' ? segments : segments.filter((s) => s.type === segmentFilter);
  const counts = {
    all: segments.length,
    drive: segments.filter((s) => s.type === 'DRIVE').length,
    stop: segments.filter((s) => s.type === 'STOP').length,
    idle: segments.filter((s) => s.type === 'IDLE').length,
  };

  /* ------------------------------------------------------------------ route replay */
  const trackStartMs = historiesQuery.data?.firstMovementAt ? new Date(historiesQuery.data.firstMovementAt).getTime() : 0;
  const trackEndMs = historiesQuery.data?.lastMovementAt ? new Date(historiesQuery.data.lastMovementAt).getTime() : 0;
  const trackDurationMs = Math.max(trackEndMs - trackStartMs, 0);
  const hasTrack = segments.length > 0 && trackDurationMs > 0;

  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<(typeof REPLAY_SPEEDS)[number]>(1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // A new day resets the scrubber and stops playback — adjusted during render (React's documented
  // pattern for resetting state on a prop/key change) rather than in an effect, which would cause
  // an extra commit.
  const dayKey = `${id ?? ''}-${date}`;
  const [prevDayKey, setPrevDayKey] = useState(dayKey);
  if (prevDayKey !== dayKey) {
    setPrevDayKey(dayKey);
    setIsPlaying(false);
    setElapsedMs(0);
  }

  useEffect(() => {
    if (!isPlaying || !hasTrack) return undefined;
    const tick = (now: number) => {
      const last = lastTickRef.current ?? now;
      lastTickRef.current = now;
      setElapsedMs((prev) => {
        const next = prev + (now - last) * replaySpeed;
        if (next >= trackDurationMs) {
          setIsPlaying(false);
          lastTickRef.current = null;
          return trackDurationMs;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [isPlaying, hasTrack, replaySpeed, trackDurationMs]);

  function togglePlay() {
    if (!hasTrack) return;
    if (!isPlaying && elapsedMs >= trackDurationMs) setElapsedMs(0);
    setIsPlaying((v) => !v);
  }

  const currentTimeMs = trackStartMs + elapsedMs;
  // Marker currently "active" — the last segment whose window has started.
  const activeMarker = useMemo(() => {
    if (!hasTrack) return null;
    let active = segments[0];
    for (const s of segments) {
      if (new Date(s.startAt).getTime() <= currentTimeMs) active = s;
    }
    return active;
  }, [segments, hasTrack, currentTimeMs]);

  // Normalise lat/lon into a 300x140 SVG viewbox.
  const mapGeometry = useMemo(() => {
    if (!hasTrack) return null;
    const lats = segments.map((s) => s.lat);
    const lons = segments.map((s) => s.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const padX = 20;
    const padY = 20;
    const w = 300 - padX * 2;
    const h = 140 - padY * 2;
    const spanLat = maxLat - minLat || 1;
    const spanLon = maxLon - minLon || 1;
    const project = (lat: number, lon: number) => ({
      x: padX + ((lon - minLon) / spanLon) * w,
      // lat grows north; SVG y grows down.
      y: padY + (1 - (lat - minLat) / spanLat) * h,
    });
    return { points: segments.map((s) => ({ marker: s.marker, type: s.type, ...project(s.lat, s.lon) })) };
  }, [segments, hasTrack]);

  const markerPosition = useMemo(() => {
    if (!hasTrack || !mapGeometry) return null;
    const idx = segments.findIndex((s) => s.marker === activeMarker?.marker);
    if (idx < 0) return mapGeometry.points[0] ?? null;
    const curr = mapGeometry.points[idx];
    const next = mapGeometry.points[idx + 1];
    const seg = segments[idx];
    if (!next || !curr || !seg) return curr ?? null;
    const segStart = new Date(seg.startAt).getTime();
    const segEnd = new Date(seg.endAt).getTime();
    const frac = segEnd > segStart ? Math.min(Math.max((currentTimeMs - segStart) / (segEnd - segStart), 0), 1) : 1;
    return { ...curr, x: curr.x + (next.x - curr.x) * frac, y: curr.y + (next.y - curr.y) * frac };
  }, [hasTrack, mapGeometry, segments, activeMarker, currentTimeMs]);

  function exportSegments() {
    const csv = toCsv([
      ['type', 'start', 'end', 'durationSec', 'location', 'distanceMi', 'odometerMi', 'driver'],
      ...filteredSegments.map((s) => [
        s.type,
        s.startAt,
        s.endAt,
        s.durationSec,
        s.location,
        s.distanceMi ?? '',
        s.odometerMi,
        s.driverName,
      ]),
    ]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `unit-histories-${vehicleQuery.data?.unitNumber ?? id}-${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

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
          {/* The button had no `onClick` at all. There is no histories export endpoint (B-4
              covers the read itself), so the file is built from the segments on screen — the
              active segment filter included. */}
          <Button
            variant="secondary"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            disabled={filteredSegments.length === 0}
            onClick={exportSegments}
          >
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
                <div className="flex items-center gap-2">
                  <div className="flex h-8 overflow-hidden rounded-md border border-border">
                    {REPLAY_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        aria-pressed={replaySpeed === speed}
                        onClick={() => setReplaySpeed(speed)}
                        disabled={!hasTrack}
                        className={`px-2 text-caption font-semibold ${
                          replaySpeed === speed ? 'bg-bg-inverse text-text-inverse' : 'bg-bg-surface text-text-secondary hover:bg-bg-subtle'
                        }`}
                      >
                        {speed}×
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={isPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
                    disabled={!hasTrack}
                    title={hasTrack ? undefined : 'No track to replay — this day has no movement segments.'}
                    onClick={togglePlay}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                </div>
              }
            />
            {!hasTrack ? (
              <p className="mt-1 text-caption text-text-muted">No track to replay — this day has no movement segments.</p>
            ) : (
              <>
                <input
                  type="range"
                  min={0}
                  max={trackDurationMs}
                  step={1}
                  value={elapsedMs}
                  aria-label="Replay position"
                  onChange={(e) => {
                    setIsPlaying(false);
                    setElapsedMs(Number(e.target.value));
                  }}
                  className="mt-3 w-full accent-primary"
                />
                <div className="mt-3 h-route-preview rounded-md border border-dashed border-border bg-bg-subtle p-2">
                  <svg viewBox="0 0 300 140" className="size-full">
                    {mapGeometry && mapGeometry.points.length > 1 && (
                      <polyline
                        points={mapGeometry.points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {mapGeometry?.points.map((p, i) => {
                      const isStart = i === 0;
                      const isEnd = i === mapGeometry.points.length - 1;
                      const fill =
                        isEnd && !isStart
                          ? 'var(--color-danger)'
                          : isStart
                            ? 'var(--color-success)'
                            : `var(--color-${SEGMENT_TONE[p.type]})`;
                      return (
                        <g
                          key={p.marker}
                          onMouseEnter={() => setHoveredMarker(p.marker)}
                          onMouseLeave={() => setHoveredMarker((m) => (m === p.marker ? null : m))}
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredMarker === p.marker ? 8 : 6}
                            fill={fill}
                            stroke="var(--color-bg-surface)"
                            strokeWidth={1.5}
                          />
                          <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={7} fill="var(--color-text-inverse)">
                            {p.marker}
                          </text>
                        </g>
                      );
                    })}
                    {markerPosition && (
                      <circle cx={markerPosition.x} cy={markerPosition.y} r={4} fill="var(--color-bg-inverse)" stroke="var(--color-bg-surface)" strokeWidth={1} />
                    )}
                  </svg>
                </div>
                <div className="mt-2 flex items-center gap-3 text-caption text-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-success" /> Start
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-danger" /> Stop
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-danger" /> End
                  </span>
                  <span className="ml-auto tabular-nums">
                    {formatLocal(new Date(currentTimeMs).toISOString(), 'time')}
                  </span>
                </div>
              </>
            )}
          </Card>

          <div className="grid grid-cols-[1fr_348px] gap-4">
            <Card padded={false}>
              <div className="flex items-center justify-between p-card pb-0">
                <SectionHeader title="Movement segments" subtitle={`${segments.length} segments today · drive, stop and idle`} />
                {hasTrack && (
                  <Button variant="ghost" size="sm" onClick={() => setHoveredMarker(hoveredMarker ? null : (segments[0]?.marker ?? null))}>
                    View on map
                  </Button>
                )}
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
                    <tr
                      key={`${s.marker}-${s.startAt}`}
                      className={`border-t border-border hover:bg-bg-subtle ${hoveredMarker === s.marker ? 'bg-bg-subtle' : ''}`}
                      onMouseEnter={() => setHoveredMarker(s.marker)}
                      onMouseLeave={() => setHoveredMarker((m) => (m === s.marker ? null : m))}
                    >
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
