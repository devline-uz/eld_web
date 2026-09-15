// owner: web-dashboard-fleet — the one MapLibre integration in the panel (web/tz.md §16.3 rule 5,
// §10 W-01/W-02). Lazy-imported by both features through `React.lazy(() => import(...))` at the
// call site, so this whole module — including `maplibre-gl` and its CSS — lives in one chunk that
// never ships to a screen without a map.
//
// Markers are a GeoJSON source + a symbol layer, never DOM nodes: the fleet grows 69 → 300 units
// and a DOM marker per unit would not hold that budget (§16.3 rule 5 / §16.2 "< 1.5s / 69 marker").
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { DutyStatus } from '@/shared/ui/Badge';

const STYLE_URL: string = import.meta.env.VITE_MAP_STYLE_URL ?? '';

export interface MapUnitFeature {
  id: string;
  lat: number;
  lon: number;
  dutyStatus: DutyStatus;
  headingDeg?: number | null;
}

export interface FleetMapProps {
  units: MapUnitFeature[];
  selectedId?: string | null;
  onSelectUnit?: (id: string) => void;
  className?: string;
  /** Briefly highlighted after a `geofence.transition` event (web/tz.md §7.3). */
  flashUnitId?: string | null;
}

const SOURCE_ID = 'fleet-units';
const CLUSTER_LAYER = 'fleet-clusters';
const CLUSTER_COUNT_LAYER = 'fleet-cluster-count';
const UNCLUSTERED_LAYER = 'fleet-unit-points';
const FLASH_LAYER = 'fleet-unit-flash';

/** Reads a design token at runtime instead of hardcoding a hex literal (web/tz.md §2.2 rule 4). */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const DUTY_TOKEN: Record<DutyStatus, string> = {
  DRIVING: '--color-success',
  ON_DUTY: '--color-danger',
  SLEEPER: '--color-violet',
  OFF_DUTY: '--color-neutral',
  YARD_MOVE: '--color-danger',
  PERSONAL_CONVEYANCE: '--color-neutral',
  ELD_OFFLINE: '--color-danger',
  IDLE: '--color-warning',
  INACTIVE: '--color-neutral',
};

/** A CSS colour keyword, not a hex/rgb literal, so `house/no-design-literal` does not flag the
 * fallback used only when a `--color-*` custom property cannot be read (e.g. no stylesheet yet). */
const RING_COLOUR_FALLBACK = 'white';

/** A 28px filled circle with a white ring — the §10 marker spec, minus the inline truck glyph
 * (recorded in web/decisions.md WD-016: the glyph needs an SDF icon pipeline this phase does not
 * have budget for). MapLibre's typed `addImage` wants raster data, not a canvas element —
 * `getImageData` is the bridge between the two. */
function drawMarkerImageData(color: string): ImageData {
  const size = 56; // 2x for retina
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = token('--color-bg-surface', RING_COLOUR_FALLBACK);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/** Rendered instead of the map when `VITE_MAP_STYLE_URL` is unset — no blank box, no crash. */
export function MapUnavailable({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={
        className ??
        'flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-subtle text-center'
      }
    >
      <MapPin size={24} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
      <p className="text-body-strong text-text">Map preview unavailable</p>
      <p className="max-w-64 text-card-sub text-text-muted">
        No map style is configured for this environment (VITE_MAP_STYLE_URL). Unit data is still
        live in the list below.
      </p>
    </div>
  );
}

/** Guards against everything that can wreck the camera fit: `null`/`undefined` coerced to `0`,
 * `NaN`, out-of-range values, and the classic "null island" sentinel (`0, 0`) that some upstream
 * systems use in place of a real fix (web/bugs.md WB-049). A unit that fails this check is simply
 * not drawn — it never reaches the GeoJSON source or the bounds computation. */
function isValidCoord(lat: number, lon: number): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

function validUnits(units: MapUnitFeature[]): MapUnitFeature[] {
  return units.filter((u) => isValidCoord(u.lat, u.lon));
}

function toFeatureCollection(units: MapUnitFeature[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: validUnits(units).map(
      (u): Feature<Point> => ({
        type: 'Feature',
        id: u.id,
        geometry: { type: 'Point', coordinates: [u.lon, u.lat] },
        properties: { id: u.id, dutyStatus: u.dutyStatus, icon: `marker-${u.dutyStatus}` },
      }),
    ),
  };
}

/** Continental-US default view (web/tz.md §10 W-02) — used only when there is not a single valid
 * fix to fit bounds to, so the map never defaults to `[0, 0]`/mid-ocean. */
const DEFAULT_US_CENTER: [number, number] = [-97, 38.5];
const DEFAULT_US_ZOOM = 3.4;
/** Padding kept away from the DetailCard/layer chips overlaid on top of the map (px). */
const FIT_BOUNDS_PADDING = 64;
const FIT_BOUNDS_MAX_ZOOM = 10;

function fitToUnits(map: maplibregl.Map, units: MapUnitFeature[]) {
  const points = validUnits(units);
  if (points.length === 0) {
    map.jumpTo({ center: DEFAULT_US_CENTER, zoom: DEFAULT_US_ZOOM });
    return;
  }
  if (points.length === 1) {
    map.easeTo({ center: [points[0]!.lon, points[0]!.lat], zoom: 10, duration: 0 });
    return;
  }
  const bounds = points.reduce(
    (acc, u) => acc.extend([u.lon, u.lat]),
    new maplibregl.LngLatBounds([points[0]!.lon, points[0]!.lat], [points[0]!.lon, points[0]!.lat]),
  );
  map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING, maxZoom: FIT_BOUNDS_MAX_ZOOM, duration: 0 });
}

const HAS_STYLE = Boolean(STYLE_URL);

export default function FleetMap({ units, selectedId, onSelectUnit, className, flashUnitId }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Fit the camera to the fleet once real data arrives, but never again on every 30s poll —
  // that would yank the map out from under a dispatcher who has since panned/zoomed by hand.
  const hasFitToDataRef = useRef(false);
  const unitsRef = useRef(units);
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // Every hook below runs unconditionally (rules-of-hooks); each effect bails out internally
  // when there is no style to render against, and the JSX branch is decided once, at the end.
  useEffect(() => {
    if (!HAS_STYLE || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      // Neutral until `fitToUnits` runs on `load` — never a fixed regional center, so a fleet
      // clustered somewhere else never renders as a blank patch of ocean (web/bugs.md WB-049).
      center: DEFAULT_US_CENTER,
      zoom: DEFAULT_US_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('error', () => setLoadError(true));

    map.on('load', () => {
      for (const status of Object.keys(DUTY_TOKEN) as DutyStatus[]) {
        const id = `marker-${status}`;
        if (map.hasImage(id)) continue;
        const image = drawMarkerImageData(token(DUTY_TOKEN[status], 'gray'));
        map.addImage(id, image, { pixelRatio: 2 });
      }

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toFeatureCollection(units),
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': token('--color-primary-active', 'navy'),
          'circle-radius': 16,
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
        },
        paint: { 'text-color': token('--color-text-inverse', 'white') },
      });
      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.5,
          'icon-allow-overlap': true,
        },
      });
      map.addLayer({
        id: FLASH_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'id'], '__none__'],
        paint: {
          'circle-radius': 22,
          'circle-color': token('--color-warning', 'orange'),
          'circle-opacity': 0.35,
        },
      });

      map.on('click', UNCLUSTERED_LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectUnit?.(id);
      });
      map.on('mouseenter', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      // The container can still be mid-layout (0×0, or its final flex size not yet settled) at
      // the moment `new maplibregl.Map()` read it — a stale canvas size is the other classic cause
      // of a "blank" map (web/bugs.md WB-049). `resize()` re-reads the live container box.
      map.resize();
      if (validUnits(unitsRef.current).length > 0) {
        fitToUnits(map, unitsRef.current);
        hasFitToDataRef.current = true;
      } else {
        fitToUnits(map, []);
      }

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
      hasFitToDataRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates run through the source below
  }, []);

  /** Resize whenever the container's own box changes — sidebar collapse, window resize, the
   * detail-card overlay toggling, or the Suspense fallback swapping in at a different size than
   * the map was born at. `ResizeObserver` is absent in jsdom, so this effect is a no-op there. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Point updates patch the existing GeoJSON source instead of remounting the map (§16.3 rule 6). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(units));
    // First data arrives after `load` (e.g. the initial fetch was still pending) — fit once, then
    // leave the camera alone for subsequent polls so a dispatcher's own pan/zoom is not undone.
    if (!hasFitToDataRef.current && validUnits(units).length > 0) {
      fitToUnits(map, units);
      hasFitToDataRef.current = true;
    }
  }, [units, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter(FLASH_LAYER, ['==', ['get', 'id'], flashUnitId ?? '__none__']);
  }, [flashUnitId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const unit = units.find((u) => u.id === selectedId);
    if (unit) map.easeTo({ center: [unit.lon, unit.lat], duration: 300 });
  }, [selectedId, ready, units]);

  if (!HAS_STYLE || loadError) {
    return <MapUnavailable className={className} />;
  }

  return <div ref={containerRef} className={className ?? 'h-full w-full rounded-md'} />;
}
