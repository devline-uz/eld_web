// QA FE-005 — a crashing screen keeps the app shell and offers Retry instead of React Router's
// default "Unexpected Application Error!" page.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouteError } from './RouteError';

vi.mock('@/shared/observability/sentry', () => ({ captureError: vi.fn() }));

function Boom(): never {
  throw new Error('render crash');
}

function ChunkBoom(): never {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/TripsPage-abc.js');
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <div>
            <nav aria-label="Main">Shell nav</nav>
            <Outlet />
          </div>
        ),
        errorElement: <RouteError fullPage />,
        children: [
          { index: true, element: <p>Dashboard</p>, errorElement: <RouteError /> },
          { path: 'boom', element: <Boom />, errorElement: <RouteError /> },
          { path: 'chunk', element: <ChunkBoom />, errorElement: <RouteError /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe('RouteError', () => {
  it('renders inside the shell with Retry and a way back to the dashboard', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    try {
      renderAt('/boom');
      expect(await screen.findByText('This page could not be displayed')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(reload).toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Go to dashboard' }));
      expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
      err.mockRestore();
    }
  });

  it('explains a failed lazy chunk as a new version', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderAt('/chunk');
    expect(await screen.findByText('A new version is available')).toBeInTheDocument();
    err.mockRestore();
  });
});
