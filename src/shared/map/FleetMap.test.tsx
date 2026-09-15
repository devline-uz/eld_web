// web/tz.md §10/§16.3 — the required degrade-gracefully fallback when `VITE_MAP_STYLE_URL` is
// unset in this environment (never a blank box, never a crash).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// `maplibre-gl` calls `window.URL.createObjectURL` as a *module-load* side effect (web/bugs.md
// WB-016) — jsdom has no such API, so it must be polyfilled before the module is ever imported.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock';
}

const { default: FleetMap, MapUnavailable } = await import('./FleetMap');

describe('FleetMap', () => {
  it('renders the explained fallback instead of a blank box when no style URL is configured', () => {
    // The test env's VITE_MAP_STYLE_URL is unset, exactly like local dev (web/decisions.md).
    render(<FleetMap units={[]} />);
    expect(screen.getByText('Map preview unavailable')).toBeInTheDocument();
    expect(screen.getByText(/No map style is configured for this environment/)).toBeInTheDocument();
  });

  it('MapUnavailable renders standalone with the same copy', () => {
    render(<MapUnavailable />);
    expect(screen.getByRole('status')).toHaveTextContent('Map preview unavailable');
  });
});
