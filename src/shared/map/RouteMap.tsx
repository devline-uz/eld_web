// Route preview map (W-11 right rail, 11.10 Create trip): pickup, intermediate-stop and delivery
// markers labelled in route order (P, 1…N, D), the route polyline and a fitBounds over all of it. Same MapLibre setup as FleetMap (style URL, worker URL, CSS); lazy-imported
// by the Trips screen so `maplibre-gl` stays in the map chunk. The map is created once per mount and
// updated through its GeoJSON source, so selecting another trip never remounts it.
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { LatLon } from './overlays';
import { routeCoords, routeFeatures } from './routeFeatures';

const STYLE_URL: string = import.meta.env.VITE_MAP_STYLE_URL ?? '';
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface RouteMapProps {
  pickup: LatLon;
  delivery: LatLon;
  /** Intermediate stops between the pickup and the delivery, in route order. */
  waypoints?: readonly LatLon[];
  /** Road geometry as [lon, lat] pairs. Empty/`null` → a straight line is drawn (`approximate`). */
  line: [number, number][] | null;
  /** The line is straight pickup → stops → delivery segments, not a road route. */
  approximate?: boolean;
  className?: string;
}

const SOURCE = 'route-line';
const LINE_LAYER = 'route-line-layer';
const POINT_LAYER = 'route-points-layer';
const LABEL_LAYER = 'route-labels-layer';
const FIT_PADDING = 40;

function cssToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function install(map: maplibregl.Map, p: RouteMapProps) {
  if (map.getSource(SOURCE)) return;
  const data = routeFeatures(p);
  map.addSource(SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: LINE_LAYER,
    type: 'line',
    source: SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': cssToken('--color-primary', 'blue'),
      'line-width': 4,
      'line-dasharray': p.approximate ? [2, 2] : [1, 0],
    },
  });
  map.addLayer({
    id: POINT_LAYER,
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 9,
      'circle-color': [
        'match',
        ['get', 'kind'],
        'pickup',
        cssToken('--color-success', 'green'),
        'stop',
        cssToken('--color-primary', 'blue'),
        cssToken('--color-danger', 'red'),
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': cssToken('--color-surface', 'white'),
    },
  });
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-font': ['Noto Sans Regular'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': cssToken('--color-text-inverse', 'white') },
  });
}

function fit(map: maplibregl.Map, p: RouteMapProps) {
  const coords = routeCoords(p);
  const first = coords[0]!;
  const bounds = coords.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(first, first));
  map.resize();
  map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 12, duration: 0 });
}

export default function RouteMap(props: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasStyle = Boolean(STYLE_URL);

  useEffect(() => {
    if (!hasStyle || !containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: containerRef.current, style: STYLE_URL, center: [-97, 38.5], zoom: 3, attributionControl: { compact: true } });
    } catch {
      queueMicrotask(() => setFailed(true)); // no WebGL
      return;
    }
    mapRef.current = map;
    map.on('error', () => setFailed(true));
    map.on('load', () => {
      install(map, propsRef.current);
      fit(map, propsRef.current);
      setReady(true);
    });
    const el = containerRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.resize());
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [hasStyle]);

  const { pickup, delivery, waypoints, line, approximate } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const p = { pickup, delivery, waypoints, line, approximate };
    (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(routeFeatures(p));
    map.setPaintProperty(LINE_LAYER, 'line-dasharray', approximate ? [2, 2] : [1, 0]);
    fit(map, p);
  }, [pickup, delivery, waypoints, line, approximate, ready]);

  if (!hasStyle || failed) {
    return (
      <div role="status" className="flex h-full items-center justify-center rounded-md bg-bg-subtle px-3 text-center text-caption text-text-muted">
        {hasStyle ? 'Map could not be loaded' : 'Map unavailable — no map style configured'}
      </div>
    );
  }
  return <div ref={containerRef} className={props.className ?? 'h-full w-full rounded-md'} />;
}
