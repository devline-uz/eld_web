// owner: web-dashboard-fleet — the 11.1 Create a geofence map (web/tz.md §11.1). Same MapLibre
// setup as FleetMap (style URL, worker URL, CSS) — lazy-imported by the modal so `maplibre-gl`
// stays in the map chunk. A click places the shape's points; every point is a draggable marker.
//
//   point     → one centre (Circle / Address); drawn as a circle when a radius is set
//   rectangle → two opposite corners; a third click starts a new rectangle
//   polygon   → every click adds a vertex
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Minus, Plus } from 'lucide-react';
import type { Feature, FeatureCollection, Position } from 'geojson';
import { circleToPolygon, EMPTY_COLLECTION, rectangleCorners, type LatLon } from './overlays';

const STYLE_URL: string = import.meta.env.VITE_MAP_STYLE_URL ?? '';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export type GeofenceDrawMode = 'point' | 'rectangle' | 'polygon';

/**
 * Why the picker could not show a map:
 *   no-style     → `VITE_MAP_STYLE_URL` is empty in the build / dev server
 *   no-webgl     → the browser could not create a WebGL context
 *   style-failed → the style request failed (bad key, origin not allowed by the tile provider, offline)
 */
export type GeofenceMapFailure = 'no-style' | 'no-webgl' | 'style-failed';

export interface GeofencePickerMapProps {
  mode: GeofenceDrawMode;
  points: LatLon[];
  onPointsChange: (points: LatLon[]) => void;
  /** Circle radius in miles — drawn around the centre in `point` mode. */
  radiusMi?: number;
  /** 11.1 colour select value (`BLUE`…`VIOLET`). */
  colour?: string;
  /** No map could be shown — the modal falls back to Address and says why. */
  onUnavailable?: (reason: GeofenceMapFailure) => void;
  disabled?: boolean;
  className?: string;
}

const SHAPE_SOURCE = 'geofence-draft';
const SHAPE_FILL_LAYER = 'geofence-draft-fill';
const SHAPE_LINE_LAYER = 'geofence-draft-outline';
const METERS_PER_MILE = 1609.344;
const DEFAULT_US_CENTER: [number, number] = [-97, 38.5];
const DEFAULT_US_ZOOM = 3.4;
const POINT_ZOOM = 13;

function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const COLOUR_TOKEN: Record<string, [string, string]> = {
  BLUE: ['--color-primary', 'blue'],
  GREEN: ['--color-success', 'green'],
  AMBER: ['--color-warning', 'orange'],
  RED: ['--color-danger', 'red'],
  VIOLET: ['--color-violet', 'purple'],
};

function colourOf(colour: string | undefined): string {
  const [name, fallback] = COLOUR_TOKEN[colour ?? 'BLUE'] ?? COLOUR_TOKEN.BLUE!;
  return token(name, fallback);
}

function ring(points: LatLon[]): Position[] {
  const positions = points.map((p): Position => [p.lon, p.lat]);
  return [...positions, positions[0]!];
}

function shapeCollection(mode: GeofenceDrawMode, points: LatLon[], radiusMi?: number): FeatureCollection {
  const features: Feature[] = [];
  if (mode === 'point' && points[0] && radiusMi && radiusMi > 0) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: circleToPolygon([points[0].lon, points[0].lat], radiusMi * METERS_PER_MILE),
    });
  } else if (mode === 'rectangle' && points.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring(rectangleCorners(points[0]!, points[1]!))] },
    });
  } else if (mode === 'polygon' && points.length >= 3) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring(points)] } });
  } else if (mode === 'polygon' && points.length === 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) },
    });
  }
  return features.length ? { type: 'FeatureCollection', features } : EMPTY_COLLECTION;
}

function nextPoints(mode: GeofenceDrawMode, points: LatLon[], p: LatLon): LatLon[] {
  if (mode === 'point') return [p];
  if (mode === 'rectangle') return points.length >= 2 ? [p] : [...points, p];
  return [...points, p];
}

function installShapeLayers(map: maplibregl.Map, data: FeatureCollection, colour: string) {
  if (map.getSource(SHAPE_SOURCE)) return;
  map.addSource(SHAPE_SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: SHAPE_FILL_LAYER,
    type: 'fill',
    source: SHAPE_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': colour, 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: SHAPE_LINE_LAYER,
    type: 'line',
    source: SHAPE_SOURCE,
    paint: { 'line-color': colour, 'line-width': 2 },
  });
}

export default function GeofencePickerMap({
  mode,
  points,
  onPointsChange,
  radiusMi,
  colour,
  onUnavailable,
  disabled = false,
  className,
}: GeofencePickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  // Map listeners are registered once; they read the latest props through this ref.
  const latest = useRef({ mode, points, onPointsChange, radiusMi, colour, onUnavailable, disabled });
  useEffect(() => {
    latest.current = { mode, points, onPointsChange, radiusMi, colour, onUnavailable, disabled };
  });

  useEffect(() => {
    if (!containerRef.current) return;
    if (!STYLE_URL) {
      latest.current.onUnavailable?.('no-style');
      return;
    }
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: DEFAULT_US_CENTER,
        zoom: DEFAULT_US_ZOOM,
        attributionControl: false,
      });
    } catch {
      // No WebGL (old browser, jsdom) — never a crash inside the modal.
      latest.current.onUnavailable?.('no-webgl');
      return;
    }
    mapRef.current = map;
    // No `NavigationControl`: it costs 1.4 KB gzip in the budgeted maplibre chunk (426.1 KB vs the
    // 425 KB cap, WD-077). The +/- buttons rendered below call the same `zoomIn`/`zoomOut`.
    map.getCanvas().style.cursor = 'crosshair';

    // Only a style that never loads means "no map". Anything after the style is in — a failed
    // tile, glyph or sprite during the first render — leaves a usable (if patchy) map, so it must
    // not flip the modal to the Address-only fallback.
    let styleLoaded = false;
    map.on('error', (event: maplibregl.ErrorEvent) => {
      if (styleLoaded) return;
      console.error('[GeofencePickerMap] map style failed to load', event.error);
      latest.current.onUnavailable?.('style-failed');
    });

    const install = () => {
      styleLoaded = true;
      const { mode: m, points: pts, radiusMi: r, colour: c } = latest.current;
      installShapeLayers(map, shapeCollection(m, pts, r), colourOf(c));
    };
    map.on('style.load', install);

    map.on('click', (e) => {
      const { mode: m, points: pts, onPointsChange: change, disabled: off } = latest.current;
      if (off) return;
      change(nextPoints(m, pts, { lat: e.lngLat.lat, lon: e.lngLat.lng }));
    });

    map.on('load', () => {
      install();
      // The modal is still settling (Radix portal mount, centred via transform) when the map
      // reads its container, so the canvas can be born at the wrong size — re-read it now.
      map.resize();
      const first = latest.current.points[0];
      if (first) map.jumpTo({ center: [first.lon, first.lat], zoom: POINT_ZOOM });
      setReady(true);
    });

    return () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  /** Keeps the canvas matched to its box — the modal body can reflow (banner, errors) after open. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Shape preview follows the points, the radius and the mode. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(SHAPE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
      shapeCollection(mode, points, radiusMi),
    );
  }, [mode, points, radiusMi, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const c = colourOf(colour);
    if (map.getLayer(SHAPE_FILL_LAYER)) map.setPaintProperty(SHAPE_FILL_LAYER, 'fill-color', c);
    if (map.getLayer(SHAPE_LINE_LAYER)) map.setPaintProperty(SHAPE_LINE_LAYER, 'line-color', c);
  }, [colour, ready]);

  /** One draggable marker per point. A drag redraws the shape live and commits on release. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = points.map((p, index) => {
      const marker = new maplibregl.Marker({ draggable: !disabled, color: colourOf(colour) })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      const moved = (): LatLon[] => {
        const { lng, lat } = marker.getLngLat();
        return latest.current.points.map((q, i) => (i === index ? { lat, lon: lng } : q));
      };
      marker.on('drag', () => {
        const { mode: m, radiusMi: r } = latest.current;
        (map.getSource(SHAPE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(shapeCollection(m, moved(), r));
      });
      marker.on('dragend', () => latest.current.onPointsChange(moved()));
      return marker;
    });
  }, [points, colour, disabled, ready]);

  /** Keep a placed centre in view (e.g. after the modal body reflowed and the map resized). */
  useEffect(() => {
    const map = mapRef.current;
    const first = points[0];
    if (!map || !ready || !first || mode !== 'point') return;
    if (!map.getBounds().contains([first.lon, first.lat])) map.easeTo({ center: [first.lon, first.lat], duration: 300 });
  }, [points, mode, ready]);

  const zoomButton =
    'flex h-7 w-7 items-center justify-center bg-bg-surface text-text hover:bg-bg-subtle disabled:opacity-50';
  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className ?? 'h-full w-full rounded-md'} />
      {ready && (
        <div className="absolute right-2 top-2 z-10 flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border shadow-card">
          <button type="button" aria-label="Zoom in" className={zoomButton} onClick={() => mapRef.current?.zoomIn()}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Zoom out" className={zoomButton} onClick={() => mapRef.current?.zoomOut()}>
            <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
