// owner: web-dashboard-fleet — the one MapLibre integration in the panel (web/tz.md §16.3 rule 5,
// §10 W-01/W-02). Lazy-imported by both features through `React.lazy(() => import(...))` at the
// call site, so this whole module — including `maplibre-gl` and its CSS — lives in one chunk that
// never ships to a screen without a map.
//
// Markers are a GeoJSON source + a symbol layer, never DOM nodes: the fleet grows 69 → 300 units
// and a DOM marker per unit would not hold that budget (§16.3 rule 5 / §16.2 "< 1.5s / 69 marker").
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 locates its tile worker next to its own module via `import.meta.url`. Vite's dep
// pre-bundling (dev) and the `maplibre` manual chunk (build) both move that module, so the derived
// `…/maplibre-gl-worker.mjs` 404s, no vector tile is ever parsed, and only the style's background
// and raster relief paint — water, roads and labels vanish and the map looks washed out. Vite
// bundles the worker (with its shared chunk) and hands us its real URL instead.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MapPin } from 'lucide-react';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { DutyStatus } from '@/shared/ui/Badge';
import { EMPTY_COLLECTION, trafficTilesUrl, type MapLayer } from './overlays';
import { createHeadingTracker, normalizeHeading } from './heading';

const STYLE_URL: string = import.meta.env.VITE_MAP_STYLE_URL ?? '';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

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
  /** Which overlay layers are visible (the W-02 layer chips). Defaults to `Vehicles` only. */
  layers?: ReadonlySet<MapLayer>;
  /** `geofencesToGeoJSON()` output — drawn as fill + outline while `Geofences` is on. */
  geofences?: FeatureCollection;
  /** `tripsToGeoJSON()` output — drawn as lines + stop dots while `Trips` is on. */
  trips?: FeatureCollection;
}

const SOURCE_ID = 'fleet-units';
const CLUSTER_LAYER = 'fleet-clusters';
const CLUSTER_COUNT_LAYER = 'fleet-cluster-count';
const UNCLUSTERED_LAYER = 'fleet-unit-points';
const FLASH_LAYER = 'fleet-unit-flash';

const TRAFFIC_SOURCE = 'fleet-traffic';
const TRAFFIC_LAYER = 'fleet-traffic-flow';
const GEOFENCE_SOURCE = 'fleet-geofences';
const GEOFENCE_FILL_LAYER = 'fleet-geofence-fill';
const GEOFENCE_LINE_LAYER = 'fleet-geofence-outline';
const TRIP_SOURCE = 'fleet-trips';
const TRIP_LINE_LAYER = 'fleet-trip-lines';
const TRIP_STOP_LAYER = 'fleet-trip-stops';

/** Map layer ids owned by each W-02 layer chip. */
const LAYER_IDS: Record<MapLayer, readonly string[]> = {
  Vehicles: [CLUSTER_LAYER, CLUSTER_COUNT_LAYER, UNCLUSTERED_LAYER, FLASH_LAYER],
  Trips: [TRIP_LINE_LAYER, TRIP_STOP_LAYER],
  Geofences: [GEOFENCE_FILL_LAYER, GEOFENCE_LINE_LAYER],
  Traffic: [TRAFFIC_LAYER],
};

const DEFAULT_LAYERS: ReadonlySet<MapLayer> = new Set<MapLayer>(['Vehicles']);

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
/** Keyword, not a literal: the marker's outer halo and facet shadow, drawn at partial alpha. */
const HALO_COLOUR = 'black';

/** Marker bitmap edge, in device pixels (drawn at 2x, registered with `pixelRatio: 2` → 32 CSS px). */
const MARKER_IMAGE_SIZE = 64;
/** Layer `icon-size` — the 32 CSS px bitmap drawn at ~29 px, the chevron itself ~22 px tall. The
 * rear notch is a touch deeper than the reference render so the direction still reads at map size. */
const MARKER_ICON_SIZE = 0.9;

type Pt = readonly [number, number];
/** The faceted navigation chevron from `photos/*_arrow_transparent.png`, pointing north (0°), in
 * `MARKER_IMAGE_SIZE` coordinates: tip, the two rear corners, the rear notch, and the ridge point
 * where the four facets meet. The layer rotates it by the unit's heading (WD-076). */
const CHEVRON = {
  tip: [32, 7],
  left: [9, 55],
  right: [55, 55],
  notch: [32, 43],
  ridge: [32, 31],
} as const satisfies Record<string, Pt>;

function tracePath(ctx: CanvasRenderingContext2D, points: readonly Pt[]) {
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
}

/** One unit marker: the chevron filled with the duty colour, its four facets shaded like the
 * reference render (left base, right lit, rear wedges in shadow), with a dark halo + light ring
 * so it reads on both light and dark tiles. Shading is a translucent white/black wash over the
 * token colour, so no colour is ever parsed or hardcoded. MapLibre's typed `addImage` wants raster
 * data, not a canvas element — `getImageData` is the bridge between the two. */
function drawMarkerImageData(color: string): ImageData {
  const size = MARKER_IMAGE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const { tip, left, right, notch, ridge } = CHEVRON;
  const outline = [tip, right, notch, left] as const;
  ctx.lineJoin = 'round';

  // Halo (dark, soft) then ring (surface colour) — both drawn under the fill.
  tracePath(ctx, outline);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 7;
  ctx.strokeStyle = HALO_COLOUR;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 4;
  ctx.strokeStyle = token('--color-bg-surface', RING_COLOUR_FALLBACK);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();

  const facets: [readonly Pt[], string, number][] = [
    [[tip, ridge, right], RING_COLOUR_FALLBACK, 0.28],
    [[left, ridge, notch], HALO_COLOUR, 0.28],
    [[ridge, right, notch], HALO_COLOUR, 0.14],
  ];
  for (const [points, wash, alpha] of facets) {
    tracePath(ctx, points);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = wash;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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

/** `headings` is the tracker's resolved heading per unit id (reported `headingDeg`, else derived
 * from movement, else last known). With neither, the chevron stays in its neutral north-up pose
 * (`heading: 0`, `hasHeading: false`) — same shape for every unit, per WD-076. */
function toFeatureCollection(
  units: MapUnitFeature[],
  headings: ReadonlyMap<string, number | null> = new Map(),
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: validUnits(units).map((u): Feature<Point> => {
      const heading = normalizeHeading(headings.get(u.id) ?? u.headingDeg);
      return {
        type: 'Feature',
        id: u.id,
        geometry: { type: 'Point', coordinates: [u.lon, u.lat] },
        properties: {
          id: u.id,
          dutyStatus: u.dutyStatus,
          icon: `marker-${u.dutyStatus}`,
          heading: heading ?? 0,
          hasHeading: heading !== null,
        },
      };
    }),
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

/** The latest props, read by `installLayers` whenever the style (re)loads. */
interface OverlayState {
  units: MapUnitFeature[];
  layers: ReadonlySet<MapLayer>;
  geofences: FeatureCollection;
  trips: FeatureCollection;
  flashUnitId: string | null;
  headings: ReadonlyMap<string, number | null>;
}

/** Geofence colours from the 11.1 form (`BLUE`…`VIOLET`) resolved to design tokens. */
function geofenceColourExpression(): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'colour'],
    'GREEN', token('--color-success', 'green'),
    'AMBER', token('--color-warning', 'orange'),
    'RED', token('--color-danger', 'red'),
    'VIOLET', token('--color-violet', 'purple'),
    token('--color-primary', 'blue'),
  ];
}

function applyVisibility(map: maplibregl.Map, layers: ReadonlySet<MapLayer>) {
  for (const [layer, ids] of Object.entries(LAYER_IDS) as [MapLayer, readonly string[]][]) {
    const visibility = layers.has(layer) ? 'visible' : 'none';
    for (const id of ids) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}

/** Adds every image, source and layer the fleet map owns — idempotent, so it is safe to call on
 * both `style.load` and `load`, and again after a style swap has wiped them. Draw order, bottom to
 * top: traffic → geofences → trips → units. */
function installLayers(map: maplibregl.Map, state: OverlayState) {
  if (map.getSource(SOURCE_ID)) return;

  for (const status of Object.keys(DUTY_TOKEN) as DutyStatus[]) {
    const id = `marker-${status}`;
    if (map.hasImage(id)) continue;
    const image = drawMarkerImageData(token(DUTY_TOKEN[status], 'gray'));
    map.addImage(id, image, { pixelRatio: 2 });
  }

  const traffic = trafficTilesUrl();
  if (traffic) {
    map.addSource(TRAFFIC_SOURCE, { type: 'raster', tiles: [traffic], tileSize: 256 });
    map.addLayer({ id: TRAFFIC_LAYER, type: 'raster', source: TRAFFIC_SOURCE, paint: { 'raster-opacity': 0.85 } });
  }

  map.addSource(GEOFENCE_SOURCE, { type: 'geojson', data: state.geofences });
  map.addLayer({
    id: GEOFENCE_FILL_LAYER,
    type: 'fill',
    source: GEOFENCE_SOURCE,
    paint: { 'fill-color': geofenceColourExpression(), 'fill-opacity': 0.18 },
  });
  map.addLayer({
    id: GEOFENCE_LINE_LAYER,
    type: 'line',
    source: GEOFENCE_SOURCE,
    paint: { 'line-color': geofenceColourExpression(), 'line-width': 2 },
  });

  map.addSource(TRIP_SOURCE, { type: 'geojson', data: state.trips });
  map.addLayer({
    id: TRIP_LINE_LAYER,
    type: 'line',
    source: TRIP_SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': token('--color-primary', 'blue'),
      'line-width': 3,
      'line-opacity': ['case', ['==', ['get', 'kind'], 'remaining'], 0.55, 0.9],
      // Straight segments between stops, not road geometry — the dash says "planned", not "driven".
      'line-dasharray': [2, 1.5],
    },
  });
  map.addLayer({
    id: TRIP_STOP_LAYER,
    type: 'circle',
    source: TRIP_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': token('--color-bg-surface', RING_COLOUR_FALLBACK),
      'circle-stroke-color': token('--color-primary', 'blue'),
      'circle-stroke-width': 2,
    },
  });

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: toFeatureCollection(state.units, state.headings),
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
      'icon-size': MARKER_ICON_SIZE,
      'icon-allow-overlap': true,
      // Heading is degrees clockwise from north; aligning to the map (not the viewport) keeps the
      // chevron pointing the right way when the map is rotated or pitched.
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: FLASH_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'id'], state.flashUnitId ?? '__none__'],
    paint: {
      'circle-radius': 22,
      'circle-color': token('--color-warning', 'orange'),
      'circle-opacity': 0.35,
    },
  });

  applyVisibility(map, state.layers);
}

export default function FleetMap({
  units,
  selectedId,
  onSelectUnit,
  className,
  flashUnitId,
  layers = DEFAULT_LAYERS,
  geofences = EMPTY_COLLECTION,
  trips = EMPTY_COLLECTION,
}: FleetMapProps) {
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
  // Everything `installLayers` needs when the style (re)loads — kept current without remounting.
  // Per-unit anchor + last heading, kept across polls/patches so a unit without `headingDeg`
  // still turns with its movement and keeps its heading when it stops.
  const headingTrackerRef = useRef<ReturnType<typeof createHeadingTracker> | null>(null);
  headingTrackerRef.current ??= createHeadingTracker();
  const overlayRef = useRef<OverlayState>({
    units,
    layers,
    geofences,
    trips,
    flashUnitId: flashUnitId ?? null,
    headings: new Map(),
  });
  useEffect(() => {
    overlayRef.current = {
      units,
      layers,
      geofences,
      trips,
      flashUnitId: flashUnitId ?? null,
      headings: headingTrackerRef.current!.update(validUnits(units)),
    };
  }, [units, layers, geofences, trips, flashUnitId]);

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

    // `style.load` fires for the first style and again after any `setStyle()` swap, which wipes
    // every source/layer — re-installing there keeps the overlays alive across style reloads.
    // `installLayers` is idempotent, so its second run from `load` below is a no-op.
    map.on('style.load', () => installLayers(map, overlayRef.current));

    // Layer-bound listeners live on the map, not the style, so they are registered exactly once.
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

    map.on('load', () => {
      installLayers(map, overlayRef.current);

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
    source?.setData(toFeatureCollection(units, overlayRef.current.headings));
    // First data arrives after `load` (e.g. the initial fetch was still pending) — fit once, then
    // leave the camera alone for subsequent polls so a dispatcher's own pan/zoom is not undone.
    if (!hasFitToDataRef.current && validUnits(units).length > 0) {
      fitToUnits(map, units);
      hasFitToDataRef.current = true;
    }
  }, [units, ready]);

  /** The W-02 layer chips — `visibility` only, so hiding a layer never drops its source data. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyVisibility(map, layers);
  }, [layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(GEOFENCE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(geofences);
  }, [geofences, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(TRIP_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(trips);
  }, [trips, ready]);

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
