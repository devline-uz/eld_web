// web/tz.md §10/§16.3 — exercises the branch that only runs when `VITE_MAP_STYLE_URL` is set: the
// GeoJSON source + symbol layer setup, marker-click selection, the `geofence.transition` flash
// filter, and the point-update path that must never remount the map (§16.3 rule 6). A separate
// file from FleetMap.test.tsx because `VITE_MAP_STYLE_URL` is read once, at module-eval time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock'; // web/bugs.md WB-016
}

// jsdom has no canvas 2D backend (`Not implemented: HTMLCanvasElement.getContext` without the
// native `canvas` package, which this project does not depend on) — stub just enough of the 2D
// context surface `drawMarkerImageData` touches (web/shared/map/FleetMap.tsx).
const fake2dContext = {
  beginPath: vi.fn(),
  arc: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  /** Records the colour each fill was painted with, so marker colours can be asserted. */
  fill: vi.fn(function (this: { fillStyle: string; filled: string[] }) {
    this.filled.push(this.fillStyle);
  }),
  filled: [] as string[],
  stroke: vi.fn(),
  fillStyle: '',
  lineWidth: 0,
  lineJoin: '',
  globalAlpha: 1,
  strokeStyle: '',
  getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  })),
};
HTMLCanvasElement.prototype.getContext = vi.fn(() => fake2dContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

type Handler = (...args: unknown[]) => void;

class FakeGeoJSONSource {
  constructor(public spec?: { data?: unknown }) {}
  setData = vi.fn();
}

class FakeMap {
  static instances: FakeMap[] = [];
  listeners = new Map<string, Handler[]>();
  layerListeners = new Map<string, Map<string, Handler[]>>();
  images = new Set<string>();
  sources = new Map<string, FakeGeoJSONSource>();
  filters: Record<string, unknown> = {};
  remove = vi.fn();
  easeTo = vi.fn();
  jumpTo = vi.fn();
  fitBounds = vi.fn();
  resize = vi.fn();
  getCanvas = vi.fn(() => ({ style: { cursor: '' } }));

  constructor() {
    FakeMap.instances.push(this);
  }

  on(event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) {
    if (typeof layerOrHandler === 'function') {
      const list = this.listeners.get(event) ?? [];
      list.push(layerOrHandler);
      this.listeners.set(event, list);
    } else if (maybeHandler) {
      const byLayer = this.layerListeners.get(event) ?? new Map<string, Handler[]>();
      const list = byLayer.get(layerOrHandler) ?? [];
      list.push(maybeHandler);
      byLayer.set(layerOrHandler, list);
      this.layerListeners.set(event, byLayer);
    }
    return this;
  }

  fire(event: string, payload?: unknown) {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }

  fireLayer(event: string, layer: string, payload?: unknown) {
    for (const handler of this.layerListeners.get(event)?.get(layer) ?? []) handler(payload);
  }

  hasImage(id: string) {
    return this.images.has(id);
  }

  addImage(id: string) {
    this.images.add(id);
  }

  addSource(id: string, spec?: { data?: unknown }) {
    this.sources.set(id, new FakeGeoJSONSource(spec));
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  layers = new Map<string, { id: string; layout?: Record<string, unknown> }>();
  addLayer = vi.fn((layer: { id: string; layout?: Record<string, unknown> }) => {
    this.layers.set(layer.id, { ...layer, layout: { ...layer.layout } });
  });
  getLayer(id: string) {
    return this.layers.get(id);
  }
  setLayoutProperty = vi.fn((id: string, name: string, value: unknown) => {
    const layer = this.layers.get(id);
    if (layer) layer.layout = { ...layer.layout, [name]: value };
  });
  visibility(id: string) {
    return this.layers.get(id)?.layout?.visibility;
  }
  /** What `setStyle()` does to a real map: every source and layer is gone. */
  wipeStyle() {
    this.sources.clear();
    this.layers.clear();
  }
  setFilter = vi.fn((layerId: string, filter: unknown) => {
    this.filters[layerId] = filter;
  });
}

/** Minimal stand-in for `maplibregl.LngLatBounds` — just enough for `extend()` chaining. */
class FakeLngLatBounds {
  constructor(
    public sw: [number, number],
    public ne: [number, number],
  ) {}
  extend(_point: [number, number]) {
    return this;
  }
}

const setWorkerUrlMock = vi.hoisted(() => vi.fn());

vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  LngLatBounds: FakeLngLatBounds,
  setWorkerUrl: setWorkerUrlMock,
}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.stubEnv('VITE_MAP_STYLE_URL', 'https://example.com/style.json');

const { default: FleetMap } = await import('./FleetMap');

const UNITS = [
  { id: 'v1', lat: 40, lon: -83, dutyStatus: 'DRIVING' as const },
  { id: 'v2', lat: 40.1, lon: -83.1, dutyStatus: 'ON_DUTY' as const },
];

describe('FleetMap — GeoJSON source + symbol layer (style configured)', () => {
  beforeEach(() => {
    FakeMap.instances.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('points MapLibre at the Vite-bundled tile worker (else vector layers — water, roads — never render)', () => {
    expect(setWorkerUrlMock).toHaveBeenCalledTimes(1);
    expect(setWorkerUrlMock.mock.calls[0]![0]).toMatch(/maplibre-gl-worker/);
  });

  it('builds a clustered GeoJSON source and a symbol layer, never DOM markers', () => {
    const { container } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    expect(map.sources.get('fleet-units')).toBeDefined();
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fleet-unit-points', type: 'symbol' }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fleet-clusters', type: 'circle' }));
    // no per-unit DOM node was created for the markers (§16.3 rule 5).
    expect(container.querySelectorAll('[data-marker]').length).toBe(0);
  });

  it('reports the clicked unit id back to the caller', () => {
    const onSelectUnit = vi.fn();
    render(<FleetMap units={UNITS} onSelectUnit={onSelectUnit} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    map.fireLayer('click', 'fleet-unit-points', { features: [{ properties: { id: 'v2' } }] });
    expect(onSelectUnit).toHaveBeenCalledWith('v2');
  });

  it('patches the existing source on a units update instead of remounting the map', () => {
    const { rerender } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    const nextUnits = [...UNITS, { id: 'v3', lat: 41, lon: -84, dutyStatus: 'SLEEPER' as const }];
    rerender(<FleetMap units={nextUnits} />);

    expect(map.sources.get('fleet-units')!.setData).toHaveBeenCalled();
    expect(FakeMap.instances.length).toBe(1); // still the same map instance
  });

  it('flashes the unit after a geofence.transition and clears the filter when it ends', () => {
    const { rerender } = render(<FleetMap units={UNITS} flashUnitId={null} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    rerender(<FleetMap units={UNITS} flashUnitId="v1" />);
    expect(map.filters['fleet-unit-flash']).toEqual(['==', ['get', 'id'], 'v1']);

    rerender(<FleetMap units={UNITS} flashUnitId={null} />);
    expect(map.filters['fleet-unit-flash']).toEqual(['==', ['get', 'id'], '__none__']);
  });

  it('eases the camera to the selected unit', () => {
    const { rerender } = render(<FleetMap units={UNITS} selectedId={null} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    rerender(<FleetMap units={UNITS} selectedId="v2" />);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-83.1, 40.1] }));
  });

  it('falls back to MapUnavailable when the style errors after mounting', () => {
    const { getByText } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('error'));
    expect(getByText('Map preview unavailable')).toBeInTheDocument();
  });

  it('shows only the Vehicles layers by default and toggles visibility from the `layers` prop', () => {
    const { rerender } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    for (const id of ['fleet-clusters', 'fleet-cluster-count', 'fleet-unit-points', 'fleet-unit-flash']) {
      expect(map.visibility(id)).toBe('visible');
    }
    expect(map.visibility('fleet-geofence-fill')).toBe('none');
    expect(map.visibility('fleet-geofence-outline')).toBe('none');
    expect(map.visibility('fleet-trip-lines')).toBe('none');
    // No VITE_TRAFFIC_TILES_URL here → no traffic source or layer at all.
    expect(map.sources.has('fleet-traffic')).toBe(false);

    rerender(<FleetMap units={UNITS} layers={new Set(['Geofences', 'Trips'] as const)} />);
    expect(map.visibility('fleet-unit-points')).toBe('none');
    expect(map.visibility('fleet-clusters')).toBe('none');
    expect(map.visibility('fleet-geofence-fill')).toBe('visible');
    expect(map.visibility('fleet-trip-stops')).toBe('visible');
  });

  it('pushes geofence and trip GeoJSON into their sources', () => {
    const { rerender } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    const geofences = { type: 'FeatureCollection' as const, features: [] };
    const trips = { type: 'FeatureCollection' as const, features: [] };
    rerender(<FleetMap units={UNITS} geofences={geofences} trips={trips} />);
    expect(map.sources.get('fleet-geofences')!.setData).toHaveBeenLastCalledWith(geofences);
    expect(map.sources.get('fleet-trips')!.setData).toHaveBeenLastCalledWith(trips);
  });

  it('re-adds every source and layer, with the current visibility, after a style reload', () => {
    const { rerender } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));
    rerender(<FleetMap units={UNITS} layers={new Set(['Geofences'] as const)} />);

    map.wipeStyle();
    act(() => map.fire('style.load'));

    expect(map.sources.has('fleet-units')).toBe(true);
    expect(map.sources.has('fleet-geofences')).toBe(true);
    expect(map.visibility('fleet-geofence-fill')).toBe('visible');
    expect(map.visibility('fleet-unit-points')).toBe('none');
  });

  it('adds a raster traffic layer when VITE_TRAFFIC_TILES_URL is set', () => {
    vi.stubEnv('VITE_TRAFFIC_TILES_URL', 'https://tiles.example.com/{z}/{x}/{y}.png');
    const { rerender } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));

    expect(map.sources.has('fleet-traffic')).toBe(true);
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'fleet-traffic-flow', type: 'raster' }));
    expect(map.visibility('fleet-traffic-flow')).toBe('none');

    rerender(<FleetMap units={UNITS} layers={new Set(['Vehicles', 'Traffic'] as const)} />);
    expect(map.visibility('fleet-traffic-flow')).toBe('visible');
  });

  it('removes the map instance on unmount', () => {
    const { unmount } = render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });

  it('resizes the map on load, before fitting bounds (web/bugs.md WB-049)', () => {
    render(<FleetMap units={UNITS} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));
    expect(map.resize).toHaveBeenCalled();
  });

  it('fits bounds to valid units only, skipping null/NaN/null-island/out-of-range fixes', () => {
    const mixed = [
      ...UNITS,
      { id: 'bad-null', lat: null as unknown as number, lon: null as unknown as number, dutyStatus: 'INACTIVE' as const },
      { id: 'bad-zero', lat: 0, lon: 0, dutyStatus: 'ELD_OFFLINE' as const },
      { id: 'bad-nan', lat: Number.NaN, lon: -83, dutyStatus: 'IDLE' as const },
      { id: 'bad-range', lat: -83, lon: 190, dutyStatus: 'OFF_DUTY' as const },
    ];
    render(<FleetMap units={mixed} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    // Only the two valid UNITS feed the GeoJSON source too.
    expect(map.sources.get('fleet-units')).toBeDefined();
  });

  it('falls back to the continental-US default view when there is not a single valid fix', () => {
    render(
      <FleetMap
        units={[{ id: 'bad-zero', lat: 0, lon: 0, dutyStatus: 'ELD_OFFLINE' as const }]}
      />,
    );
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));
    expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-97, 38.5] }));
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('fits once when data arrives after load, then leaves the camera alone on later polls', () => {
    const { rerender } = render(<FleetMap units={[]} />);
    const map = FakeMap.instances[0]!;
    act(() => map.fire('load'));
    expect(map.jumpTo).toHaveBeenCalledTimes(1); // no data yet at load time

    rerender(<FleetMap units={UNITS} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    const moved = [{ id: 'v1', lat: 45, lon: -90, dutyStatus: 'DRIVING' as const }];
    rerender(<FleetMap units={moved} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(1); // not refit on a later poll
  });

  describe('direction marker (WD-076)', () => {
    type UnitProps = { id: string; heading: number; hasHeading: boolean; icon: string };
    const initialProps = (map: FakeMap) =>
      (map.sources.get('fleet-units')!.spec!.data as { features: { properties: UnitProps }[] }).features.map(
        (f) => f.properties,
      );
    const lastSetProps = (map: FakeMap) => {
      const calls = map.sources.get('fleet-units')!.setData.mock.calls;
      return (calls.at(-1)![0] as { features: { properties: UnitProps }[] }).features.map((f) => f.properties);
    };

    it('rotates the unit symbol by its heading, aligned to the map (not the viewport)', () => {
      render(<FleetMap units={UNITS} />);
      const map = FakeMap.instances[0]!;
      act(() => map.fire('load'));
      const layer = map.layers.get('fleet-unit-points')!;
      expect(layer.layout).toMatchObject({
        'icon-image': ['get', 'icon'],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
      });
    });

    it('carries headingDeg into the feature, and a neutral north-up pose when it is unknown', () => {
      render(
        <FleetMap
          units={[
            { id: 'w', lat: 40, lon: -83, dutyStatus: 'DRIVING', headingDeg: 274 },
            { id: 'n', lat: 41, lon: -84, dutyStatus: 'ELD_OFFLINE', headingDeg: null },
          ]}
        />,
      );
      const map = FakeMap.instances[0]!;
      act(() => map.fire('load'));
      expect(initialProps(map)).toEqual([
        expect.objectContaining({ id: 'w', heading: 274, hasHeading: true, icon: 'marker-DRIVING' }),
        expect.objectContaining({ id: 'n', heading: 0, hasHeading: false, icon: 'marker-ELD_OFFLINE' }),
      ]);
    });

    it('turns a unit without headingDeg toward its movement and holds it once it stops', () => {
      const at = (lon: number) => [{ id: 'v', lat: 40, lon, dutyStatus: 'DRIVING' as const, headingDeg: null }];
      const { rerender } = render(<FleetMap units={at(-83)} />);
      const map = FakeMap.instances[0]!;
      act(() => map.fire('load'));

      rerender(<FleetMap units={at(-83.01)} />); // ~850 m west
      expect(lastSetProps(map)[0]).toMatchObject({ hasHeading: true });
      expect(lastSetProps(map)[0]!.heading).toBeCloseTo(270, 0);

      rerender(<FleetMap units={at(-83.01)} />); // parked
      expect(lastSetProps(map)[0]!.heading).toBeCloseTo(270, 0);
    });

    it('registers one chevron image per status, filled with that status token colour', () => {
      const root = document.documentElement.style;
      root.setProperty('--color-success', 'green');
      root.setProperty('--color-violet', 'purple');
      fake2dContext.filled.length = 0;
      try {
        render(<FleetMap units={UNITS} />);
        const map = FakeMap.instances[0]!;
        act(() => map.fire('load'));
        expect(map.images.has('marker-DRIVING')).toBe(true);
        expect(map.images.has('marker-SLEEPER')).toBe(true);
        expect(fake2dContext.filled).toContain('green');
        expect(fake2dContext.filled).toContain('purple');
        // drawn as a polygon path, not the old circle
        expect(fake2dContext.lineTo).toHaveBeenCalled();
        expect(fake2dContext.arc).not.toHaveBeenCalled();
      } finally {
        root.removeProperty('--color-success');
        root.removeProperty('--color-violet');
      }
    });
  });
});
