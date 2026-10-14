// QA FE-001 / UI-018 — RouteMap only gives up when the style never loaded; tile errors after that
// keep the map. Fit padding leaves room for the delivery marker.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock'; // web/bugs.md WB-016
}

type Handler = (...args: unknown[]) => void;

class FakeMap {
  static instances: FakeMap[] = [];
  listeners = new Map<string, Handler[]>();
  remove = vi.fn();
  resize = vi.fn();
  fitBounds = vi.fn();
  addSource = vi.fn();
  addLayer = vi.fn();
  getSource = vi.fn(() => undefined);
  setPaintProperty = vi.fn();
  constructor() {
    FakeMap.instances.push(this);
  }
  on(event: string, handler: Handler) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), handler]);
    return this;
  }
  fire(event: string, payload?: unknown) {
    for (const h of this.listeners.get(event) ?? []) h(payload);
  }
}

class FakeLngLatBounds {
  extend() {
    return this;
  }
}

vi.mock('maplibre-gl', () => ({ Map: FakeMap, LngLatBounds: FakeLngLatBounds, setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.stubEnv('VITE_MAP_STYLE_URL', 'https://example.com/style.json');

const { default: RouteMap } = await import('./RouteMap');

const PROPS = { pickup: { lat: 40, lon: -83 }, delivery: { lat: 41, lon: -84 }, line: null };

describe('RouteMap', () => {
  it('keeps the map when a tile fails after the style loaded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<RouteMap {...PROPS} />);
    const map = FakeMap.instances.at(-1)!;
    act(() => map.fire('load'));
    act(() => map.fire('error', { error: new Error('tile 500') }));
    expect(screen.queryByText('Map could not be loaded')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back when the style itself never loads', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RouteMap {...PROPS} />);
    const map = FakeMap.instances.at(-1)!;
    act(() => map.fire('error', { error: new Error('style 404') }));
    expect(screen.getByText('Map could not be loaded')).toBeInTheDocument();
    err.mockRestore();
  });

  it('UI-018: fits with enough padding that the delivery marker is not clipped', () => {
    render(<RouteMap {...PROPS} />);
    const map = FakeMap.instances.at(-1)!;
    act(() => map.fire('load'));
    const opts = map.fitBounds.mock.calls[0]![1] as { padding: number };
    expect(opts.padding).toBeGreaterThanOrEqual(56);
  });

  it('CODE-050: a re-render with equal (but new) props keeps the pan/zoom; moved stops re-fit', () => {
    const { rerender } = render(<RouteMap {...PROPS} />);
    const map = FakeMap.instances.at(-1)!;
    act(() => map.fire('load'));
    const fits = map.fitBounds.mock.calls.length;
    // useTripRoute hands fresh objects every render — same coordinates must not re-fit.
    rerender(<RouteMap pickup={{ lat: 40, lon: -83 }} delivery={{ lat: 41, lon: -84 }} waypoints={[]} line={null} />);
    rerender(<RouteMap pickup={{ lat: 40, lon: -83 }} delivery={{ lat: 41, lon: -84 }} waypoints={[]} line={null} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(fits);
    rerender(<RouteMap pickup={{ lat: 40, lon: -83 }} delivery={{ lat: 42, lon: -85 }} line={null} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(fits + 1);
    // The road line for the same stops arriving re-fits once (it can reach past the stops).
    const road: [number, number][] = [[-83, 40], [-84.5, 41.5], [-85, 42]];
    rerender(<RouteMap pickup={{ lat: 40, lon: -83 }} delivery={{ lat: 42, lon: -85 }} line={road} />);
    rerender(<RouteMap pickup={{ lat: 40, lon: -83 }} delivery={{ lat: 42, lon: -85 }} line={[...road]} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(fits + 2);
  });
});
